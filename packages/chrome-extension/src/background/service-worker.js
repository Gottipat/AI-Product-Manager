/**
 * @fileoverview Background Service Worker
 * @description Manages API communication with the AI backend.
 *   Receives finalized transcript batches from the content script, persists an
 *   outbound queue for reliability, and coordinates meeting lifecycle actions.
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
let pendingTranscriptBatches = [];
let nextBatchId = 1;
let queueFlushPromise = null;

/* ───────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────── */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildMeetingTitle(meetUrl, tabTitle) {
  const cleanTitle = (tabTitle || '')
    .replace(/\s*-\s*Google Meet$/i, '')
    .replace(/\s*\|\s*Google Meet$/i, '')
    .trim();

  if (cleanTitle && cleanTitle.toLowerCase() !== 'google meet') {
    return `Extension Capture — ${cleanTitle}`;
  }

  const meetCode = meetUrl.split('/').pop()?.split('?')[0];
  return `Extension Capture — ${meetCode || new Date().toLocaleString()}`;
}

async function sendMessageToTab(tabId, message) {
  if (!tabId) return null;

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[Meeting AI BG] Tab message failed:', chrome.runtime.lastError.message);
        resolve(null);
        return;
      }

      resolve(response || null);
    });
  });
}

async function persistRuntimeState() {
  await chrome.storage.local.set({
    currentMeetingId,
    currentProjectId,
    captureActive,
    totalSentEvents,
    pendingTranscriptBatches,
    nextBatchId,
  });
}

async function updateStoredStats(extra = {}) {
  const existing = await chrome.storage.local.get(['captionStats']);
  await chrome.storage.local.set({
    captionStats: {
      ...(existing.captionStats || {}),
      ...extra,
      totalSentEvents,
      queuedBatches: pendingTranscriptBatches.length,
      queuedEvents: pendingTranscriptBatches.reduce(
        (total, batch) => total + batch.events.length,
        0
      ),
      lastUpdated: Date.now(),
    },
  });
}

/* ───────────────────────────────────────────
   API Client
   ─────────────────────────────────────────── */
async function apiRequest(method, path, body = null) {
  const url = `${backendUrl}${path}`;
  const headers = { 'Content-Type': 'application/json' };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
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
   Transcript Queue
   ─────────────────────────────────────────── */
async function enqueueTranscriptBatch(meetingId, events) {
  if (!events || events.length === 0) return;

  pendingTranscriptBatches.push({
    id: `batch-${Date.now()}-${nextBatchId++}`,
    meetingId,
    events,
    createdAt: Date.now(),
  });

  await persistRuntimeState();
  await updateStoredStats();
  await flushTranscriptQueue();
}

async function flushTranscriptQueue() {
  if (queueFlushPromise) {
    return queueFlushPromise;
  }

  queueFlushPromise = (async () => {
    while (pendingTranscriptBatches.length > 0) {
      const nextBatch = pendingTranscriptBatches[0];
      if (!nextBatch) break;

      try {
        await sendTranscriptBatch(nextBatch.meetingId, nextBatch.events);
        totalSentEvents += nextBatch.events.length;
        pendingTranscriptBatches.shift();
        await persistRuntimeState();
        await updateStoredStats();

        console.log(
          `[Meeting AI BG] Batch sent: ${nextBatch.events.length} events (total: ${totalSentEvents})`
        );
      } catch (error) {
        console.error('[Meeting AI BG] Batch send failed:', error);
        break;
      }
    }
  })();

  try {
    await queueFlushPromise;
  } finally {
    queueFlushPromise = null;
  }
}

async function waitForTranscriptQueue(timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await flushTranscriptQueue();

    if (!queueFlushPromise && pendingTranscriptBatches.length === 0) {
      return true;
    }

    await delay(300);
  }

  return pendingTranscriptBatches.length === 0;
}

/* ───────────────────────────────────────────
   Meeting Lifecycle
   ─────────────────────────────────────────── */
async function handleStartCapture(meetUrl, tabId, projectId = null, tabTitle = null) {
  try {
    const settings = await chrome.storage.local.get(['backendUrl', 'authToken']);
    if (settings.backendUrl) backendUrl = settings.backendUrl;
    if (settings.authToken) authToken = settings.authToken;

    const healthy = await healthCheck();
    if (!healthy) {
      throw new Error('Backend is not reachable. Make sure it is running.');
    }

    const title = buildMeetingTitle(meetUrl, tabTitle);
    const { meeting } = await createMeeting(title, meetUrl, projectId);

    currentMeetingId = meeting.id;
    currentProjectId = projectId;
    totalSentEvents = 0;
    captureActive = true;
    pendingTranscriptBatches = [];
    nextBatchId = 1;

    console.log(
      `[Meeting AI BG] Meeting created: ${currentMeetingId} (project: ${projectId || 'none'})`
    );

    await startMeeting(currentMeetingId);
    await persistRuntimeState();

    await chrome.storage.local.set({
      meetUrl,
      captureStartedAt: Date.now(),
    });
    await updateStoredStats({ totalEvents: 0, bufferSize: 0 });

    const response = await sendMessageToTab(tabId, { type: 'START_CAPTURE' });
    if (response && response.success === false) {
      throw new Error(response.error || 'Content script failed to start capture.');
    }

    return { success: true, meetingId: currentMeetingId };
  } catch (error) {
    console.error('[Meeting AI BG] Failed to start capture:', error);
    captureActive = false;
    currentMeetingId = null;
    currentProjectId = null;
    await persistRuntimeState();
    return { success: false, error: error.message };
  }
}

async function handleStopCapture(tabId) {
  try {
    const stopResponse = await sendMessageToTab(tabId, { type: 'STOP_CAPTURE' });
    console.log('[Meeting AI BG] Stop response from content script:', stopResponse);

    const queueFlushed = await waitForTranscriptQueue(12000);
    if (!queueFlushed) {
      console.warn(
        '[Meeting AI BG] Timed out waiting for transcript queue to flush before completion'
      );
    }

    if (currentMeetingId) {
      await completeMeeting(currentMeetingId);
      console.log(`[Meeting AI BG] Meeting completed: ${currentMeetingId}`);

      try {
        await triggerMoM(currentMeetingId);
        console.log('[Meeting AI BG] MoM generation triggered');
      } catch (error) {
        console.warn('[Meeting AI BG] MoM generation failed:', error.message);
      }

      try {
        await triggerExtractItems(currentMeetingId);
        console.log('[Meeting AI BG] Item extraction triggered');
      } catch (error) {
        console.warn('[Meeting AI BG] Item extraction failed:', error.message);
      }
    }

    captureActive = false;
    const completedMeetingId = currentMeetingId;
    currentMeetingId = null;
    currentProjectId = null;
    await persistRuntimeState();

    await chrome.storage.local.set({
      captureActive: false,
      meetUrl: null,
      captureStartedAt: null,
    });

    return {
      success: true,
      meetingId: completedMeetingId,
      totalSentEvents,
      queueFlushed,
    };
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
    case 'TRANSCRIPT_BATCH':
      (async () => {
        if (currentMeetingId && message.data?.events?.length > 0) {
          await enqueueTranscriptBatch(currentMeetingId, message.data.events);
        }
        sendResponse({ success: true });
      })();
      return true;

    case 'CAPTION_STATS':
      (async () => {
        await updateStoredStats(message.data || {});
        sendResponse({ success: true });
      })();
      return true;

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

    case 'POPUP_START_CAPTURE':
      (async () => {
        const result = await handleStartCapture(
          message.data.meetUrl,
          message.data.tabId,
          message.data.projectId || null,
          message.data.tabTitle || null
        );
        sendResponse(result);
      })();
      return true;

    case 'POPUP_STOP_CAPTURE':
      (async () => {
        const result = await handleStopCapture(message.data?.tabId);
        sendResponse(result);
      })();
      return true;

    case 'POPUP_GET_STATUS':
      sendResponse({
        captureActive,
        currentMeetingId,
        currentProjectId,
        totalSentEvents,
        queuedBatches: pendingTranscriptBatches.length,
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
      return true;

    case 'POPUP_FETCH_PROJECTS':
      (async () => {
        try {
          const settings = await chrome.storage.local.get(['backendUrl']);
          if (settings.backendUrl) backendUrl = settings.backendUrl;
          const result = await fetchProjects();
          sendResponse({ success: true, projects: result.projects });
        } catch (error) {
          sendResponse({ success: false, projects: [], error: error.message });
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
    'totalSentEvents',
    'pendingTranscriptBatches',
    'nextBatchId',
  ]);

  if (settings.backendUrl) backendUrl = settings.backendUrl;
  if (settings.authToken) authToken = settings.authToken;
  if (settings.captureActive) captureActive = settings.captureActive;
  if (settings.currentMeetingId) currentMeetingId = settings.currentMeetingId;
  if (settings.currentProjectId) currentProjectId = settings.currentProjectId;
  if (typeof settings.totalSentEvents === 'number') totalSentEvents = settings.totalSentEvents;
  if (Array.isArray(settings.pendingTranscriptBatches)) {
    pendingTranscriptBatches = settings.pendingTranscriptBatches;
  }
  if (typeof settings.nextBatchId === 'number') {
    nextBatchId = settings.nextBatchId;
  }

  if (captureActive && pendingTranscriptBatches.length > 0) {
    flushTranscriptQueue().catch((error) => {
      console.warn('[Meeting AI BG] Failed to flush queued transcript batches on init:', error);
    });
  }

  console.log('[Meeting AI BG] Service worker initialized', {
    backendUrl,
    captureActive,
    queuedBatches: pendingTranscriptBatches.length,
  });
})();
