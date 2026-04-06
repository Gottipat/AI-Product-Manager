/**
 * @fileoverview Offscreen Audio Recorder
 * @description Records Google Meet tab audio and uploads the final WebM file
 *   to the AI backend when capture stops.
 */

let mediaStream = null;
let mediaRecorder = null;
let audioChunks = [];
let activeMeetingId = null;

function getPreferredMimeType() {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }

  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return 'audio/webm;codecs=opus';
  }

  if (MediaRecorder.isTypeSupported('audio/webm')) {
    return 'audio/webm';
  }

  return '';
}

function stopTracks() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
  }
  mediaStream = null;
}

function resetRecordingState() {
  audioChunks = [];
  activeMeetingId = null;
  mediaRecorder = null;
  stopTracks();
}

async function getBackendConfig() {
  const { backendUrl, authToken } = await chrome.storage.local.get(['backendUrl', 'authToken']);
  return {
    backendUrl: (backendUrl || 'http://localhost:3002').replace(/\/$/, ''),
    authToken: authToken || null,
  };
}

async function uploadAudio(meetingId, blob) {
  if (!meetingId) {
    throw new Error('Missing meeting ID for audio upload.');
  }

  if (!blob || blob.size === 0) {
    throw new Error('Recorded audio was empty.');
  }

  const { backendUrl, authToken } = await getBackendConfig();
  const headers = {
    'Content-Type': blob.type || 'audio/webm',
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${backendUrl}/api/v1/meetings/${meetingId}/audio`, {
    method: 'POST',
    headers,
    body: blob,
  });

  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    throw new Error(data.error || `Audio upload failed: ${response.status}`);
  }

  return data;
}

async function startRecording(streamId, meetingId) {
  if (!streamId) {
    throw new Error('Missing tab audio stream ID.');
  }

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    throw new Error('Audio recording is already active.');
  }

  const constraints = {
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
    },
    video: false,
  };

  mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
  audioChunks = [];
  activeMeetingId = meetingId;

  const mimeType = getPreferredMimeType();
  mediaRecorder = mimeType
    ? new MediaRecorder(mediaStream, { mimeType })
    : new MediaRecorder(mediaStream);

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  mediaRecorder.start(1000);
}

async function stopRecording(meetingId) {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    resetRecordingState();
    return { uploaded: false, skipped: true };
  }

  const recorder = mediaRecorder;
  const finalMeetingId = meetingId || activeMeetingId;

  return new Promise((resolve, reject) => {
    recorder.onerror = () => {
      const message = recorder.error?.message || 'Audio recorder failed.';
      resetRecordingState();
      reject(new Error(message));
    };

    recorder.onstop = async () => {
      try {
        const blob = new Blob(audioChunks, {
          type: recorder.mimeType || 'audio/webm',
        });
        const uploadResult = await uploadAudio(finalMeetingId, blob);
        resolve({
          uploaded: true,
          bytes: blob.size,
          mimeType: blob.type || 'audio/webm',
          ...uploadResult,
        });
      } catch (error) {
        reject(error);
      } finally {
        resetRecordingState();
      }
    };

    try {
      recorder.requestData();
    } catch {
      // MediaRecorder may throw if it has no buffered chunk yet.
    }

    recorder.stop();
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'OFFSCREEN_START_AUDIO_RECORDING':
      (async () => {
        try {
          await startRecording(message.data?.streamId, message.data?.meetingId);
          sendResponse({ success: true });
        } catch (error) {
          resetRecordingState();
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'OFFSCREEN_STOP_AUDIO_RECORDING':
      (async () => {
        try {
          const result = await stopRecording(message.data?.meetingId);
          sendResponse({ success: true, ...result });
        } catch (error) {
          resetRecordingState();
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    default:
      break;
  }

  return false;
});
