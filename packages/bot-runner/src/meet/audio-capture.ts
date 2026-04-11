/**
 * @fileoverview Audio Capture Controller
 * @description Intercepts Google Meet WebRTC audio streams via RTCPeerConnection
 * monkey-patching. This is the same approach used by Fireflies, Otter, and Fathom.
 *
 * Flow:
 * 1. Before page.goto(), inject addInitScript to hook RTCPeerConnection.prototype
 * 2. When Meet creates RTCPeerConnections and receives ontrack events, our hook
 *    intercepts each remote audio MediaStreamTrack
 * 3. All tracks are mixed into a single AudioContext → MediaStreamDestination
 * 4. A MediaRecorder records from the destination, emitting chunks every ~250ms
 * 5. Chunks are base64-encoded and forwarded to Node.js via window.__onAudioChunk()
 */

import pino from 'pino';
import { Page } from 'playwright';

const logger = pino({ name: 'audio-capture' });

/** Handler called with each audio chunk */
export type AudioChunkHandler = (chunk: Buffer, timestamp: number) => void;

/**
 * AudioCaptureController manages WebRTC audio interception in the browser
 */
export class AudioCaptureController {
  private page: Page | null = null;
  private handlers: AudioChunkHandler[] = [];
  private isRecording: boolean = false;
  private hooksInjected: boolean = false;
  private exposedFunctionSetup: boolean = false;
  private chunks: Buffer[] = [];
  private totalChunks: number = 0;
  private startTime: number = 0;

  /**
   * Inject the WebRTC audio interception hooks into the page.
   * MUST be called BEFORE page.goto() so the init script runs before
   * Google Meet's JavaScript initializes RTCPeerConnection.
   */
  async injectAudioHooks(page: Page): Promise<void> {
    this.page = page;

    if (this.hooksInjected) {
      logger.warn('Audio hooks already injected');
      return;
    }

    logger.info('Injecting WebRTC audio interception hooks...');

    // Add the init script that will run before any page JavaScript
    await page.addInitScript(() => {
      // ═══════════════════════════════════════════════════════════
      // WebRTC Audio Interception — runs in the browser context
      // ═══════════════════════════════════════════════════════════

      // State tracking
      const audioState = {
        audioContext: null as AudioContext | null,
        destination: null as MediaStreamAudioDestinationNode | null,
        recorder: null as MediaRecorder | null,
        tracks: new Map<string, MediaStreamAudioSourceNode>(),
        isRecording: false,
        trackCount: 0,
      };

      // Make state accessible globally for control from Node.js
      // @ts-expect-error - global state for audio capture
      window.__audioState = audioState;

      /**
       * Initialize the audio mixing pipeline
       */
      function initAudioPipeline(): void {
        if (audioState.audioContext) return;

        try {
          audioState.audioContext = new AudioContext({ sampleRate: 16000 });
          audioState.destination = audioState.audioContext.createMediaStreamDestination();

          console.log('[AudioCapture] Audio pipeline initialized (16kHz)');
        } catch (err) {
          console.error('[AudioCapture] Failed to initialize audio pipeline:', err);
        }
      }

      /**
       * Add a new audio track to the mixing pipeline
       */
      function addTrackToMixer(track: MediaStreamTrack, label: string): void {
        if (!audioState.audioContext || !audioState.destination) {
          initAudioPipeline();
        }

        if (!audioState.audioContext || !audioState.destination) {
          console.error('[AudioCapture] Cannot add track — pipeline not ready');
          return;
        }

        // Skip if we already have this track
        if (audioState.tracks.has(track.id)) {
          return;
        }

        try {
          const stream = new MediaStream([track]);
          const source = audioState.audioContext.createMediaStreamSource(stream);

          // Connect to destination (mixer output)
          source.connect(audioState.destination);
          audioState.tracks.set(track.id, source);
          audioState.trackCount++;

          console.log(
            `[AudioCapture] Added audio track: ${label} (id: ${track.id}), total: ${audioState.trackCount}`
          );

          // Handle track ending
          track.addEventListener('ended', () => {
            console.log(`[AudioCapture] Track ended: ${label} (id: ${track.id})`);
            const src = audioState.tracks.get(track.id);
            if (src) {
              try {
                src.disconnect();
              } catch {
                // May already be disconnected
              }
              audioState.tracks.delete(track.id);
            }
          });
        } catch (err) {
          console.error(`[AudioCapture] Failed to add track ${label}:`, err);
        }
      }

      // ─── Monkey-patch RTCPeerConnection ──────────────────────

      const OriginalRTCPeerConnection = window.RTCPeerConnection;

      (window as unknown as Record<string, unknown>).RTCPeerConnection = function (
        this: RTCPeerConnection,
        config?: RTCConfiguration
      ): RTCPeerConnection {
        console.log('[AudioCapture] RTCPeerConnection created');

        const pc = new OriginalRTCPeerConnection(config);

        // Hook the ontrack setter to intercept incoming media tracks
        const originalOnTrack = Object.getOwnPropertyDescriptor(
          RTCPeerConnection.prototype,
          'ontrack'
        );

        // Also hook addEventListener for 'track' events
        const originalAddEventListener = pc.addEventListener.bind(pc);
        pc.addEventListener = function (
          type: string,
          listener: EventListenerOrEventListenerObject,
          options?: boolean | AddEventListenerOptions
        ): void {
          if (type === 'track') {
            const wrappedListener = function (event: Event): void {
              const trackEvent = event as RTCTrackEvent;
              if (trackEvent.track && trackEvent.track.kind === 'audio') {
                console.log('[AudioCapture] Intercepted audio track via addEventListener');
                addTrackToMixer(trackEvent.track, `remote-${audioState.trackCount}`);
              }
              if (typeof listener === 'function') {
                listener.call(pc, event);
              } else {
                listener.handleEvent(event);
              }
            };
            originalAddEventListener(type, wrappedListener as EventListener, options);
          } else {
            originalAddEventListener(type, listener, options);
          }
        };

        // Also intercept direct ontrack assignment
        let storedOnTrack: ((event: RTCTrackEvent) => void) | null = null;
        Object.defineProperty(pc, 'ontrack', {
          get: () => storedOnTrack,
          set: (handler: ((event: RTCTrackEvent) => void) | null) => {
            storedOnTrack = handler;
            if (originalOnTrack && originalOnTrack.set) {
              originalOnTrack.set.call(pc, (event: RTCTrackEvent) => {
                if (event.track && event.track.kind === 'audio') {
                  console.log('[AudioCapture] Intercepted audio track via ontrack setter');
                  addTrackToMixer(event.track, `remote-${audioState.trackCount}`);
                }
                if (handler) handler(event);
              });
            }
          },
          configurable: true,
        });

        return pc;
      } as unknown as typeof RTCPeerConnection;

      // Preserve prototype chain
      window.RTCPeerConnection.prototype = OriginalRTCPeerConnection.prototype;

      // Copy static properties
      Object.getOwnPropertyNames(OriginalRTCPeerConnection).forEach((prop) => {
        if (prop !== 'prototype' && prop !== 'length' && prop !== 'name') {
          try {
            // @ts-expect-error - copying static properties
            window.RTCPeerConnection[prop] = OriginalRTCPeerConnection[prop];
          } catch {
            // Some properties may not be writable
          }
        }
      });

      // ─── Recording control functions ─────────────────────────

      // @ts-expect-error - global function for starting recording
      window.__startAudioRecording = function (): boolean {
        if (audioState.isRecording) {
          console.log('[AudioCapture] Already recording');
          return true;
        }

        if (!audioState.destination) {
          console.warn('[AudioCapture] No audio destination — no tracks captured yet');
          // Initialize pipeline anyway so recording starts when tracks arrive
          initAudioPipeline();
          if (!audioState.destination) return false;
        }

        try {
          // Determine best codec
          let mimeType = 'audio/webm;codecs=opus';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/webm';
          }
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/ogg;codecs=opus';
          }

          audioState.recorder = new MediaRecorder(audioState.destination.stream, {
            mimeType,
            audioBitsPerSecond: 32000, // 32kbps — efficient for speech
          });

          audioState.recorder.ondataavailable = async (event: BlobEvent) => {
            if (event.data && event.data.size > 0) {
              // Convert Blob to base64 for transfer to Node.js
              const buffer = await event.data.arrayBuffer();
              const bytes = new Uint8Array(buffer);
              let binary = '';
              for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]!);
              }
              const base64 = btoa(binary);

              // Send to Node.js via exposed function
              try {
                // @ts-expect-error - calling exposed function
                if (window.__onAudioChunk) {
                  // @ts-expect-error - calling exposed function
                  window.__onAudioChunk({
                    data: base64,
                    timestamp: Date.now(),
                    size: event.data.size,
                    trackCount: audioState.tracks.size,
                  });
                }
              } catch (err) {
                console.error('[AudioCapture] Failed to send chunk:', err);
              }
            }
          };

          audioState.recorder.onerror = (event: Event) => {
            console.error('[AudioCapture] MediaRecorder error:', event);
          };

          // Start recording with 250ms timeslice
          audioState.recorder.start(250);
          audioState.isRecording = true;

          console.log(`[AudioCapture] Recording started (${mimeType}, 250ms chunks)`);
          return true;
        } catch (err) {
          console.error('[AudioCapture] Failed to start recording:', err);
          return false;
        }
      };

      // @ts-expect-error - global function for stopping recording
      window.__stopAudioRecording = function (): void {
        if (audioState.recorder && audioState.isRecording) {
          audioState.recorder.stop();
          audioState.isRecording = false;
          console.log('[AudioCapture] Recording stopped');
        }
      };

      // @ts-expect-error - global function for getting status
      window.__getAudioCaptureStatus = function (): object {
        return {
          isRecording: audioState.isRecording,
          trackCount: audioState.tracks.size,
          hasAudioContext: audioState.audioContext !== null,
          hasDestination: audioState.destination !== null,
          audioContextState: audioState.audioContext?.state || 'none',
        };
      };

      console.log('[AudioCapture] WebRTC hooks installed');
    });

    this.hooksInjected = true;
    logger.info('✅ WebRTC audio hooks injected');
  }

  /**
   * Set up the exposed function bridge for receiving audio chunks from the browser.
   * Must be called AFTER the page is created but BEFORE startRecording.
   */
  async setupChunkReceiver(page: Page): Promise<void> {
    if (this.exposedFunctionSetup) return;

    this.page = page;

    await page.exposeFunction(
      '__onAudioChunk',
      (data: { data: string; timestamp: number; size: number; trackCount: number }) => {
        this.handleAudioChunk(data);
      }
    );

    this.exposedFunctionSetup = true;
    logger.debug('Audio chunk receiver exposed to browser');
  }

  /**
   * Start recording audio from intercepted WebRTC streams
   */
  async startRecording(): Promise<boolean> {
    if (!this.page) {
      logger.error('No page set — call injectAudioHooks first');
      return false;
    }

    if (this.isRecording) {
      logger.warn('Already recording');
      return true;
    }

    logger.info('Starting audio recording...');
    this.startTime = Date.now();

    try {
      // Call the browser-side start function
      const started = await this.page.evaluate(() => {
        // @ts-expect-error - calling injected function
        return window.__startAudioRecording?.() ?? false;
      });

      if (started) {
        this.isRecording = true;
        logger.info('✅ Audio recording started');
      } else {
        logger.warn('Audio recording could not start — no tracks captured yet. Will retry.');
        // Set up a retry: poll until tracks appear
        this.startRetryLoop();
      }

      return started;
    } catch (error) {
      logger.error({ error }, 'Failed to start audio recording');
      return false;
    }
  }

  /**
   * Retry starting recording until audio tracks are available
   */
  private startRetryLoop(): void {
    const maxRetries = 30; // 30 * 2s = 60s max wait
    let retries = 0;

    const retryTimer = setInterval(async () => {
      if (this.isRecording || !this.page) {
        clearInterval(retryTimer);
        return;
      }

      retries++;
      if (retries > maxRetries) {
        logger.error('Audio recording failed after max retries — no WebRTC tracks detected');
        clearInterval(retryTimer);
        return;
      }

      try {
        const status = await this.page.evaluate(() => {
          // @ts-expect-error - calling injected function
          return window.__getAudioCaptureStatus?.() ?? {};
        });

        logger.debug({ status, retry: retries }, 'Checking for audio tracks...');

        if ((status as Record<string, unknown>).trackCount as number > 0) {
          const started = await this.page.evaluate(() => {
            // @ts-expect-error - calling injected function
            return window.__startAudioRecording?.() ?? false;
          });

          if (started) {
            this.isRecording = true;
            logger.info('✅ Audio recording started (after retry)');
            clearInterval(retryTimer);
          }
        }
      } catch (error) {
        logger.debug({ error }, 'Retry check failed (page may have navigated)');
      }
    }, 2000);
  }

  /**
   * Stop recording audio
   */
  async stopRecording(): Promise<void> {
    if (!this.page || !this.isRecording) {
      return;
    }

    logger.info('Stopping audio recording...');

    try {
      await this.page.evaluate(() => {
        // @ts-expect-error - calling injected function
        window.__stopAudioRecording?.();
      });
    } catch (error) {
      logger.debug({ error }, 'Error stopping recording (page may be closed)');
    }

    this.isRecording = false;
    const durationMs = Date.now() - this.startTime;
    logger.info(
      {
        totalChunks: this.totalChunks,
        totalBytes: this.chunks.reduce((sum, c) => sum + c.length, 0),
        durationMs,
      },
      '✅ Audio recording stopped'
    );
  }

  /**
   * Register a handler for audio chunks
   */
  onChunk(handler: AudioChunkHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Remove a chunk handler
   */
  offChunk(handler: AudioChunkHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index > -1) {
      this.handlers.splice(index, 1);
    }
  }

  /**
   * Get the full recording as a single Buffer (concatenated chunks)
   */
  getRecordingBuffer(): Buffer {
    return Buffer.concat(this.chunks);
  }

  /**
   * Get recording stats
   */
  getStats(): {
    isRecording: boolean;
    totalChunks: number;
    totalBytes: number;
    durationMs: number;
  } {
    return {
      isRecording: this.isRecording,
      totalChunks: this.totalChunks,
      totalBytes: this.chunks.reduce((sum, c) => sum + c.length, 0),
      durationMs: this.startTime ? Date.now() - this.startTime : 0,
    };
  }

  /**
   * Get capture status from the browser
   */
  async getBrowserStatus(): Promise<Record<string, unknown>> {
    if (!this.page) return {};

    try {
      return (await this.page.evaluate(() => {
        // @ts-expect-error - calling injected function
        return window.__getAudioCaptureStatus?.() ?? {};
      })) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  /**
   * Handle incoming audio chunk from the browser
   */
  private handleAudioChunk(data: {
    data: string;
    timestamp: number;
    size: number;
    trackCount: number;
  }): void {
    try {
      // Decode base64 to Buffer
      const chunk = Buffer.from(data.data, 'base64');
      this.chunks.push(chunk);
      this.totalChunks++;

      // Log periodically (every 40 chunks ≈ 10 seconds)
      if (this.totalChunks % 40 === 0) {
        logger.info(
          {
            chunks: this.totalChunks,
            totalBytes: this.chunks.reduce((sum, c) => sum + c.length, 0),
            activeTracks: data.trackCount,
          },
          'Audio capture progress'
        );
      }

      // Emit to handlers
      for (const handler of this.handlers) {
        try {
          handler(chunk, data.timestamp);
        } catch (error) {
          logger.error({ error }, 'Error in audio chunk handler');
        }
      }
    } catch (error) {
      logger.error({ error }, 'Failed to process audio chunk');
    }
  }
}
