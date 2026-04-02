/**
 * @fileoverview Transcription Service
 * @description Real-time audio transcription with speaker diarization using Deepgram SDK v5.
 * Uses the v1 streaming API (which supports diarization natively).
 * Receives streaming audio chunks, sends to Deepgram via WebSocket,
 * and maps diarized speaker labels to actual participant names.
 */

import {
  DeepgramClient,
  ListenV1Diarize,
  ListenV1Encoding,
  ListenV1InterimResults,
  ListenV1Model,
  ListenV1Punctuate,
  ListenV1SmartFormat,
  ListenV1VadEvents,
  listen,
} from '@deepgram/sdk';
import pino from 'pino';

const logger = pino({ name: 'transcription-service' });

// Derive the V1Socket type from the SDK
type V1Socket = Awaited<ReturnType<InstanceType<typeof DeepgramClient>['listen']['v1']['connect']>>;

/**
 * A single diarized transcript segment from Deepgram
 */
export interface TranscriptSegment {
  /** The transcribed text */
  text: string;
  /** Speaker index from Deepgram (0, 1, 2...) */
  speakerIndex: number;
  /** Mapped speaker name (from participant list) */
  speakerName: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Start time of this segment in seconds */
  startTime: number;
  /** End time of this segment in seconds */
  endTime: number;
  /** Whether this is a final (non-interim) result */
  isFinal: boolean;
  /** Timestamp when received */
  receivedAt: Date;
}

export type TranscriptHandler = (segment: TranscriptSegment) => void;

/**
 * Configuration for a transcription session
 */
export interface TranscriptionConfig {
  /** Meeting ID for this session */
  meetingId: string;
  /** Known participant names (used for speaker mapping) */
  participants?: string[];
  /** Language for transcription (default: en) */
  language?: string;
  /**
   * Audio format being streamed.
   *   'pcm'  — raw Linear16 PCM at 16kHz (from bot-runner)
   *   'webm' — WebM/Opus container (from Chrome extension)
   */
  audioFormat?: 'pcm' | 'webm';
}

/**
 * TranscriptionService manages real-time audio → text with speaker diarization
 * using Deepgram SDK v5's V1 streaming API.
 */
export class TranscriptionService {
  private deepgramClient: DeepgramClient;
  private liveConnection: V1Socket | null = null;
  private handlers: TranscriptHandler[] = [];
  private speakerMap: Map<number, string> = new Map();
  private participants: string[] = [];
  private meetingId: string = '';
  private isActive: boolean = false;
  private isConnectionOpen: boolean = false;
  private pendingChunks: Buffer[] = [];        // buffer audio until WS is open
  private segmentCount: number = 0;
  private nextUnmappedIndex: number = 0;
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.DEEPGRAM_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('DEEPGRAM_API_KEY not set — transcription will not be available');
    }
    this.deepgramClient = new DeepgramClient();
  }

  /**
   * Start a new transcription session
   */
  async startSession(config: TranscriptionConfig): Promise<boolean> {
    if (this.isActive) {
      logger.warn('Session already active');
      return true;
    }

    if (!this.apiKey) {
      logger.error('Cannot start transcription: DEEPGRAM_API_KEY not set');
      return false;
    }

    this.meetingId = config.meetingId;
    this.participants = config.participants || [];
    this.speakerMap.clear();
    this.segmentCount = 0;
    this.nextUnmappedIndex = 0;

    logger.info(
      {
        meetingId: config.meetingId,
        participants: this.participants,
        model: 'nova-3',
      },
      'Starting Deepgram transcription session'
    );

    const audioFormat = config.audioFormat || 'pcm';

    try {
      // Base options for Deepgram v1 streaming API
      const baseOptions: Record<string, unknown> = {
        model: ListenV1Model.Nova3,
        language: config.language || 'en',
        smart_format: ListenV1SmartFormat.True,
        diarize: ListenV1Diarize.True,
        interim_results: ListenV1InterimResults.True,
        utterance_end_ms: 1000,
        vad_events: ListenV1VadEvents.True,
        punctuate: ListenV1Punctuate.True,
        Authorization: `Token ${this.apiKey}`,
      };

      if (audioFormat === 'pcm') {
        // Bot-runner sends raw Linear16 PCM at 16kHz
        baseOptions.encoding = ListenV1Encoding.Linear16;
        baseOptions.sample_rate = 16000;
        baseOptions.channels = 1;
      }
      // For 'webm': omit encoding/sample_rate/channels
      // Deepgram auto-detects WebM/Opus container format from the stream header

      logger.info({ audioFormat, meetingId: config.meetingId }, 'Connecting to Deepgram');

      // Open a live/streaming connection to Deepgram v1 API
      this.liveConnection = await this.deepgramClient.listen.v1.connect(baseOptions as any);

      // Set up event handlers BEFORE connecting so we catch the 'open' event
      this.setupEventHandlers();

      // Wait for the WebSocket to actually be OPEN before returning
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Deepgram WebSocket open timeout (10s)'));
        }, 10000);

        this.liveConnection!.on('open', () => {
          clearTimeout(timeout);
          this.isConnectionOpen = true;
          logger.info('Deepgram WebSocket connection is OPEN — ready for audio');

          // Flush any audio chunks that arrived while we were connecting
          if (this.pendingChunks.length > 0) {
            logger.info({ buffered: this.pendingChunks.length }, 'Flushing buffered audio chunks');
            for (const chunk of this.pendingChunks) {
              this.sendChunk(chunk);
            }
            this.pendingChunks = [];
          }

          resolve();
        });

        // Connect the socket (triggers the 'open' event)
        this.liveConnection!.connect();
      });

      // Keep the connection alive with periodic keep-alive messages
      this.keepAliveInterval = setInterval(() => {
        if (this.liveConnection) {
          try {
            this.liveConnection.sendKeepAlive({ type: 'KeepAlive' });
          } catch {
            // Connection may be closing
          }
        }
      }, 10000);

      this.isActive = true;
      logger.info('✅ Deepgram transcription session started and connection open');
      return true;
    } catch (error) {
      logger.error({ error }, 'Failed to start Deepgram session');
      return false;
    }
  }

  /**
   * Feed raw audio data to Deepgram.
   * Buffers chunks if the WebSocket connection is not yet open.
   */
  feedAudio(chunk: Buffer): void {
    if (!this.isActive) return;

    if (!this.isConnectionOpen || !this.liveConnection) {
      // Buffer until the connection is ready
      this.pendingChunks.push(Buffer.from(chunk));
      return;
    }

    this.sendChunk(chunk);
  }

  /**
   * Actually send a chunk to Deepgram via the live connection.
   */
  private sendChunk(chunk: Buffer): void {
    if (!this.liveConnection) return;

    try {
      this.liveConnection.sendMedia(chunk.buffer.slice(
        chunk.byteOffset,
        chunk.byteOffset + chunk.byteLength
      ));
    } catch (error) {
      logger.error({ error }, 'Failed to send audio chunk to Deepgram');
    }
  }

  /**
   * Update the participant list (e.g., when new participants join)
   */
  updateParticipants(participants: string[]): void {
    this.participants = participants;
    logger.debug({ participants }, 'Updated participant list');
  }

  /**
   * Register a handler for transcript segments
   */
  onTranscript(handler: TranscriptHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Remove a transcript handler
   */
  offTranscript(handler: TranscriptHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index > -1) {
      this.handlers.splice(index, 1);
    }
  }

  /**
   * End the transcription session
   */
  async endSession(): Promise<void> {
    if (!this.isActive) return;

    logger.info({ meetingId: this.meetingId, segments: this.segmentCount }, 'Ending transcription session');

    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    if (this.liveConnection) {
      try {
        this.liveConnection.sendCloseStream({ type: 'CloseStream' });
        this.liveConnection.close();
      } catch (error) {
        logger.debug({ error }, 'Error closing Deepgram connection');
      }
      this.liveConnection = null;
    }

    this.isActive = false;
    this.isConnectionOpen = false;
    this.pendingChunks = [];
    logger.info('✅ Transcription session ended');
  }

  /**
   * Check if the service is currently active
   */
  getIsActive(): boolean {
    return this.isActive;
  }

  /**
   * Get the current speaker mapping
   */
  getSpeakerMap(): Map<number, string> {
    return new Map(this.speakerMap);
  }

  // ─── Private methods ─────────────────────────────────────

  /**
   * Set up Deepgram WebSocket event handlers using the V1Socket API
   */
  private setupEventHandlers(): void {
    if (!this.liveConnection) return;

    this.liveConnection.on('open', () => {
      logger.info('Deepgram WebSocket connection opened');
    });

    this.liveConnection.on('message', (message) => {
      // Only handle Results messages (not Metadata, UtteranceEnd, etc.)
      if ('type' in message && message.type === 'Results') {
        this.handleTranscriptResult(message as listen.ListenV1Results);
      }
    });

    this.liveConnection.on('error', (error) => {
      logger.error({ error: error.message }, 'Deepgram transcription error');
    });

    this.liveConnection.on('close', () => {
      logger.info('Deepgram WebSocket connection closed');
      this.isActive = false;
      this.isConnectionOpen = false;
    });
  }

  /**
   * Process a transcript result from Deepgram V1
   */
  private handleTranscriptResult(result: listen.ListenV1Results): void {
    try {
      const alternative = result.channel?.alternatives?.[0];
      if (!alternative || !alternative.transcript?.trim()) {
        return; // Empty transcript, skip
      }

      const isFinal = result.is_final ?? false;
      const transcript = alternative.transcript.trim();
      const words = alternative.words || [];

      // Determine speaker from words (Deepgram assigns speaker per word when diarize=true)
      let speakerIndex = 0;
      if (words.length > 0) {
        const speakerCounts = new Map<number, number>();
        for (const word of words) {
          const idx = word.speaker ?? 0;
          speakerCounts.set(idx, (speakerCounts.get(idx) || 0) + 1);
        }
        let maxCount = 0;
        for (const [idx, count] of speakerCounts) {
          if (count > maxCount) {
            maxCount = count;
            speakerIndex = idx;
          }
        }
      }

      const speakerName = this.mapSpeakerToParticipant(speakerIndex);

      const segment: TranscriptSegment = {
        text: transcript,
        speakerIndex,
        speakerName,
        confidence: alternative.confidence ?? 0,
        startTime: words[0]?.start ?? 0,
        endTime: words[words.length - 1]?.end ?? 0,
        isFinal,
        receivedAt: new Date(),
      };

      this.segmentCount++;

      if (isFinal) {
        logger.info(
          {
            speaker: speakerName,
            text: transcript.substring(0, 100),
            confidence: segment.confidence.toFixed(2),
          },
          'Transcript segment'
        );
      }

      for (const handler of this.handlers) {
        try {
          handler(segment);
        } catch (error) {
          logger.error({ error }, 'Error in transcript handler');
        }
      }
    } catch (error) {
      logger.error({ error }, 'Failed to process Deepgram result');
    }
  }

  /**
   * Map a Deepgram speaker index to a participant name.
   * Uses a simple FIFO mapping: first new speaker heard → first participant in list.
   */
  private mapSpeakerToParticipant(speakerIndex: number): string {
    const existing = this.speakerMap.get(speakerIndex);
    if (existing) return existing;

    let name = `Speaker ${speakerIndex + 1}`;

    if (this.nextUnmappedIndex < this.participants.length) {
      name = this.participants[this.nextUnmappedIndex]!;
      this.nextUnmappedIndex++;
    }

    this.speakerMap.set(speakerIndex, name);
    logger.info({ speakerIndex, mappedName: name }, 'Mapped Deepgram speaker to participant');
    return name;
  }
}
