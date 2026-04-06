/**
 * @fileoverview Extension Popup Logic
 * @description Controls the popup UI — manages state transitions, communicates with
 *   the background service worker, and updates stats in real-time.
 */

/* ───────────────────────────────────────────
   DOM Elements
   ─────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

const els = {
  // Connection
  connectionBar: $('connectionBar'),
  connectionText: $('connectionText'),

  // State panels
  noMeetState: $('noMeetState'),
  readyState: $('readyState'),
  capturingState: $('capturingState'),

  // Ready state
  meetUrl: $('meetUrl'),
  startBtn: $('startBtn'),
  projectSelect: $('projectSelect'),
  projectMatchHint: $('projectMatchHint'),

  // Capturing state
  projectBadge: $('projectBadge'),
  projectBadgeName: $('projectBadgeName'),
  eventCount: $('eventCount'),
  sentCount: $('sentCount'),
  durationDisplay: $('durationDisplay'),
  meetingIdDisplay: $('meetingIdDisplay'),
  syncStatusPill: $('syncStatusPill'),
  syncStatusText: $('syncStatusText'),
  queueStatusText: $('queueStatusText'),
  previewEmpty: $('previewEmpty'),
  previewList: $('previewList'),
  draftBadge: $('draftBadge'),
  stopBtn: $('stopBtn'),

  // Settings
  settingsToggle: $('settingsToggle'),
  settingsPanel: $('settingsPanel'),
  backendUrlInput: $('backendUrlInput'),
  authTokenInput: $('authTokenInput'),
  saveSettingsBtn: $('saveSettingsBtn'),
  testConnectionBtn: $('testConnectionBtn'),
  settingsStatus: $('settingsStatus'),
};

/* ───────────────────────────────────────────
   State
   ─────────────────────────────────────────── */
let currentTabId = null;
let currentMeetUrl = null;
let currentTabTitle = null;
let settingsVisible = false;
let durationTimer = null;
let captureStartTime = null;
let availableProjects = [];

/* ───────────────────────────────────────────
   UI State Management
   ─────────────────────────────────────────── */
function showState(state) {
  els.noMeetState.style.display = 'none';
  els.readyState.style.display = 'none';
  els.capturingState.style.display = 'none';

  switch (state) {
    case 'no-meet':
      els.noMeetState.style.display = 'block';
      break;
    case 'ready':
      els.readyState.style.display = 'block';
      break;
    case 'capturing':
      els.capturingState.style.display = 'block';
      break;
  }
}

function setConnection(status, text) {
  els.connectionBar.className = `connection-bar ${status}`;
  els.connectionText.textContent = text;
}

function showSettingsStatus(message, type) {
  els.settingsStatus.textContent = message;
  els.settingsStatus.className = `settings-status ${type}`;
  setTimeout(() => {
    els.settingsStatus.textContent = '';
  }, 3000);
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function shortenId(id) {
  if (!id) return '—';
  return id.substring(0, 8) + '...';
}

function formatQueueSummary(queuedEvents, queuedBatches) {
  if (!queuedEvents) {
    return 'All finalized transcript lines are synced to the backend.';
  }

  const eventLabel = queuedEvents === 1 ? 'event' : 'events';
  const batchLabel = queuedBatches === 1 ? 'batch' : 'batches';
  return `${queuedEvents} ${eventLabel} queued across ${queuedBatches} ${batchLabel}.`;
}

function setSyncStatus(
  syncState,
  queuedEvents = 0,
  queuedBatches = 0,
  retryAttempt = 0,
  lastSyncError = null
) {
  const normalizedState = syncState || 'idle';
  const statusLabels = {
    idle: 'Idle',
    queued: 'Queued',
    syncing: 'Syncing',
    synced: 'Synced',
    retrying: 'Retrying',
    error: 'Error',
  };

  els.syncStatusPill.className = `sync-pill ${normalizedState}`;
  els.syncStatusPill.textContent = statusLabels[normalizedState] || 'Idle';
  els.queueStatusText.textContent = formatQueueSummary(queuedEvents, queuedBatches);

  if (normalizedState === 'retrying') {
    const retryText = retryAttempt > 0 ? ` Retrying automatically (attempt ${retryAttempt}).` : '';
    els.syncStatusText.textContent =
      lastSyncError || `The backend sync failed temporarily.${retryText}`;
    return;
  }

  if (normalizedState === 'queued') {
    els.syncStatusText.textContent = 'Transcript lines are waiting to be delivered.';
    return;
  }

  if (normalizedState === 'syncing') {
    els.syncStatusText.textContent = 'Delivering transcript lines to the backend now.';
    return;
  }

  if (normalizedState === 'synced') {
    els.syncStatusText.textContent = 'Backend is caught up with the captured transcript.';
    return;
  }

  if (normalizedState === 'error') {
    els.syncStatusText.textContent = lastSyncError || 'Transcript delivery failed.';
    return;
  }

  els.syncStatusText.textContent = 'Waiting for transcript events.';
}

function renderPreview(recentLines = [], draft = null) {
  els.previewList.innerHTML = '';

  const rows = [...recentLines];
  if (draft?.speaker && draft?.content) {
    rows.push({ ...draft, isDraft: true });
    els.draftBadge.style.display = 'inline-flex';
  } else {
    els.draftBadge.style.display = 'none';
  }

  if (rows.length === 0) {
    els.previewEmpty.style.display = 'block';
    return;
  }

  els.previewEmpty.style.display = 'none';

  rows.slice(-6).forEach((row) => {
    const rowEl = document.createElement('div');
    rowEl.className = `preview-row${row.isDraft ? ' is-draft' : ''}`;

    const metaEl = document.createElement('div');
    metaEl.className = 'preview-meta';

    const speakerEl = document.createElement('span');
    speakerEl.className = 'preview-speaker';
    speakerEl.textContent = row.speaker || 'Unknown';

    const badgeEl = document.createElement('span');
    badgeEl.className = 'preview-badge';
    badgeEl.textContent = row.isDraft ? 'Draft' : 'Final';

    const contentEl = document.createElement('div');
    contentEl.className = 'preview-content';
    contentEl.textContent = row.content || '';

    metaEl.appendChild(speakerEl);
    metaEl.appendChild(badgeEl);
    rowEl.appendChild(metaEl);
    rowEl.appendChild(contentEl);
    els.previewList.appendChild(rowEl);
  });
}

function resetCapturePanels() {
  els.eventCount.textContent = '0';
  els.sentCount.textContent = '0';
  els.meetingIdDisplay.textContent = '—';
  els.durationDisplay.textContent = '0:00';
  setSyncStatus('idle', 0, 0, 0, null);
  renderPreview([], null);
}

async function reconcileCaptureState(settings) {
  const bgStatus = await sendToBackground('POPUP_GET_STATUS', {
    tabId: currentTabId,
  });

  if (!settings.captureActive || !settings.currentMeetingId) {
    return bgStatus;
  }

  const hasLiveCapture =
    bgStatus?.captureActive && (bgStatus?.tabCaptureActive || (bgStatus?.queuedBatches || 0) > 0);

  if (hasLiveCapture) {
    return bgStatus;
  }

  await sendToBackground('POPUP_RESET_CAPTURE_STATE');
  resetCapturePanels();
  return {
    ...bgStatus,
    captureActive: false,
    currentMeetingId: null,
    currentProjectId: null,
    tabCaptureActive: false,
  };
}

function startDurationTimer() {
  durationTimer = setInterval(() => {
    if (captureStartTime) {
      const elapsed = Date.now() - captureStartTime;
      els.durationDisplay.textContent = formatDuration(elapsed);
    }
  }, 1000);
}

function stopDurationTimer() {
  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = null;
  }
}

/* ───────────────────────────────────────────
   Background Communication
   ─────────────────────────────────────────── */
function sendToBackground(type, data = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, data }, (response) => {
      resolve(response);
    });
  });
}

/* ───────────────────────────────────────────
   Projects
   ─────────────────────────────────────────── */
async function loadProjects() {
  const result = await sendToBackground('POPUP_FETCH_PROJECTS');
  if (result?.success && result.projects) {
    availableProjects = result.projects;

    // Clear existing options except the first one
    while (els.projectSelect.options.length > 1) {
      els.projectSelect.remove(1);
    }

    // Add options
    availableProjects.forEach((p) => {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = p.name;
      els.projectSelect.appendChild(option);
    });

    // Auto-select based on meetup URL
    if (currentMeetUrl) {
      // Clean URL for comparison
      const cleanUrl = currentMeetUrl.split('?')[0];
      const match = availableProjects.find(
        (p) => p.googleMeetLink && cleanUrl.includes(p.googleMeetLink)
      );

      if (match) {
        els.projectSelect.value = match.id;
        els.projectMatchHint.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          Auto-matched by Meet link
        `;
        els.projectMatchHint.style.display = 'flex';
      } else {
        els.projectMatchHint.style.display = 'none';
      }
    }
  }
}

/* ───────────────────────────────────────────
   Initialization
   ─────────────────────────────────────────── */
async function init() {
  // 1. Load saved settings
  const settings = await chrome.storage.local.get([
    'backendUrl',
    'authToken',
    'captureActive',
    'currentMeetingId',
    'currentProjectId',
    'captureStartedAt',
    'meetUrl',
    'captionStats',
    'transcriptPreview',
  ]);

  if (settings.backendUrl) {
    els.backendUrlInput.value = settings.backendUrl;
  }
  if (settings.authToken) {
    els.authTokenInput.value = settings.authToken;
  }

  // 2. Check backend connection and fetch projects
  setConnection('checking', 'Checking backend...');
  const healthResult = await sendToBackground('POPUP_HEALTH_CHECK');

  if (healthResult?.healthy) {
    setConnection('connected', `Connected to ${healthResult.backendUrl}`);
    await loadProjects();
  } else {
    setConnection('disconnected', 'Backend not reachable');
  }

  // 3. Detect current tab
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (activeTab && activeTab.url && activeTab.url.includes('meet.google.com/')) {
    currentTabId = activeTab.id;
    currentMeetUrl = activeTab.url;
    currentTabTitle = activeTab.title || null;
    els.meetUrl.textContent = currentMeetUrl;

    // Attempt auto-match if projects loaded after URL detection
    if (availableProjects.length > 0) {
      const cleanUrl = currentMeetUrl.split('?')[0];
      const match = availableProjects.find(
        (p) => p.googleMeetLink && cleanUrl.includes(p.googleMeetLink)
      );
      if (match) {
        els.projectSelect.value = match.id;
        els.projectMatchHint.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          Auto-matched
        `;
        els.projectMatchHint.style.display = 'flex';
      }
    }

    const bgStatus = await reconcileCaptureState(settings);

    // 4. Check if capture is already active
    if (bgStatus?.captureActive && settings.currentMeetingId) {
      captureStartTime = settings.captureStartedAt || Date.now();
      els.meetingIdDisplay.textContent = shortenId(
        bgStatus.currentMeetingId || settings.currentMeetingId
      );

      // Setup project badge
      const projectId = bgStatus.currentProjectId || settings.currentProjectId;
      if (projectId) {
        const pMatch = availableProjects.find((p) => p.id === projectId);
        if (pMatch) {
          els.projectBadgeName.textContent = pMatch.name;
          els.projectBadge.style.display = 'inline-flex';
        }
      }

      const stats = settings.captionStats || bgStatus || {};
      els.eventCount.textContent = stats.totalEvents || stats.tabObservedEvents || 0;
      els.sentCount.textContent = stats.totalSentEvents || bgStatus?.totalSentEvents || 0;
      setSyncStatus(
        stats.syncState || 'idle',
        stats.queuedEvents || 0,
        stats.queuedBatches || 0,
        stats.retryAttempt || 0,
        stats.lastSyncError || null
      );
      renderPreview(
        settings.transcriptPreview?.recentLines || [],
        settings.transcriptPreview?.draft || null
      );

      showState('capturing');
      startDurationTimer();
      startStatsPolling();
    } else {
      resetCapturePanels();
      showState('ready');
    }
  } else {
    if (settings.captureActive) {
      await sendToBackground('POPUP_RESET_CAPTURE_STATE');
    }
    resetCapturePanels();
    showState('no-meet');
  }
}

/* ───────────────────────────────────────────
   Stats Polling
   ─────────────────────────────────────────── */
let statsInterval = null;

function startStatsPolling() {
  updateStats(); // immediate first
  statsInterval = setInterval(updateStats, 2000);
}

function stopStatsPolling() {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
}

async function updateStats() {
  const stored = await chrome.storage.local.get(['captionStats', 'transcriptPreview']);
  if (stored.captionStats) {
    els.eventCount.textContent = stored.captionStats.totalEvents || 0;
    els.sentCount.textContent = stored.captionStats.totalSentEvents || 0;
    setSyncStatus(
      stored.captionStats.syncState || 'idle',
      stored.captionStats.queuedEvents || 0,
      stored.captionStats.queuedBatches || 0,
      stored.captionStats.retryAttempt || 0,
      stored.captionStats.lastSyncError || null
    );
  }

  if (stored.transcriptPreview) {
    renderPreview(
      stored.transcriptPreview.recentLines || [],
      stored.transcriptPreview.draft || null
    );
  }

  // Also get status from background
  const bgStatus = await sendToBackground('POPUP_GET_STATUS', {
    tabId: currentTabId,
  });
  if (bgStatus) {
    els.sentCount.textContent = bgStatus.totalSentEvents || 0;
    setSyncStatus(
      bgStatus.syncState || 'idle',
      bgStatus.queuedEvents || 0,
      bgStatus.queuedBatches || 0,
      bgStatus.retryAttempt || 0,
      bgStatus.lastSyncError || null
    );
    renderPreview(bgStatus.recentPreviewLines || [], bgStatus.currentDraftPreview || null);
    if (bgStatus.currentMeetingId) {
      els.meetingIdDisplay.textContent = shortenId(bgStatus.currentMeetingId);
    }
  }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;

  if (changes.captionStats?.newValue) {
    const nextStats = changes.captionStats.newValue;
    els.eventCount.textContent = nextStats.totalEvents || 0;
    els.sentCount.textContent = nextStats.totalSentEvents || 0;
    setSyncStatus(
      nextStats.syncState || 'idle',
      nextStats.queuedEvents || 0,
      nextStats.queuedBatches || 0,
      nextStats.retryAttempt || 0,
      nextStats.lastSyncError || null
    );
  }

  if (changes.transcriptPreview?.newValue) {
    const preview = changes.transcriptPreview.newValue;
    renderPreview(preview.recentLines || [], preview.draft || null);
  }
});

/* ───────────────────────────────────────────
   Event Handlers
   ─────────────────────────────────────────── */

// Start Capture
els.startBtn.addEventListener('click', async () => {
  if (!currentTabId || !currentMeetUrl) return;

  els.startBtn.disabled = true;
  els.startBtn.textContent = 'Starting...';

  const selectedProjectId = els.projectSelect.value;

  const result = await sendToBackground('POPUP_START_CAPTURE', {
    meetUrl: currentMeetUrl,
    tabId: currentTabId,
    tabTitle: currentTabTitle,
    projectId: selectedProjectId || null,
  });

  if (result?.success) {
    captureStartTime = Date.now();
    els.meetingIdDisplay.textContent = shortenId(result.meetingId);
    setSyncStatus('queued', 0, 0, 0, null);
    renderPreview([], null);

    // Show project badge if attached to project
    if (selectedProjectId) {
      const match = availableProjects.find((p) => p.id === selectedProjectId);
      if (match) {
        els.projectBadgeName.textContent = match.name;
        els.projectBadge.style.display = 'inline-flex';
      }
    } else {
      els.projectBadge.style.display = 'none';
    }

    showState('capturing');
    startDurationTimer();
    startStatsPolling();
  } else {
    els.startBtn.disabled = false;
    els.startBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="4" fill="currentColor"/>
      </svg>
      Start Capture
    `;
    setConnection('disconnected', result?.error || 'Failed to start capture');
  }
});

// Stop Capture
els.stopBtn.addEventListener('click', async () => {
  els.stopBtn.disabled = true;
  els.stopBtn.textContent = 'Stopping...';

  stopDurationTimer();
  stopStatsPolling();

  const result = await sendToBackground('POPUP_STOP_CAPTURE', {
    tabId: currentTabId,
  });

  if (result?.success) {
    resetCapturePanels();
    showState('ready');
  }

  els.stopBtn.disabled = false;
  els.stopBtn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
    </svg>
    Stop Capture
  `;
});

// Settings Toggle
els.settingsToggle.addEventListener('click', () => {
  settingsVisible = !settingsVisible;
  els.settingsPanel.style.display = settingsVisible ? 'block' : 'none';
});

// Save Settings
els.saveSettingsBtn.addEventListener('click', async () => {
  const result = await sendToBackground('POPUP_SAVE_SETTINGS', {
    backendUrl: els.backendUrlInput.value,
    authToken: els.authTokenInput.value,
  });

  if (result?.success) {
    showSettingsStatus('Settings saved ✓', 'success');
  } else {
    showSettingsStatus('Failed to save settings', 'error');
  }
});

// Test Connection
els.testConnectionBtn.addEventListener('click', async () => {
  // Save first so the health check uses the new URL
  await sendToBackground('POPUP_SAVE_SETTINGS', {
    backendUrl: els.backendUrlInput.value,
    authToken: els.authTokenInput.value,
  });

  setConnection('checking', 'Testing connection...');
  const result = await sendToBackground('POPUP_HEALTH_CHECK');

  if (result?.healthy) {
    setConnection('connected', `Connected to ${result.backendUrl}`);
    showSettingsStatus('Connection successful ✓', 'success');
  } else {
    setConnection('disconnected', 'Backend not reachable');
    showSettingsStatus('Connection failed — check URL', 'error');
  }
});

/* ───────────────────────────────────────────
   Init
   ─────────────────────────────────────────── */
init();
