/**
 * @fileoverview Offscreen Audio Recorder
 * @description Records Google Meet tab audio and uploads the final WebM file
 *   to the AI backend when capture stops.
 */

let mixedStream = null;
let tabStream = null;
let microphoneStream = null;
let mediaRecorder = null;
let audioChunks = [];
let activeMeetingId = null;
let audioContext = null;
let audioDestination = null;
let audioMixMode = 'tab_only';
let activeUploadConfig = null;

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
  if (tabStream) {
    tabStream.getTracks().forEach((track) => track.stop());
  }

  if (microphoneStream) {
    microphoneStream.getTracks().forEach((track) => track.stop());
  }

  if (mixedStream) {
    mixedStream.getTracks().forEach((track) => track.stop());
  }

  tabStream = null;
  microphoneStream = null;
  mixedStream = null;
}

async function resetRecordingState() {
  audioChunks = [];
  activeMeetingId = null;
  mediaRecorder = null;
  audioMixMode = 'tab_only';
  activeUploadConfig = null;
  stopTracks();

  if (audioContext) {
    try {
      await audioContext.close();
    } catch {
      // Ignore context cleanup errors.
    }
  }

  audioContext = null;
  audioDestination = null;
}

async function uploadAudio(meetingId, blob) {
  if (!meetingId) {
    throw new Error('Missing meeting ID for audio upload.');
  }

  if (!blob || blob.size === 0) {
    throw new Error('Recorded audio was empty.');
  }

  const backendUrl = (activeUploadConfig?.backendUrl || 'http://localhost:3002').replace(/\/$/, '');
  const authToken = activeUploadConfig?.authToken || null;
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

async function startRecording(streamId, meetingId, uploadConfig = null) {
  if (!streamId) {
    throw new Error('Missing tab audio stream ID.');
  }

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    throw new Error('Audio recording is already active.');
  }

  const tabConstraints = {
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
    },
    video: false,
  };

  tabStream = await navigator.mediaDevices.getUserMedia(tabConstraints);
  audioChunks = [];
  activeMeetingId = meetingId;
  activeUploadConfig = uploadConfig;
  audioMixMode = 'tab_only';

  audioContext = new AudioContext();
  audioDestination = audioContext.createMediaStreamDestination();

  const tabSource = audioContext.createMediaStreamSource(tabStream);
  tabSource.connect(audioDestination);
  tabSource.connect(audioContext.destination);

  try {
    microphoneStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    const microphoneSource = audioContext.createMediaStreamSource(microphoneStream);
    microphoneSource.connect(audioDestination);
    audioMixMode = 'mixed_tab_and_mic';
  } catch (error) {
    microphoneStream = null;
    console.warn(
      '[Meeting AI Offscreen] Microphone unavailable, falling back to tab audio only.',
      error
    );
  }

  mixedStream = audioDestination.stream;

  const mimeType = getPreferredMimeType();
  mediaRecorder = mimeType
    ? new MediaRecorder(mixedStream, { mimeType })
    : new MediaRecorder(mixedStream);

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  mediaRecorder.start(1000);

  return {
    audioMixMode,
    microphoneIncluded: audioMixMode === 'mixed_tab_and_mic',
  };
}

async function stopRecording(meetingId) {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    await resetRecordingState();
    return { uploaded: false, skipped: true, audioMixMode };
  }

  const recorder = mediaRecorder;
  const finalMeetingId = meetingId || activeMeetingId;
  const finalAudioMixMode = audioMixMode;

  return new Promise((resolve, reject) => {
    recorder.onerror = () => {
      const message = recorder.error?.message || 'Audio recorder failed.';
      void resetRecordingState();
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
          audioMixMode: finalAudioMixMode,
          microphoneIncluded: finalAudioMixMode === 'mixed_tab_and_mic',
          ...uploadResult,
        });
      } catch (error) {
        reject(error);
      } finally {
        await resetRecordingState();
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
          const result = await startRecording(
            message.data?.streamId,
            message.data?.meetingId,
            message.data?.uploadConfig || null
          );
          sendResponse({ success: true, ...result });
        } catch (error) {
          await resetRecordingState();
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
          await resetRecordingState();
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    default:
      break;
  }

  return false;
});
