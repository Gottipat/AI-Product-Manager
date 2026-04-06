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
  let scanScheduled = false;
  let sequenceNumber = 0;
  let captionBuffer = [];
  let activeDrafts = new Map();
  let lastCommittedBySpeaker = new Map();
  let recentPreviewLines = [];

  const BUFFER_FLUSH_MS = 1500;
  const DRAFT_IDLE_MS = 2600;
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
      const firstToken = escapeRegExp(speaker.split(/\s+/)[0] || speaker);
      sanitized = sanitized
        .replace(new RegExp(`^${escapedSpeaker}\\s*[:\\-–—]\\s*`, 'i'), '')
        .replace(new RegExp(`^${escapedSpeaker}\\s+(?=[A-Z])`, 'i'), '')
        .replace(new RegExp(`^${escapedSpeaker}(?=[A-Z])`, 'i'), '')
        .replace(new RegExp(`^${firstToken}\\s+(?=[A-Z])`, 'i'), '')
        .trim();
    }

    return sanitized.replace(/\s+/g, ' ').trim();
  }

  function canonicalizeCaptionText(text) {
    return text
      .toLowerCase()
      .replace(/[.,!?;:()[\]{}"'`_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
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

  function findCaptionRowForSpeakerElement(speakerElement, container) {
    let current =
      speakerElement instanceof Element ? speakerElement : speakerElement?.parentElement;
    let bestMatch = null;

    while (current && current !== container) {
      const visibleTextLength = readVisibleText(current).length;
      const speakerCount = getSpeakerCount(current);
      const textElementCount = getTextElementCount(current);

      if (
        speakerCount === 1 &&
        textElementCount >= 1 &&
        textElementCount <= 6 &&
        visibleTextLength > 0 &&
        visibleTextLength < 320
      ) {
        bestMatch = current;
      }

      if (speakerCount > 1 || visibleTextLength > 420) {
        break;
      }

      current = current.parentElement;
    }

    return bestMatch;
  }

  function getPrimarySpeakerFromRow(row) {
    if (!row) {
      return 'Unknown';
    }

    const speakerElements = [
      ...(row.matches?.(SPEAKER_SELECTOR) ? [row] : []),
      ...row.querySelectorAll(SPEAKER_SELECTOR),
    ];

    for (const element of speakerElements) {
      const candidate = normalizeSpeakerName(readVisibleText(element));
      if (isLikelySpeakerName(candidate)) {
        return candidate;
      }
    }

    return 'Unknown';
  }

  function buildRowFingerprint(row, speaker) {
    if (!row) {
      return `${buildSpeakerId(speaker)}:unknown-row`;
    }

    if (!row.dataset.meetingAiRowId) {
      row.dataset.meetingAiRowId = `row-${Math.random().toString(36).slice(2, 10)}`;
    }

    return `${buildSpeakerId(speaker)}:${row.dataset.meetingAiRowId}`;
  }

  function extractCaptionFromRow(row) {
    const speaker = getPrimarySpeakerFromRow(row);
    const text = sanitizeCaptionText(collectTextFromNode(row), speaker);

    if (!text) {
      return null;
    }

    return {
      speaker,
      speakerId: buildSpeakerId(speaker),
      rowFingerprint: buildRowFingerprint(row, speaker),
      text,
    };
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
      rowFingerprint: buildRowFingerprint(row || textElement.parentElement, speaker),
      text,
    };
  }

  function collectCaptionRows(container) {
    const rows = [];
    const seenRowFingerprints = new Set();
    const speakerElements = Array.from(container.querySelectorAll(SPEAKER_SELECTOR)).filter(
      (element) => isLikelySpeakerName(readVisibleText(element))
    );

    for (const speakerElement of speakerElements) {
      const row = findCaptionRowForSpeakerElement(speakerElement, container);
      if (!row) {
        continue;
      }

      const snapshot = extractCaptionFromRow(row);
      if (!snapshot) {
        continue;
      }

      if (seenRowFingerprints.has(snapshot.rowFingerprint)) {
        continue;
      }

      seenRowFingerprints.add(snapshot.rowFingerprint);
      rows.push(snapshot);
    }

    if (rows.length > 0) {
      return rows;
    }

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

  function textsLikelyMatch(previousText, nextText) {
    const previousCanonical = canonicalizeCaptionText(previousText);
    const nextCanonical = canonicalizeCaptionText(nextText);

    if (!previousCanonical || !nextCanonical) {
      return false;
    }

    return (
      nextCanonical === previousCanonical ||
      nextCanonical.startsWith(previousCanonical) ||
      previousCanonical.startsWith(nextCanonical)
    );
  }

  function pickPreferredText(previousText, nextText) {
    const previousCanonical = canonicalizeCaptionText(previousText);
    const nextCanonical = canonicalizeCaptionText(nextText);

    if (nextCanonical.startsWith(previousCanonical)) {
      return nextText.length >= previousText.length ? nextText : previousText;
    }

    if (previousCanonical.startsWith(nextCanonical)) {
      return previousText.length >= nextText.length ? previousText : nextText;
    }

    return nextText.length >= previousText.length ? nextText : previousText;
  }

  function stripKnownHistory(text, referenceText) {
    if (!text || !referenceText) {
      return text;
    }

    if (text === referenceText) {
      return '';
    }

    if (text.startsWith(referenceText)) {
      return text.slice(referenceText.length).trim();
    }

    const index = text.indexOf(referenceText);
    if (index >= 0) {
      return text.slice(index + referenceText.length).trim();
    }

    return text;
  }

  function getPreviewDraft() {
    const drafts = Array.from(activeDrafts.values()).sort(
      (left, right) => right.lastSeenAt - left.lastSeenAt
    );
    const latestDraft = drafts[0];

    if (!latestDraft) {
      return null;
    }

    return {
      speaker: latestDraft.speaker,
      content: latestDraft.text,
    };
  }

  function notifyStats() {
    const previewDraft = getPreviewDraft();

    chrome.runtime.sendMessage({
      type: 'CAPTION_STATS',
      data: {
        totalEvents: sequenceNumber,
        bufferSize: captionBuffer.length,
        hasDraft: activeDrafts.size > 0,
        draftSpeaker: previewDraft?.speaker || null,
      },
    });
  }

  function notifyPreview(finalEvent = null) {
    chrome.runtime.sendMessage({
      type: 'TRANSCRIPT_PREVIEW',
      data: {
        recentLines: recentPreviewLines,
        finalEvent,
        draft: getPreviewDraft(),
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

  function finalizeDraft(speakerKey) {
    const draft = activeDrafts.get(speakerKey);
    if (!draft || !draft.text) return;

    const lastCommitted = lastCommittedBySpeaker.get(speakerKey);
    if (lastCommitted && lastCommitted.text === draft.text) {
      activeDrafts.delete(speakerKey);
      notifyStats();
      notifyPreview();
      return;
    }

    sequenceNumber += 1;

    const event = {
      speaker: draft.speaker,
      speakerId: draft.speakerId,
      content: draft.text,
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
    lastCommittedBySpeaker.set(speakerKey, {
      speaker: draft.speaker,
      text: draft.text,
    });
    activeDrafts.delete(speakerKey);
    notifyPreview(event);

    if (captionBuffer.length >= MAX_BATCH_SIZE) {
      flushBuffer();
    } else {
      notifyStats();
    }
  }

  function finalizeStaleDrafts(force = false, now = Date.now()) {
    for (const [speakerKey, draft] of activeDrafts.entries()) {
      if (force || now - draft.lastSeenAt >= DRAFT_IDLE_MS) {
        finalizeDraft(speakerKey);
      }
    }
  }

  function upsertDraft(snapshot, now = Date.now()) {
    if (!snapshot?.text) return;

    const speakerKey =
      snapshot.rowFingerprint || snapshot.speakerId || buildSpeakerId(snapshot.speaker);
    const existingDraft = activeDrafts.get(speakerKey);
    const lastCommitted = lastCommittedBySpeaker.get(speakerKey);

    let nextText = stripKnownHistory(snapshot.text, lastCommitted?.text || '');
    if (!nextText) {
      return;
    }

    if (!existingDraft) {
      activeDrafts.set(speakerKey, {
        speaker: snapshot.speaker,
        speakerId: speakerKey,
        text: nextText,
        lastSeenAt: now,
      });
      notifyStats();
      notifyPreview();
      return;
    }

    if (textsLikelyMatch(existingDraft.text, nextText)) {
      const preferredSpeaker = pickPreferredSpeaker(existingDraft.speaker, snapshot.speaker);
      activeDrafts.set(speakerKey, {
        ...existingDraft,
        speaker: preferredSpeaker,
        speakerId: buildSpeakerId(preferredSpeaker),
        text: pickPreferredText(existingDraft.text, nextText),
        lastSeenAt: now,
      });
      notifyStats();
      notifyPreview();
      return;
    }

    finalizeDraft(speakerKey);

    nextText = stripKnownHistory(nextText, lastCommittedBySpeaker.get(speakerKey)?.text || '');
    if (!nextText) {
      return;
    }

    activeDrafts.set(speakerKey, {
      speaker: snapshot.speaker,
      speakerId: speakerKey,
      text: nextText,
      lastSeenAt: now,
    });
    notifyStats();
    notifyPreview();
  }

  function handleObservedCaptions(snapshots) {
    if (!snapshots || snapshots.length === 0) {
      finalizeStaleDrafts();
      return;
    }

    const now = Date.now();
    for (const snapshot of snapshots) {
      upsertDraft(snapshot, now);
    }

    finalizeStaleDrafts(false, now);
  }

  function scheduleScan(container) {
    if (scanScheduled) return;

    scanScheduled = true;
    requestAnimationFrame(() => {
      scanScheduled = false;
      const snapshots = collectCaptionRows(container);
      handleObservedCaptions(snapshots);
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
    flushInterval = setInterval(() => {
      finalizeStaleDrafts();
      flushBuffer();
    }, BUFFER_FLUSH_MS);
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

    finalizeStaleDrafts(true);
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
        activeDrafts = new Map();
        lastCommittedBySpeaker = new Map();
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
          draftSpeaker: getPreviewDraft()?.speaker || null,
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
