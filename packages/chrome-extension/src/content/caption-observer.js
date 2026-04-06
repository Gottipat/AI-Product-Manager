/**
 * @fileoverview Content Script — Google Meet Caption Observer
 * @description Injected into Google Meet pages. Observes the DOM for live captions,
 *   normalizes speaker names, segments cleaner utterances, and forwards finalized
 *   transcript events to the background service worker.
 */

/* ───────────────────────────────────────────
   DOM Selectors
   ─────────────────────────────────────────── */
const SELECTORS = {
  captionContainers: ['.iS70S', '[jsname="dsyhDe"]', '.iOzk7', '[class*="a4cQT"]'],
  captionTexts: ['.McS7S', '[class*="TBMuR"]', '.CNusmb'],
  speakerNames: ['.VpS7S', '[class*="zs7s8d"]', '.KcIKyf'],
};

const SPEAKER_SELECTOR = SELECTORS.speakerNames.join(', ');
const TEXT_SELECTOR = SELECTORS.captionTexts.join(', ');

/* ───────────────────────────────────────────
   State
   ─────────────────────────────────────────── */
let isCapturing = false;
let observer = null;
let observerRetryTimeout = null;
let flushInterval = null;
let draftCommitTimeout = null;
let scanScheduled = false;
let sequenceNumber = 0;
let captionBuffer = [];
let currentDraft = null;
let lastCommittedCaption = null;

const BUFFER_FLUSH_MS = 4000;
const DRAFT_IDLE_MS = 1400;
const MAX_BATCH_SIZE = 20;

/* ───────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────── */
function normalizeSpeakerName(name) {
  if (!name) return 'Unknown';

  const normalized = name
    .trim()
    .replace(/\s*\(You\)$/i, '')
    .replace(/\s*\(Host\)$/i, '')
    .replace(/\s*\(Presenter\)$/i, '')
    .replace(/\s*\(Guest\)$/i, '')
    .replace(/devices$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized || 'Unknown';
}

function buildSpeakerId(name) {
  return `speaker:${
    normalizeSpeakerName(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unknown'
  }`;
}

function findCaptionContainer() {
  for (const selector of SELECTORS.captionContainers) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return null;
}

function findCaptionRow(startNode, container) {
  let current = startNode instanceof Element ? startNode : startNode?.parentElement;

  while (current && current !== container) {
    const hasSpeaker = current.querySelector(SPEAKER_SELECTOR);
    const hasText = current.querySelector(TEXT_SELECTOR);
    if (hasSpeaker && hasText) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}

function collectTextFromNode(node) {
  if (!node) return '';

  const textElements = Array.from(node.querySelectorAll(TEXT_SELECTOR));
  if (textElements.length === 0) {
    return node.textContent?.trim() || '';
  }

  const parts = textElements.map((element) => element.textContent?.trim() || '').filter(Boolean);

  return Array.from(new Set(parts)).join(' ').replace(/\s+/g, ' ').trim();
}

function extractLatestCaption(container) {
  const speakerElements = Array.from(container.querySelectorAll(SPEAKER_SELECTOR)).filter(
    (element) => element.textContent?.trim()
  );

  if (speakerElements.length > 0) {
    const latestSpeakerElement = speakerElements[speakerElements.length - 1];
    const row = findCaptionRow(latestSpeakerElement, container);
    const speaker = normalizeSpeakerName(latestSpeakerElement.textContent?.trim() || '');
    const text = collectTextFromNode(row || container);

    if (text) {
      return {
        speaker,
        speakerId: buildSpeakerId(speaker),
        text,
      };
    }
  }

  const fallbackText = collectTextFromNode(container);
  if (!fallbackText) {
    return null;
  }

  const fallbackSpeakerElement = container.querySelector(SPEAKER_SELECTOR);
  const fallbackSpeaker = normalizeSpeakerName(
    fallbackSpeakerElement?.textContent?.trim() || 'Unknown'
  );

  return {
    speaker: fallbackSpeaker,
    speakerId: buildSpeakerId(fallbackSpeaker),
    text: fallbackText,
  };
}

function notifyStats() {
  chrome.runtime.sendMessage({
    type: 'CAPTION_STATS',
    data: {
      totalEvents: sequenceNumber,
      bufferSize: captionBuffer.length,
      hasDraft: Boolean(currentDraft),
      draftSpeaker: currentDraft?.speaker || null,
    },
  });
}

function flushBuffer() {
  if (captionBuffer.length === 0) return;

  const batch = [...captionBuffer];
  captionBuffer = [];

  chrome.runtime.sendMessage({
    type: 'TRANSCRIPT_BATCH',
    data: { events: batch },
  });

  notifyStats();
}

function finalizeDraft() {
  if (!currentDraft || !currentDraft.text) return;

  if (
    lastCommittedCaption &&
    lastCommittedCaption.speaker === currentDraft.speaker &&
    lastCommittedCaption.text === currentDraft.text
  ) {
    currentDraft = null;
    notifyStats();
    return;
  }

  sequenceNumber += 1;

  const event = {
    speaker: currentDraft.speaker,
    speakerId: currentDraft.speakerId,
    content: currentDraft.text,
    sequenceNumber,
    isFinal: true,
    capturedAt: new Date().toISOString(),
  };

  captionBuffer.push(event);
  lastCommittedCaption = {
    speaker: currentDraft.speaker,
    text: currentDraft.text,
  };
  currentDraft = null;

  if (captionBuffer.length >= MAX_BATCH_SIZE) {
    flushBuffer();
  } else {
    notifyStats();
  }
}

function resetDraftTimer() {
  if (draftCommitTimeout) {
    clearTimeout(draftCommitTimeout);
  }

  draftCommitTimeout = setTimeout(() => {
    finalizeDraft();
  }, DRAFT_IDLE_MS);
}

function startDraft(snapshot) {
  currentDraft = {
    speaker: snapshot.speaker,
    speakerId: snapshot.speakerId,
    text: snapshot.text,
  };
  resetDraftTimer();
  notifyStats();
}

function handleObservedCaption(snapshot) {
  if (!snapshot || !snapshot.text) return;

  if (!currentDraft) {
    startDraft(snapshot);
    return;
  }

  if (snapshot.speaker === currentDraft.speaker) {
    if (snapshot.text === currentDraft.text) {
      resetDraftTimer();
      return;
    }

    if (snapshot.text.startsWith(currentDraft.text)) {
      currentDraft = {
        ...currentDraft,
        text: snapshot.text,
      };
      resetDraftTimer();
      notifyStats();
      return;
    }

    if (currentDraft.text.startsWith(snapshot.text)) {
      resetDraftTimer();
      return;
    }

    finalizeDraft();
    startDraft(snapshot);
    return;
  }

  finalizeDraft();
  startDraft(snapshot);
}

function scheduleScan(container) {
  if (scanScheduled) return;

  scanScheduled = true;
  requestAnimationFrame(() => {
    scanScheduled = false;
    const snapshot = extractLatestCaption(container);
    handleObservedCaption(snapshot);
  });
}

/* ───────────────────────────────────────────
   Observer Setup
   ─────────────────────────────────────────── */
function startObserving(retryCount = 0) {
  const container = findCaptionContainer();

  if (!container) {
    console.log('[Meeting AI] Caption container not found — retrying in 3s...');
    observerRetryTimeout = setTimeout(() => startObserving(retryCount + 1), 3000);
    return;
  }

  console.log('[Meeting AI] Found caption container, starting observation');

  observer = new MutationObserver(() => {
    scheduleScan(container);
  });

  observer.observe(container, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  scheduleScan(container);
  flushInterval = setInterval(flushBuffer, BUFFER_FLUSH_MS);
  isCapturing = true;

  chrome.runtime.sendMessage({ type: 'CAPTURE_STARTED' });
}

function stopObserving() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }

  if (observerRetryTimeout) {
    clearTimeout(observerRetryTimeout);
    observerRetryTimeout = null;
  }

  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }

  if (draftCommitTimeout) {
    clearTimeout(draftCommitTimeout);
    draftCommitTimeout = null;
  }

  finalizeDraft();
  flushBuffer();

  isCapturing = false;
  scanScheduled = false;

  console.log('[Meeting AI] Caption observation stopped');

  chrome.runtime.sendMessage({
    type: 'CAPTURE_STOPPED',
    data: { totalEvents: sequenceNumber },
  });
}

/* ───────────────────────────────────────────
   Captions Button Auto-Enable
   ─────────────────────────────────────────── */
function tryEnableCaptions() {
  const captionBtnSelectors = [
    '[aria-label*="captions" i]',
    '[aria-label*="subtitle" i]',
    '[data-tooltip*="captions" i]',
    'button[jsname="r8qRAd"]',
  ];

  for (const selector of captionBtnSelectors) {
    const btn = document.querySelector(selector);
    if (!btn) continue;

    const isActive =
      btn.getAttribute('aria-pressed') === 'true' || btn.classList.contains('Hh2bgf');

    if (!isActive) {
      console.log('[Meeting AI] Enabling captions...');
      btn.click();
    } else {
      console.log('[Meeting AI] Captions already enabled');
    }

    return true;
  }

  console.log('[Meeting AI] Caption button not found — user may need to enable manually');
  return false;
}

/* ───────────────────────────────────────────
   Message Handling from Background
   ─────────────────────────────────────────── */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'START_CAPTURE':
      console.log('[Meeting AI] Received START_CAPTURE command');
      sequenceNumber = 0;
      captionBuffer = [];
      currentDraft = null;
      lastCommittedCaption = null;

      tryEnableCaptions();
      setTimeout(() => startObserving(), 2000);

      sendResponse({ success: true });
      break;

    case 'STOP_CAPTURE':
      console.log('[Meeting AI] Received STOP_CAPTURE command');
      stopObserving();
      sendResponse({ success: true, totalEvents: sequenceNumber });
      break;

    case 'GET_STATUS':
      sendResponse({
        isCapturing,
        totalEvents: sequenceNumber,
        bufferSize: captionBuffer.length,
        draftSpeaker: currentDraft?.speaker || null,
        pageUrl: window.location.href,
      });
      break;

    default:
      break;
  }

  return true;
});

/* ───────────────────────────────────────────
   Page Detection
   ─────────────────────────────────────────── */
function isInMeeting() {
  const url = window.location.href;
  return url.includes('meet.google.com/') && !url.endsWith('meet.google.com/');
}

if (isInMeeting()) {
  chrome.runtime.sendMessage({
    type: 'MEET_PAGE_DETECTED',
    data: { url: window.location.href },
  });
}

console.log('[Meeting AI] Content script loaded on Google Meet page');
