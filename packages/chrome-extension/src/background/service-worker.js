/**
 * @fileoverview Background Service Worker
 * @description Manages API communication with the AI backend.
 *   Receives caption events from the content script, manages meeting lifecycle,
 *   and streams transcript batches to the backend. Supports project-linked meetings.
 */

/* ───────────────────────────────────────────
   State
   ─────────────────────────────────────────── */
let currentMeetingId = null;
let currentProjectId = null;
let backendUrl = 'http://localhost:3002';
let authToken = null;
let totalSentEvents = 0;
let captureActive = false;

/* ───────────────────────────────────────────
   API Client (mirrors bot-runner BackendClient)
   ─────────────────────────────────────────── */
async function apiRequest(method, path, body = null) {
    const url = `${backendUrl}${path}`;
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const options = { method, headers };
    if (body) {
        options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);
    const data = await res.json();

    if (!res.ok) {
        console.error(`[Meeting AI BG] API ${method} ${path} failed:`, data);
        throw new Error(`API ${method} ${path} failed: ${res.status}`);
    }

    return data;
}

async function healthCheck() {
    try {
        const res = await fetch(`${backendUrl}/api/v1/health`, {
            signal: AbortSignal.timeout(5000),
        });
        return res.ok;
    } catch {
        return false;
    }
}

/* ── Project APIs ────────────────────────── */
async function fetchProjects() {
    return apiRequest('GET', '/api/v1/extension/projects');
}

/* ── Meeting APIs ────────────────────────── */
async function createMeeting(title, meetLink, projectId = null) {
    return apiRequest('POST', '/api/v1/extension/meetings', {
        title,
        googleMeetLink: meetLink,
        projectId,
    });
}

async function startMeeting(meetingId) {
    return apiRequest('POST', `/api/v1/meetings/${meetingId}/start`, {});
}

async function sendTranscriptBatch(meetingId, events) {
    return apiRequest('POST', `/api/v1/meetings/${meetingId}/transcripts/batch`, {
        events,
    });
}

async function completeMeeting(meetingId) {
    return apiRequest('POST', `/api/v1/meetings/${meetingId}/complete`, {});
}

async function triggerMoM(meetingId) {
    return apiRequest('POST', `/api/v1/meetings/${meetingId}/generate-mom`, {});
}

async function triggerExtractItems(meetingId) {
    return apiRequest('POST', `/api/v1/meetings/${meetingId}/extract-items`, {});
}

/* ───────────────────────────────────────────
   Meeting Lifecycle
   ─────────────────────────────────────────── */
async function handleStartCapture(meetUrl, tabId, projectId = null) {
    try {
        // Load settings
        const settings = await chrome.storage.local.get(['backendUrl', 'authToken']);
        if (settings.backendUrl) backendUrl = settings.backendUrl;
        if (settings.authToken) authToken = settings.authToken;

        // Health check
        const healthy = await healthCheck();
        if (!healthy) {
            throw new Error('Backend is not reachable. Make sure it is running.');
        }

        // Create meeting in backend (linked to project if selected)
        const title = `Extension Capture — ${new Date().toLocaleString()}`;
        const { meeting } = await createMeeting(title, meetUrl, projectId);
        currentMeetingId = meeting.id;
        currentProjectId = projectId;
        totalSentEvents = 0;
        captureActive = true;

        console.log(`[Meeting AI BG] Meeting created: ${currentMeetingId} (project: ${projectId || 'none'})`);

        // Start meeting
        await startMeeting(currentMeetingId);

        // Save state
        await chrome.storage.local.set({
            currentMeetingId,
            currentProjectId: projectId,
            captureActive: true,
            meetUrl,
            captureStartedAt: Date.now(),
        });

        // Tell content script to start capturing
        chrome.tabs.sendMessage(tabId, { type: 'START_CAPTURE' });

        return { success: true, meetingId: currentMeetingId };
    } catch (error) {
        console.error('[Meeting AI BG] Failed to start capture:', error);
        captureActive = false;
        return { success: false, error: error.message };
    }
}

async function handleStopCapture(tabId) {
    try {
        // Tell content script to stop
        if (tabId) {
            chrome.tabs.sendMessage(tabId, { type: 'STOP_CAPTURE' });
        }

        // Complete meeting in backend
        if (currentMeetingId) {
            await completeMeeting(currentMeetingId);
            console.log(`[Meeting AI BG] Meeting completed: ${currentMeetingId}`);

            // Trigger AI processing
            try {
                await triggerMoM(currentMeetingId);
                console.log('[Meeting AI BG] MoM generation triggered');
            } catch (e) {
                console.warn('[Meeting AI BG] MoM generation failed:', e.message);
            }

            try {
                await triggerExtractItems(currentMeetingId);
                console.log('[Meeting AI BG] Item extraction triggered');
            } catch (e) {
                console.warn('[Meeting AI BG] Item extraction failed:', e.message);
            }
        }

        captureActive = false;
        const completedMeetingId = currentMeetingId;
        currentMeetingId = null;
        currentProjectId = null;

        await chrome.storage.local.set({
            currentMeetingId: null,
            currentProjectId: null,
            captureActive: false,
        });

        return { success: true, meetingId: completedMeetingId, totalSentEvents };
    } catch (error) {
        console.error('[Meeting AI BG] Failed to stop capture:', error);
        return { success: false, error: error.message };
    }
}

/* ───────────────────────────────────────────
   Message Handling
   ─────────────────────────────────────────── */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const tabId = sender.tab?.id;

    switch (message.type) {
        /* ── From content script ─────────────── */
        case 'TRANSCRIPT_BATCH':
            if (currentMeetingId && message.data?.events?.length > 0) {
                sendTranscriptBatch(currentMeetingId, message.data.events)
                    .then(() => {
                        totalSentEvents += message.data.events.length;
                        console.log(
                            `[Meeting AI BG] Batch sent: ${message.data.events.length} events (total: ${totalSentEvents})`
                        );
                    })
                    .catch((err) => {
                        console.error('[Meeting AI BG] Batch send failed:', err);
                    });
            }
            break;

        case 'CAPTION_STATS':
            // Store latest stats for popup
            chrome.storage.local.set({
                captionStats: {
                    ...message.data,
                    totalSentEvents,
                    lastUpdated: Date.now(),
                },
            });
            break;

        case 'CAPTURE_STARTED':
            console.log('[Meeting AI BG] Content script confirmed capture started');
            break;

        case 'CAPTURE_STOPPED':
            console.log('[Meeting AI BG] Content script confirmed capture stopped');
            break;

        case 'MEET_PAGE_DETECTED':
            console.log('[Meeting AI BG] Google Meet page detected:', message.data?.url);
            chrome.storage.local.set({ meetPageDetected: true, meetUrl: message.data?.url });
            break;

        /* ── From popup ──────────────────────── */
        case 'POPUP_START_CAPTURE':
            (async () => {
                const result = await handleStartCapture(
                    message.data.meetUrl,
                    message.data.tabId,
                    message.data.projectId || null
                );
                sendResponse(result);
            })();
            return true; // async response

        case 'POPUP_STOP_CAPTURE':
            (async () => {
                const result = await handleStopCapture(message.data?.tabId);
                sendResponse(result);
            })();
            return true; // async response

        case 'POPUP_GET_STATUS':
            sendResponse({
                captureActive,
                currentMeetingId,
                currentProjectId,
                totalSentEvents,
                backendUrl,
            });
            break;

        case 'POPUP_HEALTH_CHECK':
            (async () => {
                const settings = await chrome.storage.local.get(['backendUrl']);
                if (settings.backendUrl) backendUrl = settings.backendUrl;
                const healthy = await healthCheck();
                sendResponse({ healthy, backendUrl });
            })();
            return true; // async response

        case 'POPUP_FETCH_PROJECTS':
            (async () => {
                try {
                    const settings = await chrome.storage.local.get(['backendUrl']);
                    if (settings.backendUrl) backendUrl = settings.backendUrl;
                    const result = await fetchProjects();
                    sendResponse({ success: true, projects: result.projects });
                } catch (err) {
                    sendResponse({ success: false, projects: [], error: err.message });
                }
            })();
            return true;

        case 'POPUP_SAVE_SETTINGS':
            (async () => {
                const { backendUrl: newUrl, authToken: newToken } = message.data;
                if (newUrl) {
                    backendUrl = newUrl.replace(/\/$/, '');
                }
                if (newToken !== undefined) {
                    authToken = newToken || null;
                }
                await chrome.storage.local.set({ backendUrl, authToken });
                sendResponse({ success: true });
            })();
            return true;

        default:
            break;
    }
});

/* ───────────────────────────────────────────
   Initialization
   ─────────────────────────────────────────── */
(async () => {
    const settings = await chrome.storage.local.get([
        'backendUrl',
        'authToken',
        'captureActive',
        'currentMeetingId',
        'currentProjectId',
    ]);
    if (settings.backendUrl) backendUrl = settings.backendUrl;
    if (settings.authToken) authToken = settings.authToken;
    if (settings.captureActive) captureActive = settings.captureActive;
    if (settings.currentMeetingId) currentMeetingId = settings.currentMeetingId;
    if (settings.currentProjectId) currentProjectId = settings.currentProjectId;

    console.log('[Meeting AI BG] Service worker initialized', { backendUrl, captureActive });
})();
