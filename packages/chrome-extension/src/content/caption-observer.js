/**
 * @fileoverview Content Script — Google Meet Page Detector
 * @description Injected into Google Meet pages. Detects when the user is in an
 *   active meeting and notifies the background service worker.
 *
 * Transcript extraction is handled server-side via Deepgram AI transcription
 * of the audio stream captured by the offscreen document. This content script
 * no longer performs DOM caption scraping.
 */

let isCapturing = false;

/* ───────────────────────────────────────────
   Logging
   ─────────────────────────────────────────── */
function log(msg) {
    console.log(`[Meeting AI] ${msg}`);
    try {
        chrome.runtime.sendMessage({ type: 'CONTENT_LOG', data: { msg } });
    } catch { /* extension context invalidated */ }
}

/* ───────────────────────────────────────────
   Message Handling from Background
   ─────────────────────────────────────────── */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.type) {
        case 'START_CAPTURE':
            log('Capture started — audio is being transcribed server-side via Deepgram AI');
            isCapturing = true;
            sendResponse({ success: true });
            try {
                chrome.runtime.sendMessage({ type: 'CAPTURE_STARTED' });
            } catch { /* */ }
            break;

        case 'STOP_CAPTURE':
            log('Capture stopped');
            isCapturing = false;
            sendResponse({ success: true, totalEvents: 0 });
            try {
                chrome.runtime.sendMessage({ type: 'CAPTURE_STOPPED', data: { totalEvents: 0 } });
            } catch { /* */ }
            break;

        case 'GET_STATUS':
            sendResponse({
                isCapturing,
                totalEvents: 0,
                bufferSize: 0,
                pageUrl: window.location.href,
            });
            break;

        default:
            break;
    }

    return true; // keep channel open for async response
});

/* ───────────────────────────────────────────
   Page Detection
   ─────────────────────────────────────────── */
function isInMeeting() {
    const url = window.location.href;
    return url.includes('meet.google.com/') && !url.endsWith('meet.google.com/');
}

if (isInMeeting()) {
    try {
        chrome.runtime.sendMessage({
            type: 'MEET_PAGE_DETECTED',
            data: { url: window.location.href },
        });
    } catch { /* context not ready */ }
}

log('Content script loaded — transcript will be extracted from audio via AI');
