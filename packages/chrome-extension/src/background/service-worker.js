/**
 * @fileoverview Background Service Worker
 * @description Manages API communication with the AI backend.
 *   Coordinates meeting lifecycle actions, uploads the finalized transcript
 *   after capture stops, and exposes processing status to the popup UI.
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
let queueRetryTimeout = null;
let retryAttempt = 0;
let syncState = 'idle';
let lastSyncError = null;
let recentPreviewLines = [];
let currentDraftPreview = null;
let audioCaptureActive = false;
let audioCaptureMode = 'disabled';
let lastCompletedMeetingId = null;
let captureDebug = null;

const MAX_PREVIEW_LINES = 6;
const RETRY_BASE_DELAY_MS = 2500;
const RETRY_MAX_DELAY_MS = 15000;
const OFFSCREEN_DOCUMENT_PATH = 'src/offscreen/audio-recorder.html';

/* ───────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────── */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureContentScriptReady(tabId) {
  if (!tabId) {
    return null;
  }

  const initialStatus = await sendMessageToTab(tabId, { type: 'GET_STATUS' });
  if (initialStatus) {
    return initialStatus;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/content/caption-observer.js'],
    });
  } catch (error) {
    console.warn('[Meeting AI BG] Failed to inject content script:', error);
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await delay(500);
    const status = await sendMessageToTab(tabId, { type: 'GET_STATUS' });
    if (status) {
      return status;
    }
  }

  return null;
}

async function ensureOffscreenDocument() {
  if (!chrome.offscreen?.createDocument) {
    throw new Error('Offscreen audio recording is not supported in this browser.');
  }

  const documentUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [documentUrl],
  });

  if (existingContexts.length > 0) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: 'Record Google Meet tab audio and upload it with the transcript.',
  });
}

async function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response || null);
    });
  });
}

async function resetCaptureRuntimeState() {
  captureActive = false;
  currentMeetingId = null;
  currentProjectId = null;
  totalSentEvents = 0;
  pendingTranscriptBatches = [];
  nextBatchId = 1;
  retryAttempt = 0;
  syncState = 'idle';
  lastSyncError = null;
  recentPreviewLines = [];
  currentDraftPreview = null;
  audioCaptureActive = false;
  audioCaptureMode = 'disabled';
  lastCompletedMeetingId = null;
  captureDebug = null;
  clearRetryTimer();

  await persistRuntimeState();
  await persistPreviewState();
  await chrome.storage.local.set({
    captureActive: false,
    currentMeetingId: null,
    currentProjectId: null,
    captionStats: {
      totalEvents: 0,
      totalSentEvents: 0,
      queuedBatches: 0,
      queuedEvents: 0,
      retryAttempt: 0,
      syncState: 'idle',
      lastSyncError: null,
      lastUpdated: Date.now(),
    },
    transcriptPreview: {
      recentLines: [],
      draft: null,
      updatedAt: Date.now(),
    },
    meetUrl: null,
    captureStartedAt: null,
  });
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
    retryAttempt,
    syncState,
    lastSyncError,
    recentPreviewLines,
    currentDraftPreview,
    lastCompletedMeetingId,
    captureDebug,
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
      retryAttempt,
      syncState,
      lastSyncError,
      captureActive,
      currentMeetingId,
      currentProjectId,
      lastCompletedMeetingId,
      audioCaptureMode,
      captureDebug,
      lastUpdated: Date.now(),
    },
  });
}

async function persistPreviewState() {
  await chrome.storage.local.set({
    transcriptPreview: {
      recentLines: recentPreviewLines,
      draft: currentDraftPreview,
      updatedAt: Date.now(),
    },
  });
}

async function updateSyncState(nextState, errorMessage = null) {
  syncState = nextState;
  lastSyncError = errorMessage;
  captureDebug = {
    ...(captureDebug || {}),
    state: nextState,
    error: errorMessage || null,
    updatedAt: new Date().toISOString(),
  };
  await persistRuntimeState();
  await updateStoredStats();
}

function buildFallbackTranscriptEvents() {
  const rows = [...recentPreviewLines];

  if (currentDraftPreview?.speaker && currentDraftPreview?.content) {
    rows.push({
      speaker: currentDraftPreview.speaker,
      content: currentDraftPreview.content,
      capturedAt: currentDraftPreview.capturedAt || new Date().toISOString(),
    });
  }

  const dedupedEvents = [];
  const seen = new Set();

  for (const row of rows) {
    if (!row?.speaker || !row?.content) {
      continue;
    }

    const key = `${row.speaker}|${row.content}`.trim();
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    dedupedEvents.push({
      speaker: row.speaker,
      speakerId: `speaker:${
        row.speaker
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'unknown'
      }`,
      content: row.content,
      sequenceNumber: dedupedEvents.length + 1,
      isFinal: true,
      capturedAt: row.capturedAt || new Date().toISOString(),
    });
  }

  return dedupedEvents;
}

function clearRetryTimer() {
  if (queueRetryTimeout) {
    clearTimeout(queueRetryTimeout);
    queueRetryTimeout = null;
  }
}

function scheduleQueueRetry() {
  if (queueRetryTimeout || pendingTranscriptBatches.length === 0 || !captureActive) {
    return;
  }

  const delayMs = Math.min(
    RETRY_BASE_DELAY_MS * 2 ** Math.max(retryAttempt - 1, 0),
    RETRY_MAX_DELAY_MS
  );

  queueRetryTimeout = setTimeout(() => {
    queueRetryTimeout = null;
    flushTranscriptQueue().catch((error) => {
      console.warn('[Meeting AI BG] Retry flush failed:', error);
    });
  }, delayMs);
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
  const errorDetails =
    typeof data === 'string'
      ? data
      : data && typeof data === 'object'
        ? JSON.stringify(data)
        : String(data);

  if (!res.ok) {
    console.error(`[Meeting AI BG] API ${method} ${path} failed: ${errorDetails}`);
    throw new Error(data?.error || `API ${method} ${path} failed: ${res.status}`);
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

async function startAudioCapture(tabId, meetingId) {
  if (!tabId || !meetingId) {
    throw new Error('Cannot start audio capture without a tab and meeting ID.');
  }

  await ensureOffscreenDocument();

  const streamId = await chrome.tabCapture.getMediaStreamId({
    targetTabId: tabId,
  });

  const response = await sendRuntimeMessage({
    type: 'OFFSCREEN_START_AUDIO_RECORDING',
    data: {
      streamId,
      meetingId,
      uploadConfig: {
        backendUrl,
        authToken,
      },
    },
  });

  if (!response?.success) {
    throw new Error(response?.error || 'Failed to start tab audio recording.');
  }

  audioCaptureActive = true;
  audioCaptureMode = response.audioMixMode || 'tab_only';
  console.log(`[Meeting AI BG] Audio capture started in mode: ${audioCaptureMode}`);

  return response;
}

async function stopAudioCapture(meetingId) {
  if (!audioCaptureActive) {
    return { uploaded: false, skipped: true, audioMixMode: audioCaptureMode };
  }

  const response = await sendRuntimeMessage({
    type: 'OFFSCREEN_STOP_AUDIO_RECORDING',
    data: { meetingId },
  });

  audioCaptureActive = false;
  audioCaptureMode = response.audioMixMode || 'disabled';

  if (!response?.success) {
    throw new Error(response?.error || 'Failed to stop and upload tab audio recording.');
  }

  return response;
}

async function runPostCaptureProcessing(meetingId) {
  if (!meetingId) {
    return;
  }

  try {
    await updateSyncState('generating_mom');
    await triggerMoM(meetingId);
    console.log('[Meeting AI BG] MoM generation triggered');
  } catch (error) {
    console.warn('[Meeting AI BG] MoM generation failed:', error.message);
    await updateSyncState('error', error.message);
    return;
  }

  try {
    await updateSyncState('extracting_items');
    await triggerExtractItems(meetingId);
    console.log('[Meeting AI BG] Item extraction triggered');
    lastCompletedMeetingId = meetingId;
    await updateSyncState('ready');
  } catch (error) {
    console.warn('[Meeting AI BG] Item extraction failed:', error.message);
    await updateSyncState('error', error.message);
  }
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

  if (syncState === 'idle' || syncState === 'synced') {
    syncState = 'queued';
  }

  await persistRuntimeState();
  await updateStoredStats();
  await flushTranscriptQueue();
}

async function flushTranscriptQueue() {
  if (queueFlushPromise) {
    return queueFlushPromise;
  }

  queueFlushPromise = (async () => {
    if (pendingTranscriptBatches.length === 0) {
      if (captureActive) {
        await updateSyncState('synced');
      } else {
        await updateSyncState('idle');
      }
      return;
    }

    clearRetryTimer();
    await updateSyncState('syncing');

    while (pendingTranscriptBatches.length > 0) {
      const nextBatch = pendingTranscriptBatches[0];
      if (!nextBatch) break;

      try {
        await sendTranscriptBatch(nextBatch.meetingId, nextBatch.events);
        totalSentEvents += nextBatch.events.length;
        pendingTranscriptBatches.shift();
        retryAttempt = 0;
        await persistRuntimeState();
        await updateStoredStats();

        console.log(
          `[Meeting AI BG] Batch sent: ${nextBatch.events.length} events (total: ${totalSentEvents})`
        );
      } catch (error) {
        console.error('[Meeting AI BG] Batch send failed:', error);
        retryAttempt += 1;
        await updateSyncState(
          'retrying',
          error instanceof Error ? error.message : 'Transcript sync failed'
        );
        scheduleQueueRetry();
        break;
      }
    }

    if (pendingTranscriptBatches.length === 0) {
      await updateSyncState(captureActive ? 'synced' : 'idle');
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

    await delay(400);
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

    const contentScriptStatus = await ensureContentScriptReady(tabId);
    if (!contentScriptStatus) {
      throw new Error(
        'Google Meet captions helper is not ready in this tab. Refresh the Meet tab once and try again.'
      );
    }

    const title = buildMeetingTitle(meetUrl, tabTitle);
    const { meeting } = await createMeeting(title, meetUrl, projectId);

    currentMeetingId = meeting.id;
    currentProjectId = projectId;
    totalSentEvents = 0;
    captureActive = true;
    pendingTranscriptBatches = [];
    nextBatchId = 1;
    retryAttempt = 0;
    syncState = 'capturing';
    lastSyncError = null;
    recentPreviewLines = [];
    currentDraftPreview = null;
    audioCaptureActive = false;
    audioCaptureMode = 'disabled';
    lastCompletedMeetingId = null;
    clearRetryTimer();

    console.log(
      `[Meeting AI BG] Meeting created: ${currentMeetingId} (project: ${projectId || 'none'})`
    );

    await startMeeting(currentMeetingId);
    const audioStartResult = await startAudioCapture(tabId, currentMeetingId);
    await persistRuntimeState();
    await persistPreviewState();

    await chrome.storage.local.set({
      meetUrl,
      captureStartedAt: Date.now(),
    });
    await updateStoredStats({ totalEvents: 0, bufferSize: 0, hasDraft: false, draftSpeaker: null });

    let response = await sendMessageToTab(tabId, { type: 'START_CAPTURE' });
    if (!response?.success) {
      await ensureContentScriptReady(tabId);
      response = await sendMessageToTab(tabId, { type: 'START_CAPTURE' });
    }

    if (response && response.success === false) {
      throw new Error(response.error || 'Content script failed to start capture.');
    }
    if (!response) {
      throw new Error(
        'Could not start transcript capture in the Meet tab. Refresh the tab and try again.'
      );
    }

    return {
      success: true,
      meetingId: currentMeetingId,
      audioMixMode: audioStartResult.audioMixMode || 'tab_only',
      microphoneIncluded: Boolean(audioStartResult.microphoneIncluded),
    };
  } catch (error) {
    console.error('[Meeting AI BG] Failed to start capture:', error);
    await resetCaptureRuntimeState();
    lastSyncError = error.message;
    await updateSyncState('idle', error.message);
    return { success: false, error: error.message };
  }
}

async function handleStopCapture(tabId) {
  try {
    const stopResponse = await sendMessageToTab(tabId, { type: 'STOP_CAPTURE' });
    console.log('[Meeting AI BG] Stop response from content script:', stopResponse);

    let finalTranscriptEvents = Array.isArray(stopResponse?.events) ? stopResponse.events : [];
    captureDebug = {
      ...(captureDebug || {}),
      state: 'stop_requested',
      stopResponse: stopResponse?.debug || null,
      tabId: tabId || null,
      updatedAt: new Date().toISOString(),
    };
    await persistRuntimeState();

    if (finalTranscriptEvents.length === 0) {
      finalTranscriptEvents = buildFallbackTranscriptEvents();
      captureDebug = {
        ...(captureDebug || {}),
        fallbackUsed: finalTranscriptEvents.length > 0,
        fallbackTranscriptEvents: finalTranscriptEvents.length,
        updatedAt: new Date().toISOString(),
      };
      await persistRuntimeState();
    }

    const finalizedEventCount = finalTranscriptEvents.length;

    captureActive = false;
    currentDraftPreview = null;
    recentPreviewLines = finalTranscriptEvents.slice(-MAX_PREVIEW_LINES).map((event) => ({
      speaker: event.speaker,
      content: event.content,
      capturedAt: event.capturedAt || new Date().toISOString(),
    }));
    pendingTranscriptBatches = [];
    retryAttempt = 0;
    clearRetryTimer();
    await persistPreviewState();
    await updateStoredStats({
      totalEvents: finalizedEventCount,
      bufferSize: finalizedEventCount,
      hasDraft: false,
      draftSpeaker: null,
    });

    if (!currentMeetingId) {
      throw new Error('No active meeting was found while stopping capture.');
    }

    const completedMeetingId = currentMeetingId;
    const completedProjectId = currentProjectId;

    await updateSyncState('finalizing');

    if (finalizedEventCount > 0) {
      await updateSyncState('uploading_transcript');
      await sendTranscriptBatch(completedMeetingId, finalTranscriptEvents);
      totalSentEvents = finalizedEventCount;
      await persistRuntimeState();
      await updateStoredStats({
        totalEvents: finalizedEventCount,
        bufferSize: finalizedEventCount,
        hasDraft: false,
        draftSpeaker: null,
      });
    } else {
      totalSentEvents = 0;
      await persistRuntimeState();
      await updateStoredStats({
        totalEvents: 0,
        bufferSize: 0,
        hasDraft: false,
        draftSpeaker: null,
      });
    }

    await updateSyncState('uploading_audio');
    const audioResult = await stopAudioCapture(completedMeetingId);

    await updateSyncState('completing_meeting');
    await completeMeeting(completedMeetingId);
    console.log(`[Meeting AI BG] Meeting completed: ${completedMeetingId}`);

    audioCaptureActive = false;
    audioCaptureMode = 'disabled';
    lastCompletedMeetingId = completedMeetingId;
    currentMeetingId = completedMeetingId;
    currentProjectId = completedProjectId;
    await persistRuntimeState();

    await chrome.storage.local.set({
      captureActive: false,
      meetUrl: null,
      captureStartedAt: null,
    });

    if (finalizedEventCount === 0) {
      await updateSyncState(
        'error',
        'No transcript lines were extracted. Keep Google Meet captions visible and try again.'
      );
      return {
        success: false,
        meetingId: completedMeetingId,
        totalSentEvents,
        audioUploaded: Boolean(audioResult?.uploaded),
        audioMixMode: audioResult?.audioMixMode || 'disabled',
        error:
          'No transcript lines were extracted. Keep Google Meet captions visible and try again.',
      };
    }

    void runPostCaptureProcessing(completedMeetingId);

    return {
      success: true,
      meetingId: completedMeetingId,
      totalSentEvents,
      audioUploaded: Boolean(audioResult?.uploaded),
      audioMixMode: audioResult?.audioMixMode || 'disabled',
    };
  } catch (error) {
    console.error('[Meeting AI BG] Failed to stop capture:', error);
    await updateSyncState('error', error.message);
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
        captureDebug = {
          ...(captureDebug || {}),
          captionStats: message.data || null,
          updatedAt: new Date().toISOString(),
        };
        await updateStoredStats(message.data || {});
        await persistRuntimeState();
        sendResponse({ success: true });
      })();
      return true;

    case 'TRANSCRIPT_PREVIEW':
      (async () => {
        const draft = message.data?.draft || null;
        const finalEvent = message.data?.finalEvent || null;

        if (finalEvent?.speaker && finalEvent?.content) {
          recentPreviewLines.push({
            speaker: finalEvent.speaker,
            content: finalEvent.content,
            capturedAt: finalEvent.capturedAt || new Date().toISOString(),
          });
          recentPreviewLines = recentPreviewLines.slice(-MAX_PREVIEW_LINES);
        }

        currentDraftPreview =
          draft?.speaker && draft?.content
            ? {
                speaker: draft.speaker,
                content: draft.content,
                capturedAt: new Date().toISOString(),
              }
            : null;

        captureDebug = {
          ...(captureDebug || {}),
          preview: {
            recentLines: recentPreviewLines.length,
            hasDraft: Boolean(currentDraftPreview),
          },
          updatedAt: new Date().toISOString(),
        };

        await persistRuntimeState();
        await persistPreviewState();
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
      (async () => {
        const tabStatus = message.data?.tabId
          ? await ensureContentScriptReady(message.data.tabId)
          : null;

        sendResponse({
          captureActive,
          currentMeetingId,
          currentProjectId,
          lastCompletedMeetingId,
          captureDebug,
          totalSentEvents,
          queuedBatches: pendingTranscriptBatches.length,
          queuedEvents: pendingTranscriptBatches.reduce(
            (total, batch) => total + batch.events.length,
            0
          ),
          syncState,
          lastSyncError,
          retryAttempt,
          recentPreviewLines,
          currentDraftPreview,
          backendUrl,
          audioCaptureMode,
          tabReachable: Boolean(tabStatus),
          tabCaptureActive: tabStatus?.isCapturing || false,
          tabBufferedEvents: tabStatus?.bufferSize || 0,
          tabObservedEvents: tabStatus?.totalEvents || 0,
        });
      })();
      return true;

    case 'POPUP_RESET_CAPTURE_STATE':
      (async () => {
        await resetCaptureRuntimeState();
        sendResponse({ success: true });
      })();
      return true;

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
    'retryAttempt',
    'syncState',
    'lastSyncError',
    'recentPreviewLines',
    'currentDraftPreview',
    'lastCompletedMeetingId',
    'captureDebug',
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
  if (typeof settings.retryAttempt === 'number') {
    retryAttempt = settings.retryAttempt;
  }
  if (typeof settings.syncState === 'string') {
    syncState = settings.syncState;
  }
  if (typeof settings.lastSyncError === 'string') {
    lastSyncError = settings.lastSyncError;
  }
  if (Array.isArray(settings.recentPreviewLines)) {
    recentPreviewLines = settings.recentPreviewLines;
  }
  if (settings.currentDraftPreview) {
    currentDraftPreview = settings.currentDraftPreview;
  }
  if (settings.lastCompletedMeetingId) {
    lastCompletedMeetingId = settings.lastCompletedMeetingId;
  }
  if (settings.captureDebug) {
    captureDebug = settings.captureDebug;
  }

  if (captureActive && pendingTranscriptBatches.length > 0) {
    scheduleQueueRetry();
    flushTranscriptQueue().catch((error) => {
      console.warn('[Meeting AI BG] Failed to flush queued transcript batches on init:', error);
    });
  }

  console.log('[Meeting AI BG] Service worker initialized', {
    backendUrl,
    captureActive,
    queuedBatches: pendingTranscriptBatches.length,
    syncState,
  });
})();
