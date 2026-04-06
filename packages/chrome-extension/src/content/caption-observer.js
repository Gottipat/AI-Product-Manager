/**
 * @fileoverview Content Script — Google Meet Caption Observer
 * @description Injected into Google Meet pages. Observes the DOM for live captions,
 *   normalizes speaker names, segments cleaner utterances, and forwards finalized
 *   transcript events to the background service worker.
 */

if (globalThis.__meetingAiContentObserverInstalled) {
  console.log('[Meeting AI] Content script already initialized on this page');
} else {
  globalThis.__meetingAiContentObserverInstalled = true;

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
  const UI_NOISE_PATTERNS = [
    /\barrow_downward\b/gi,
    /\bJump to bottom\b/gi,
    /\bkeyboard_arrow_down\b/gi,
    /\bmore_vert\b/gi,
  ];

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
  let recentPreviewLines = [];

  const BUFFER_FLUSH_MS = 4000;
  const DRAFT_IDLE_MS = 1400;
  const MAX_BATCH_SIZE = 20;
  const MAX_PREVIEW_LINES = 6;

  /* ───────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────── */
  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function readVisibleText(node) {
    if (!node) return '';

    if (typeof node.innerText === 'string' && node.innerText.trim()) {
      return node.innerText.trim();
    }

    return node.textContent?.trim() || '';
  }

  function containsUiNoise(text) {
    return UI_NOISE_PATTERNS.some((pattern) => {
      pattern.lastIndex = 0;
      return pattern.test(text);
    });
  }

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

  function isLikelySpeakerName(name) {
    const normalized = normalizeSpeakerName(name);

    if (!normalized || normalized === 'Unknown') {
      return false;
    }

    if (normalized.length < 3 || normalized.length > 60) {
      return false;
    }

    if (/[?!,:;()[\]{}]/.test(normalized)) {
      return false;
    }

    if (normalized.split(/\s+/).length > 5) {
      return false;
    }

    return !containsUiNoise(normalized);
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

  function sanitizeCaptionText(text, speaker = null) {
    if (!text) return '';

    let sanitized = text.replace(/\s+/g, ' ').trim();

    for (const pattern of UI_NOISE_PATTERNS) {
      pattern.lastIndex = 0;
      sanitized = sanitized.replace(pattern, ' ');
    }

    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    if (!sanitized) {
      return '';
    }

    if (speaker && speaker !== 'Unknown') {
      const escapedSpeaker = escapeRegExp(speaker);
      sanitized = sanitized
        .replace(new RegExp(`^${escapedSpeaker}\\s*[:\\-–—]\\s*`, 'i'), '')
        .replace(new RegExp(`^${escapedSpeaker}(?=[A-Z])`, 'i'), '')
        .trim();
    }

    return sanitized.replace(/\s+/g, ' ').trim();
  }

  function getSpeakerCount(node) {
    const speakerElements = [
      ...(node.matches?.(SPEAKER_SELECTOR) ? [node] : []),
      ...node.querySelectorAll(SPEAKER_SELECTOR),
    ];

    return new Set(
      speakerElements
        .map((element) => normalizeSpeakerName(readVisibleText(element)))
        .filter((candidate) => isLikelySpeakerName(candidate))
    ).size;
  }

  function getTextElementCount(node) {
    const ownMatch = node.matches?.(TEXT_SELECTOR) ? 1 : 0;
    return ownMatch + node.querySelectorAll(TEXT_SELECTOR).length;
  }

  function findCaptionRow(startNode, container) {
    let current = startNode instanceof Element ? startNode : startNode?.parentElement;
    let fallback = null;

    while (current && current !== container) {
      const hasSpeaker =
        current.matches?.(SPEAKER_SELECTOR) || Boolean(current.querySelector(SPEAKER_SELECTOR));
      const hasText =
        current.matches?.(TEXT_SELECTOR) || Boolean(current.querySelector(TEXT_SELECTOR));
      const visibleTextLength = readVisibleText(current).length;
      const speakerCount = getSpeakerCount(current);
      const textElementCount = getTextElementCount(current);

      if (
        !fallback &&
        hasText &&
        speakerCount <= 1 &&
        textElementCount <= 3 &&
        visibleTextLength > 0 &&
        visibleTextLength < 220
      ) {
        fallback = current;
      }

      if (
        hasSpeaker &&
        hasText &&
        speakerCount === 1 &&
        textElementCount >= 1 &&
        textElementCount <= 4 &&
        visibleTextLength > 0 &&
        visibleTextLength < 260
      ) {
        return current;
      }

      if (
        hasText &&
        speakerCount <= 1 &&
        textElementCount <= 2 &&
        visibleTextLength > 0 &&
        visibleTextLength < 180
      ) {
        fallback = current;
      }

      current = current.parentElement;
    }

    return fallback;
  }

  function resolveSpeakerForTextElement(textElement, row, container) {
    const candidateElements = [];

    if (row) {
      candidateElements.push(...row.querySelectorAll(SPEAKER_SELECTOR));
    }

    let current = textElement.parentElement;
    while (current && current !== container) {
      const withinCurrent = Array.from(current.querySelectorAll(SPEAKER_SELECTOR));
      if (withinCurrent.length > 0) {
        candidateElements.push(...withinCurrent);
      }
      current = current.parentElement;
    }

    for (const element of candidateElements) {
      const candidate = normalizeSpeakerName(readVisibleText(element));
      if (isLikelySpeakerName(candidate)) {
        return candidate;
      }
    }

    const allSpeakerElements = Array.from(container.querySelectorAll(SPEAKER_SELECTOR));
    let fallbackSpeaker = null;

    for (const element of allSpeakerElements) {
      const candidate = normalizeSpeakerName(readVisibleText(element));
      if (!isLikelySpeakerName(candidate)) {
        continue;
      }

      if (textElement === container) {
        fallbackSpeaker = candidate;
        continue;
      }

      const position = element.compareDocumentPosition(textElement);
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
        fallbackSpeaker = candidate;
      }
    }

    return fallbackSpeaker || 'Unknown';
  }

  function extractCaptionFromTextElement(textElement, container) {
    const row = findCaptionRow(textElement, container);
    const speaker = resolveSpeakerForTextElement(textElement, row, container);
    const text = sanitizeCaptionText(collectTextFromNode(row || textElement), speaker);

    if (!text) {
      return null;
    }

    return {
      speaker,
      speakerId: buildSpeakerId(speaker),
      text,
    };
  }

  function collectCaptionRows(container) {
    const rows = [];
    const seenSnapshots = new Set();
    const textElements = Array.from(container.querySelectorAll(TEXT_SELECTOR)).filter((element) =>
      readVisibleText(element)
    );

    for (const textElement of textElements) {
      const snapshot = extractCaptionFromTextElement(textElement, container);
      if (!snapshot) {
        continue;
      }

      const snapshotKey = `${snapshot.speaker}|${snapshot.text}`;
      if (seenSnapshots.has(snapshotKey)) {
        continue;
      }

      seenSnapshots.add(snapshotKey);
      rows.push(snapshot);
    }

    return rows;
  }

  function collectTextFromNode(node) {
    if (!node) return '';

    const textElements = Array.from(node.querySelectorAll(TEXT_SELECTOR));
    if (textElements.length === 0) {
      return sanitizeCaptionText(readVisibleText(node));
    }

    const parts = textElements
      .map((element) => sanitizeCaptionText(readVisibleText(element)))
      .filter(Boolean);

    return parts
      .filter(
        (part, index, allParts) =>
          !allParts.some(
            (candidate, candidateIndex) =>
              candidateIndex !== index && candidate.length > part.length && candidate.includes(part)
          )
      )
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractLatestCaption(container) {
    const captionRows = collectCaptionRows(container);
    if (captionRows.length > 0) {
      return captionRows[captionRows.length - 1];
    }

    const fallbackText = collectTextFromNode(container);
    if (!fallbackText) {
      return null;
    }

    const fallbackSpeaker = resolveSpeakerForTextElement(container, null, container);

    return {
      speaker: fallbackSpeaker,
      speakerId: buildSpeakerId(fallbackSpeaker),
      text: sanitizeCaptionText(fallbackText, fallbackSpeaker),
    };
  }

  function speakersLikelyMatch(left, right) {
    const normalizedLeft = normalizeSpeakerName(left);
    const normalizedRight = normalizeSpeakerName(right);

    if (normalizedLeft === normalizedRight) {
      return true;
    }

    if (
      normalizedLeft !== 'Unknown' &&
      normalizedRight !== 'Unknown' &&
      (normalizedLeft.startsWith(normalizedRight) || normalizedRight.startsWith(normalizedLeft))
    ) {
      return true;
    }

    return false;
  }

  function pickPreferredSpeaker(currentSpeaker, nextSpeaker) {
    const normalizedCurrent = normalizeSpeakerName(currentSpeaker);
    const normalizedNext = normalizeSpeakerName(nextSpeaker);

    if (normalizedCurrent === 'Unknown') {
      return normalizedNext;
    }

    if (normalizedNext === 'Unknown') {
      return normalizedCurrent;
    }

    return normalizedNext.length >= normalizedCurrent.length ? normalizedNext : normalizedCurrent;
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

  function notifyPreview(finalEvent = null) {
    chrome.runtime.sendMessage({
      type: 'TRANSCRIPT_PREVIEW',
      data: {
        recentLines: recentPreviewLines,
        finalEvent,
        draft: currentDraft
          ? {
              speaker: currentDraft.speaker,
              content: currentDraft.text,
            }
          : null,
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
      notifyPreview();
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
    recentPreviewLines.push({
      speaker: event.speaker,
      content: event.content,
      capturedAt: event.capturedAt,
    });
    recentPreviewLines = recentPreviewLines.slice(-MAX_PREVIEW_LINES);
    lastCommittedCaption = {
      speaker: currentDraft.speaker,
      text: currentDraft.text,
    };
    currentDraft = null;
    notifyPreview(event);

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
    notifyPreview();
  }

  function handleObservedCaption(snapshot) {
    if (!snapshot || !snapshot.text) return;

    if (!currentDraft) {
      startDraft(snapshot);
      return;
    }

    if (speakersLikelyMatch(snapshot.speaker, currentDraft.speaker)) {
      if (snapshot.text === currentDraft.text) {
        resetDraftTimer();
        return;
      }

      if (snapshot.text.startsWith(currentDraft.text)) {
        currentDraft = {
          ...currentDraft,
          speaker: pickPreferredSpeaker(currentDraft.speaker, snapshot.speaker),
          speakerId: buildSpeakerId(pickPreferredSpeaker(currentDraft.speaker, snapshot.speaker)),
          text: snapshot.text,
        };
        resetDraftTimer();
        notifyStats();
        notifyPreview();
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
        recentPreviewLines = [];

        tryEnableCaptions();
        setTimeout(() => startObserving(), 2000);

        notifyPreview();

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
}
