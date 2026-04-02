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
let audioActive = false;
let audioTranscripts = 0;

/* ───────────────────────────────────────────
   Auth Token Sync (Auto-login from Dashboard)
   ─────────────────────────────────────────── */
async function syncAuthFromCookies() {
    try {
        // Find auth_token for the backend origin
        const url = new URL(backendUrl);
        const cookie = await chrome.cookies.get({ url: url.origin, name: 'auth_token' });
        
        if (cookie) {
            authToken = cookie.value;
            // Clear any manual token saved from before
            await chrome.storage.local.remove(['authToken']);
            console.log('[Meeting AI BG] Seamless Auth successful from cookie!');
            return true;
        } else {
            authToken = null;
            console.log('[Meeting AI BG] No auth cookie found. Extension logged out.');
            return false;
        }
    } catch (err) {
        console.warn('[Meeting AI BG] Could not read cookies:', err);
        return false;
    }
}

// Listen for login/logout events on the dashboard
chrome.cookies.onChanged.addListener((changeInfo) => {
    const backendOrigin = new URL(backendUrl).origin;
    if (changeInfo.cookie.domain === new URL(backendOrigin).hostname && changeInfo.cookie.name === 'auth_token') {
        syncAuthFromCookies();
    }
});

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
        
        // --- 1. Audio Capture Init ---
        // Must be done early to preserve the user gesture from the popup interaction
        // If this throws, we fail gracefully and still fall back to DOM caption scraping.
        let streamId = null;
        try {
            console.log(`[Meeting AI BG] Requesting MediaStreamId for tab ${tabId}...`);
            streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
            console.log(`[Meeting AI BG] Got MediaStreamId:`, streamId);
        } catch (err) {
            console.warn('[Meeting AI BG] Failed to get tab audio stream (did you click the popup?):', err);
        }

        // Create meeting in backend (linked to project if selected)
        const title = `Extension Capture — ${new Date().toLocaleString()}`;
        const { meeting } = await createMeeting(title, meetUrl, projectId);
        currentMeetingId = meeting.id;
        currentProjectId = projectId;
        totalSentEvents = 0;
        audioTranscripts = 0;
        captureActive = true;
        audioActive = !!streamId;

        console.log(`[Meeting AI BG] Meeting created: ${currentMeetingId} (project: ${projectId || 'none'}) (audio: ${audioActive})`);

        // Start meeting
        await startMeeting(currentMeetingId);

        // Save state
        await chrome.storage.local.set({
            currentMeetingId,
            currentProjectId: projectId,
            captureActive: true,
            audioActive,
            meetUrl,
            captureStartedAt: Date.now(),
        });

        // Tell content script to start capturing (DOM captions)
        chrome.tabs.sendMessage(tabId, { type: 'START_CAPTURE' });

        // Start Audio Capture if we got a streamId
        if (streamId) {
            try {
                await setupOffscreenDocument('src/offscreen/offscreen.html');
                console.log('[Meeting AI BG] Sending START_AUDIO to offscreen...');
                
                // Chrome's runtime messaging to offscreen document
                const response = await chrome.runtime.sendMessage({
                    type: 'START_AUDIO',
                    target: 'offscreen',
                    streamId,
                    meetingId: currentMeetingId,
                    backendUrl
                });
                
                if (response?.success) {
                    console.log('[Meeting AI BG] Audio capture started successfully');
                } else {
                    console.error('[Meeting AI BG] Offscreen audio failed to start:', response?.error);
                }
            } catch (err) {
                console.error('[Meeting AI BG] Failed to setup offscreen audio capture:', err);
            }
        }

        return { success: true, meetingId: currentMeetingId, hasAudio: !!streamId };
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
            try {
                // Wrap in try-catch in case tab was closed
                chrome.tabs.sendMessage(tabId, { type: 'STOP_CAPTURE' });
            } catch (e) {}
        }

        // Stop offscreen audio capture
        try {
            await chrome.runtime.sendMessage({
                type: 'STOP_AUDIO',
                target: 'offscreen'
            });
            console.log('[Meeting AI BG] Sent STOP_AUDIO to offscreen');
        } catch (e) {
            // Ignore if offscreen doesn't exist
        }

        try {
            await chrome.offscreen.closeDocument();
            console.log('[Meeting AI BG] Closed offscreen document');
        } catch (e) {
            // Document might already be closed
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
        audioActive = false;
        const completedMeetingId = currentMeetingId;
        currentMeetingId = null;
        currentProjectId = null;

        await chrome.storage.local.set({
            currentMeetingId: null,
            currentProjectId: null,
            captureActive: false,
            audioActive: false,
        });

        return { success: true, meetingId: completedMeetingId, totalSentEvents };
    } catch (error) {
        console.error('[Meeting AI BG] Failed to stop capture:', error);
        return { success: false, error: error.message };
    }
}

let creatingOffscreen; // A promise to track creation
async function setupOffscreenDocument(path) {
    const offscreenUrl = chrome.runtime.getURL(path);
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
    });

    if (existingContexts.length > 0) {
        return;
    }

    // prevent overlapping createDocument calls
    if (creatingOffscreen) {
        await creatingOffscreen;
        return;
    }

    creatingOffscreen = chrome.offscreen.createDocument({
        url: path,
        reasons: ['USER_MEDIA'],
        justification: 'Recording Meet tab audio for transcription',
    });
    await creatingOffscreen;
    creatingOffscreen = null;
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

        case 'CONTENT_LOG':
            console.log(`[Meeting AI Content] ${message.data.msg}`);
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

        case 'AUDIO_TRANSCRIPT':
            // Audio transcript received from offscreen WS
            audioTranscripts++;
            // Store latest stats for popup
            chrome.storage.local.set({
                audioStats: {
                    audioTranscripts,
                    lastUpdated: Date.now(),
                },
            });
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
                audioActive,
                currentMeetingId,
                currentProjectId,
                totalSentEvents,
                audioTranscripts,
                backendUrl,
            });
            break;

        case 'POPUP_HEALTH_CHECK':
            (async () => {
                const settings = await chrome.storage.local.get(['backendUrl']);
                if (settings.backendUrl) backendUrl = settings.backendUrl;
                const healthy = await healthCheck();
                // Ensure auth is synced before responding
                await syncAuthFromCookies();
                sendResponse({ healthy, backendUrl, isAuthenticated: !!authToken });
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
        'audioActive',
        'currentMeetingId',
        'currentProjectId',
    ]);
    if (settings.backendUrl) backendUrl = settings.backendUrl;
    if (settings.authToken) authToken = settings.authToken;
    if (settings.captureActive) captureActive = settings.captureActive;
    if (settings.audioActive) audioActive = settings.audioActive;
    if (settings.currentMeetingId) currentMeetingId = settings.currentMeetingId;
    if (settings.currentProjectId) currentProjectId = settings.currentProjectId;

    // Try seamlessly pulling auth cookie from Dashboard
    await syncAuthFromCookies();

    console.log('[Meeting AI BG] Service worker initialized', { backendUrl, captureActive, audioActive, hasAuthToken: !!authToken });
})();
