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
    audioStatsDisplay: $('audioStatsDisplay'),
    audioActiveLabel: $('audioActiveLabel'),
    durationDisplay: $('durationDisplay'),
    meetingIdDisplay: $('meetingIdDisplay'),
    stopBtn: $('stopBtn'),

    // Settings
    settingsToggle: $('settingsToggle'),
    settingsPanel: $('settingsPanel'),
    backendUrlInput: $('backendUrlInput'),
    authStatusBadge: $('authStatusBadge'),
    saveSettingsBtn: $('saveSettingsBtn'),
    testConnectionBtn: $('testConnectionBtn'),
    settingsStatus: $('settingsStatus'),
};

/* ───────────────────────────────────────────
   State
   ─────────────────────────────────────────── */
let currentTabId = null;
let currentMeetUrl = null;
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
            const match = availableProjects.find(p => p.googleMeetLink && cleanUrl.includes(p.googleMeetLink));

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
    ]);

    if (settings.backendUrl) {
        els.backendUrlInput.value = settings.backendUrl;
    }

    // 2. Check backend connection and fetch projects
    setConnection('checking', 'Checking backend...');
    const healthResult = await sendToBackground('POPUP_HEALTH_CHECK');

    if (healthResult?.healthy) {
        setConnection('connected', `Connected to ${healthResult.backendUrl}`);
        
        // Update auth status UI
        if (healthResult.isAuthenticated) {
            els.authStatusBadge.innerHTML = '✅ Authenticated';
            els.authStatusBadge.style.color = 'var(--text-success)';
            els.authStatusBadge.style.borderColor = 'var(--border-success)';
            els.authStatusBadge.style.backgroundColor = 'var(--bg-success)';
        } else {
            els.authStatusBadge.innerHTML = '❌ Please Log into Dashboard';
            els.authStatusBadge.style.color = 'var(--text-danger)';
            els.authStatusBadge.style.borderColor = 'var(--border-danger)';
            els.authStatusBadge.style.backgroundColor = 'var(--bg-danger)';
        }

        await loadProjects();
    } else {
        setConnection('disconnected', 'Backend not reachable');
        els.authStatusBadge.innerHTML = '⚠️ Offline';
    }

    // 3. Detect current tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (activeTab && activeTab.url && activeTab.url.includes('meet.google.com/')) {
        currentTabId = activeTab.id;
        currentMeetUrl = activeTab.url;
        els.meetUrl.textContent = currentMeetUrl;

        // Attempt auto-match if projects loaded after URL detection
        if (availableProjects.length > 0) {
            const cleanUrl = currentMeetUrl.split('?')[0];
            const match = availableProjects.find(p => p.googleMeetLink && cleanUrl.includes(p.googleMeetLink));
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

        // 4. Check if capture is already active
        if (settings.captureActive && settings.currentMeetingId) {
            captureStartTime = settings.captureStartedAt || Date.now();
            els.meetingIdDisplay.textContent = shortenId(settings.currentMeetingId);

            // Setup project badge
            if (settings.currentProjectId) {
                const pMatch = availableProjects.find(p => p.id === settings.currentProjectId);
                if (pMatch) {
                    els.projectBadgeName.textContent = pMatch.name;
                    els.projectBadge.style.display = 'inline-flex';
                }
            }

            showState('capturing');
            startDurationTimer();
            startStatsPolling();
        } else {
            showState('ready');
        }
    } else {
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
    const stats = await chrome.storage.local.get(['captionStats', 'audioStats']);
    if (stats.captionStats) {
        els.eventCount.textContent = stats.captionStats.totalEvents || 0;
        els.sentCount.textContent = stats.captionStats.totalSentEvents || 0;
    }
    if (stats.audioStats) {
        els.audioStatsDisplay.textContent = stats.audioStats.audioTranscripts || 0;
    }

    // Also get status from background
    const bgStatus = await sendToBackground('POPUP_GET_STATUS');
    if (bgStatus) {
        els.sentCount.textContent = bgStatus.totalSentEvents || 0;
        els.audioStatsDisplay.textContent = bgStatus.audioTranscripts || 0;
        if (bgStatus.audioActive) {
            els.audioActiveLabel.innerHTML = '🎙️ Audio Segments';
            els.audioActiveLabel.style.color = 'var(--text-success)';
        } else {
            els.audioActiveLabel.innerHTML = 'Audio Inactive';
            els.audioActiveLabel.style.color = 'var(--text-muted)';
        }
        if (bgStatus.currentMeetingId) {
            els.meetingIdDisplay.textContent = shortenId(bgStatus.currentMeetingId);
        }
    }
}

/* ───────────────────────────────────────────
   Event Handlers
   ─────────────────────────────────────────── */

// Start Capture
els.startBtn.addEventListener('click', async () => {
    if (!currentTabId || !currentMeetUrl) return;

    // Prompt for microphone permission before proceeding
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Permission granted, close the tracks immediately
        stream.getTracks().forEach(track => track.stop());
    } catch (err) {
        // If it throws an error in the popup (likely due to Chrome security), route user to options page
        els.startBtn.innerHTML = 'Mic Permission Required';
        chrome.runtime.openOptionsPage();
        return; // Halt if permission denied/failed
    }

    els.startBtn.disabled = true;
    els.startBtn.textContent = 'Starting...';

    const selectedProjectId = els.projectSelect.value;

    const result = await sendToBackground('POPUP_START_CAPTURE', {
        meetUrl: currentMeetUrl,
        tabId: currentTabId,
        projectId: selectedProjectId || null,
    });

    if (result?.success) {
        captureStartTime = Date.now();
        els.meetingIdDisplay.textContent = shortenId(result.meetingId);

        // Show project badge if attached to project
        if (selectedProjectId) {
            const match = availableProjects.find(p => p.id === selectedProjectId);
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
        // No more manual auth token saved
    });

    if (result?.success) {
        showSettingsStatus('Settings saved ✓', 'success');
        // Refresh auth status
        const healthResult = await sendToBackground('POPUP_HEALTH_CHECK');
        if (healthResult?.isAuthenticated) {
            els.authStatusBadge.innerHTML = '✅ Authenticated';
            els.authStatusBadge.style.color = 'var(--text-success)';
            els.authStatusBadge.style.borderColor = 'var(--border-success)';
            els.authStatusBadge.style.backgroundColor = 'var(--bg-success)';
        } else {
            els.authStatusBadge.innerHTML = '❌ Please Log into Dashboard';
            els.authStatusBadge.style.color = 'var(--text-danger)';
            els.authStatusBadge.style.borderColor = 'var(--border-danger)';
            els.authStatusBadge.style.backgroundColor = 'var(--bg-danger)';
        }
    } else {
        showSettingsStatus('Failed to save settings', 'error');
    }
});

// Test Connection
els.testConnectionBtn.addEventListener('click', async () => {
    // Save first so the health check uses the new URL
    await sendToBackground('POPUP_SAVE_SETTINGS', {
        backendUrl: els.backendUrlInput.value,
    });

    setConnection('checking', 'Testing connection...');
    const result = await sendToBackground('POPUP_HEALTH_CHECK');

    if (result?.healthy) {
        setConnection('connected', `Connected to ${result.backendUrl}`);
        
        if (result.isAuthenticated) {
            els.authStatusBadge.innerHTML = '✅ Authenticated';
            els.authStatusBadge.style.color = 'var(--text-success)';
            els.authStatusBadge.style.borderColor = 'var(--border-success)';
            els.authStatusBadge.style.backgroundColor = 'var(--bg-success)';
        } else {
            els.authStatusBadge.innerHTML = '❌ Please Log into Dashboard';
            els.authStatusBadge.style.color = 'var(--text-danger)';
            els.authStatusBadge.style.borderColor = 'var(--border-danger)';
            els.authStatusBadge.style.backgroundColor = 'var(--bg-danger)';
        }

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
