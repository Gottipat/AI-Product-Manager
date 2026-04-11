/**
 * @fileoverview Offscreen Document for Audio Capture + Transcription
 * @description Captures tab audio + microphone, then:
 *   1. Records WebM/Opus → sends via WebSocket to backend for disk storage (playback)
 *   2. Captures raw PCM Int16 at 16kHz via AudioWorklet → sends via WebSocket for Deepgram AI transcription
 *
 * Two parallel WebSocket connections:
 *   /api/v1/meetings/{id}/recording-stream  — WebM binary for file storage
 *   /api/v1/meetings/{id}/audio-stream      — PCM binary for Deepgram transcription
 */

let audioContext = null;
let mediaRecorder = null;
let pcmWorkletNode = null;
let recordingWs = null;
let transcriptionWs = null;
let stream = null;
let keepAliveInterval = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target !== 'offscreen') return false;

    if (message.type === 'START_AUDIO') {
        console.log('[Offscreen] Received START_AUDIO:', message.meetingId);
        startAudioCapture(message.streamId, message.meetingId, message.backendUrl)
            .then(() => {
                console.log('[Offscreen] Audio capture started successfully');
                sendResponse({ success: true });
            })
            .catch((err) => {
                console.error('[Offscreen] Audio capture FAILED:', err);
                sendResponse({ success: false, error: err.message });
            });
        return true;
    }

    if (message.type === 'STOP_AUDIO') {
        console.log('[Offscreen] Received STOP_AUDIO');
        stopAudioCapture();
        sendResponse({ success: true });
        return false;
    }
});

async function startAudioCapture(streamId, meetingId, backendUrl) {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        throw new Error('Capture already active');
    }

    console.log('[Offscreen] Getting tab audio stream...');

    // ─── 1. Get media streams ───
    stream = await navigator.mediaDevices.getUserMedia({
        audio: {
            mandatory: {
                chromeMediaSource: 'tab',
                chromeMediaSourceId: streamId,
            },
        },
        video: false,
    });
    console.log('[Offscreen] Tab stream OK, audio tracks:', stream.getAudioTracks().length);

    let micStream = null;
    try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        console.log('[Offscreen] Mic stream OK');
    } catch (e) {
        console.warn('[Offscreen] No mic access — tab audio only:', e.message);
    }

    // ─── 2. AudioContext at 16kHz ───
    audioContext = new AudioContext({ sampleRate: 16000 });
    if (audioContext.state === 'suspended') await audioContext.resume();
    console.log('[Offscreen] AudioContext ready, sampleRate:', audioContext.sampleRate);

    // Mixer destination — all sources connect here
    const mixerDest = audioContext.createMediaStreamDestination();

    if (stream.getAudioTracks().length > 0) {
        const tabSource = audioContext.createMediaStreamSource(stream);
        tabSource.connect(audioContext.destination); // user hears meeting
        tabSource.connect(mixerDest);                // mixer for recording
    }

    if (micStream && micStream.getAudioTracks().length > 0) {
        const micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(mixerDest);
        micStream.getTracks().forEach(t => stream.addTrack(t));
    }

    const mixedStream = mixerDest.stream;

    // ─── 3. Recording WebSocket (WebM → disk) ───
    const recUrl = new URL(`/api/v1/meetings/${meetingId}/recording-stream`, backendUrl);
    recUrl.protocol = recUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    console.log('[Offscreen] Connecting Recording WS:', recUrl.href);

    recordingWs = new WebSocket(recUrl.href);
    recordingWs.onopen = () => {
        console.log('[Offscreen] Recording WS OPEN');
        startWebmRecording(mixedStream);
    };
    recordingWs.onerror = () => console.error('[Offscreen] Recording WS error');
    recordingWs.onclose = () => console.log('[Offscreen] Recording WS closed');

    // ─── 4. Transcription WebSocket (PCM → Deepgram) ───
    const txUrl = new URL(`/api/v1/meetings/${meetingId}/audio-stream`, backendUrl);
    txUrl.protocol = txUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    console.log('[Offscreen] Connecting Transcription WS:', txUrl.href);

    transcriptionWs = new WebSocket(txUrl.href);
    transcriptionWs.binaryType = 'arraybuffer';
    transcriptionWs.onopen = async () => {
        console.log('[Offscreen] Transcription WS OPEN');
        await startPcmCapture(mixedStream);
    };
    transcriptionWs.onmessage = (evt) => {
        try {
            const msg = JSON.parse(evt.data);
            if (msg.type === 'transcript' && msg.isFinal) {
                console.log(`[Offscreen] TRANSCRIPT: [${msg.speaker}] ${msg.text}`);
                chrome.runtime.sendMessage({
                    type: 'AUDIO_TRANSCRIPT',
                    data: { speaker: msg.speaker, text: msg.text },
                }).catch(() => {});
            } else if (msg.type === 'error') {
                console.error('[Offscreen] Transcription error:', msg.message);
            } else if (msg.type === 'connected') {
                console.log('[Offscreen] Backend:', msg.message);
            }
        } catch { /* binary */ }
    };
    transcriptionWs.onerror = () => console.error('[Offscreen] Transcription WS error');
    transcriptionWs.onclose = () => console.log('[Offscreen] Transcription WS closed');

    // ─── 5. Keep-alive ───
    keepAliveInterval = setInterval(() => {
        if (recordingWs?.readyState === WebSocket.OPEN) {
            recordingWs.send(JSON.stringify({ type: 'ping' }));
        }
    }, 10000);
}

/**
 * WebM recording for audio playback
 */
function startWebmRecording(mediaStream) {
    let options = { mimeType: 'audio/webm;codecs=opus' };
    try {
        mediaRecorder = new MediaRecorder(mediaStream, options);
    } catch {
        mediaRecorder = new MediaRecorder(mediaStream);
    }

    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0 && recordingWs?.readyState === WebSocket.OPEN) {
            recordingWs.send(e.data);
        }
    };
    mediaRecorder.start(250);
    console.log('[Offscreen] WebM recorder started');
}

/**
 * PCM capture via AudioWorkletNode (replaces deprecated ScriptProcessorNode).
 * The PcmProcessor worklet converts Float32 → Int16 on the audio thread,
 * then posts the buffer to the main thread for WebSocket transmission.
 */
async function startPcmCapture(mixedStream) {
    try {
        // Register the PCM processor worklet
        await audioContext.audioWorklet.addModule('pcm-processor.js');
        console.log('[Offscreen] PCM AudioWorklet registered');
    } catch (err) {
        console.error('[Offscreen] AudioWorklet registration failed, falling back to ScriptProcessor:', err);
        startPcmCaptureFallback(mixedStream);
        return;
    }

    // Create source from the mixed stream
    const sourceNode = audioContext.createMediaStreamSource(mixedStream);

    // Create the worklet node
    pcmWorkletNode = new AudioWorkletNode(audioContext, 'pcm-processor');

    let chunkCount = 0;

    // Receive PCM Int16 buffers from the audio thread
    pcmWorkletNode.port.onmessage = (event) => {
        if (!transcriptionWs || transcriptionWs.readyState !== WebSocket.OPEN) return;

        transcriptionWs.send(event.data); // ArrayBuffer of Int16 PCM
        chunkCount++;
        if (chunkCount % 100 === 0) {
            console.log(`[Offscreen] PCM chunks sent: ${chunkCount}`);
        }
    };

    // Wire: source → worklet → destination (keeps worklet alive)
    sourceNode.connect(pcmWorkletNode);
    pcmWorkletNode.connect(audioContext.destination);

    console.log('[Offscreen] PCM AudioWorklet capture started (16kHz Int16 mono)');
}

/**
 * Fallback: ScriptProcessorNode (in case AudioWorklet fails)
 */
function startPcmCaptureFallback(mixedStream) {
    const sourceNode = audioContext.createMediaStreamSource(mixedStream);
    const bufferSize = 4096;
    const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);

    sourceNode.connect(processor);
    processor.connect(audioContext.destination);

    let chunkCount = 0;

    processor.onaudioprocess = (event) => {
        if (!transcriptionWs || transcriptionWs.readyState !== WebSocket.OPEN) return;

        const float32 = event.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
            const s = Math.max(-1, Math.min(1, float32[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        transcriptionWs.send(int16.buffer);
        chunkCount++;
        if (chunkCount % 100 === 0) {
            console.log(`[Offscreen] PCM chunks (fallback): ${chunkCount}`);
        }
    };

    // Store for cleanup
    pcmWorkletNode = processor;
    console.log('[Offscreen] PCM ScriptProcessor fallback started');
}

function stopAudioCapture() {
    console.log('[Offscreen] Stopping all capture...');

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }

    if (pcmWorkletNode) {
        pcmWorkletNode.disconnect();
        pcmWorkletNode = null;
    }

    if (recordingWs && recordingWs.readyState !== WebSocket.CLOSED) {
        recordingWs.close();
    }
    if (transcriptionWs && transcriptionWs.readyState !== WebSocket.CLOSED) {
        transcriptionWs.close();
    }

    if (stream) {
        stream.getTracks().forEach(t => t.stop());
    }
    if (audioContext) {
        audioContext.close().catch(() => {});
    }
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
    }

    audioContext = null;
    mediaRecorder = null;
    pcmWorkletNode = null;
    recordingWs = null;
    transcriptionWs = null;
    stream = null;
    keepAliveInterval = null;

    console.log('[Offscreen] All capture stopped');
}
