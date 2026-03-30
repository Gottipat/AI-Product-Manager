/**
 * @fileoverview Content Script — Google Meet Caption Observer
 * @description Injected into Google Meet pages. Observes the DOM for live captions,
 *   deduplicates them, buffers events, and forwards to the background service worker.
 *
 * Reuses the same DOM selectors proven in bot-runner/src/captions/parser.ts
 */

/* ───────────────────────────────────────────
   DOM Selectors (same as bot-runner)
   ─────────────────────────────────────────── */
const SELECTORS = {
    captionContainers: ['.iS70S', '[jsname="dsyhDe"]', '.iOzk7', '[class*="a4cQT"]'],
    captionTexts: ['.McS7S', '[class*="TBMuR"]', '.CNusmb'],
    speakerNames: ['.VpS7S', '[class*="zs7s8d"]', '.KcIKyf'],
};

/* ───────────────────────────────────────────
   State
   ─────────────────────────────────────────── */
let isCapturing = false;
let observer = null;
let lastSpeaker = '';
let lastText = '';
let sequenceNumber = 0;
let captionBuffer = [];
let flushInterval = null;

const BUFFER_FLUSH_MS = 5000; // flush every 5 seconds
const MAX_BATCH_SIZE = 20;

/* ───────────────────────────────────────────
   Caption Container Discovery
   ─────────────────────────────────────────── */
function findCaptionContainer() {
    for (const selector of SELECTORS.captionContainers) {
        const el = document.querySelector(selector);
        if (el) return el;
    }
    return null;
}

function extractSpeaker(container) {
    const combinedSelector = SELECTORS.speakerNames.join(', ');
    const elements = container.querySelectorAll(combinedSelector);
    if (elements.length > 0) {
        const last = elements[elements.length - 1];
        return last?.textContent?.trim() || 'Unknown';
    }
    return 'Unknown';
}

function extractText(container) {
    const combinedSelector = SELECTORS.captionTexts.join(', ');
    const elements = container.querySelectorAll(combinedSelector);
    if (elements.length > 0) {
        const last = elements[elements.length - 1];
        return last?.textContent?.trim() || '';
    }
    return '';
}

/* ───────────────────────────────────────────
   Caption Extraction + Deduplication
   ─────────────────────────────────────────── */
function handleCaptionMutation(container) {
    const speaker = extractSpeaker(container);
    const text = extractText(container);

    if (!text) return;

    // Exact duplicate — skip
    if (speaker === lastSpeaker && text === lastText) return;

    // Detect continuation (same speaker, text starts with previous text)
    const isContinuation = speaker === lastSpeaker && text.startsWith(lastText);

    lastSpeaker = speaker;
    lastText = text;

    sequenceNumber++;

    const event = {
        speaker,
        content: text,
        sequenceNumber,
        isFinal: !isContinuation,
        capturedAt: new Date().toISOString(),
    };

    captionBuffer.push(event);

    // Flush if buffer is full
    if (captionBuffer.length >= MAX_BATCH_SIZE) {
        flushBuffer();
    }

    // Notify background of live stats
    chrome.runtime.sendMessage({
        type: 'CAPTION_STATS',
        data: { totalEvents: sequenceNumber, bufferSize: captionBuffer.length },
    });
}

/* ───────────────────────────────────────────
   Buffer Flushing
   ─────────────────────────────────────────── */
function flushBuffer() {
    if (captionBuffer.length === 0) return;

    const batch = [...captionBuffer];
    captionBuffer = [];

    chrome.runtime.sendMessage({
        type: 'TRANSCRIPT_BATCH',
        data: { events: batch },
    });
}

/* ───────────────────────────────────────────
   Observer Setup
   ─────────────────────────────────────────── */
function startObserving() {
    const container = findCaptionContainer();

    if (!container) {
        console.log('[Meeting AI] Caption container not found — retrying in 3s...');
        setTimeout(startObserving, 3000);
        return;
    }

    console.log('[Meeting AI] ✅ Found caption container, starting observation');

    observer = new MutationObserver(() => {
        handleCaptionMutation(container);
    });

    observer.observe(container, {
        childList: true,
        subtree: true,
        characterData: true,
    });

    // Initial extraction
    handleCaptionMutation(container);

    // Periodic buffer flush
    flushInterval = setInterval(flushBuffer, BUFFER_FLUSH_MS);

    isCapturing = true;

    chrome.runtime.sendMessage({ type: 'CAPTURE_STARTED' });
}

function stopObserving() {
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    if (flushInterval) {
        clearInterval(flushInterval);
        flushInterval = null;
    }

    // Final flush
    flushBuffer();

    isCapturing = false;
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
    // Google Meet caption toggle button selectors
    const captionBtnSelectors = [
        '[aria-label*="captions" i]',
        '[aria-label*="subtitle" i]',
        '[data-tooltip*="captions" i]',
        'button[jsname="r8qRAd"]',
    ];

    for (const selector of captionBtnSelectors) {
        const btn = document.querySelector(selector);
        if (btn) {
            // Check if captions are already enabled by checking aria-pressed or similar
            const isActive =
                btn.getAttribute('aria-pressed') === 'true' ||
                btn.classList.contains('Hh2bgf'); // active state class

            if (!isActive) {
                console.log('[Meeting AI] Enabling captions...');
                btn.click();
                return true;
            } else {
                console.log('[Meeting AI] Captions already enabled');
                return true;
            }
        }
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
            lastSpeaker = '';
            lastText = '';

            // Try to enable captions first
            tryEnableCaptions();

            // Wait a moment for captions to appear, then start observing
            setTimeout(startObserving, 2000);
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
                pageUrl: window.location.href,
            });
            break;

        default:
            break;
    }

    return true; // keep message channel open for async response
});

/* ───────────────────────────────────────────
   Page Detection
   ─────────────────────────────────────────── */
function isInMeeting() {
    // Check if we're in an active Google Meet session (not the landing/lobby page)
    const url = window.location.href;
    return url.includes('meet.google.com/') && !url.endsWith('meet.google.com/');
}

// Notify background that content script is loaded on a Meet page
if (isInMeeting()) {
    chrome.runtime.sendMessage({
        type: 'MEET_PAGE_DETECTED',
        data: { url: window.location.href },
    });
}

console.log('[Meeting AI] Content script loaded on Google Meet page');
