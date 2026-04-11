/**
 * @fileoverview AI Backend HTTP Client
 * @description Handles all HTTP communication from Bot Runner to AI Backend
 */

import pino from 'pino';

const logger = pino({ name: 'backend-client' });

export interface BackendClientConfig {
  /** Base URL of the AI Backend (e.g., http://localhost:3001) */
  baseUrl: string;
  /** Request timeout in ms */
  timeoutMs?: number;
}

export interface CreateMeetingResponse {
  meeting: {
    id: string;
    title: string;
    googleMeetLink: string;
    status: string;
    createdAt: string;
  };
}

export interface TranscriptBatchPayload {
  events: Array<{
    speaker: string;
    content: string;
    sequenceNumber: number;
    speakerId?: string;
    isFinal?: boolean;
    confidence?: number;
    capturedAt?: string;
  }>;
}

/**
 * BackendClient manages HTTP communication with the AI Backend
 */
export class BackendClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(config: BackendClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeoutMs = config.timeoutMs ?? 10000;
    logger.info({ baseUrl: this.baseUrl }, 'Backend client initialized');
  }

  /**
   * Check if backend is reachable
   */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/health`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      return res.ok;
    } catch (error) {
      logger.error({ error }, 'Backend health check failed');
      return false;
    }
  }

  /**
   * Create a new meeting in the backend
   */
  async createMeeting(
    title: string,
    googleMeetLink: string,
    meetingType: string = 'standup'
  ): Promise<CreateMeetingResponse> {
    const res = await this.post('/api/v1/meetings', {
      title,
      googleMeetLink,
      meetingType,
    });
    return res as CreateMeetingResponse;
  }

  /**
   * Update meeting status (bot_joining, in_progress, etc.)
   */
  async updateMeetingStatus(meetingId: string, status: string): Promise<void> {
    await this.patch(`/api/v1/meetings/${meetingId}/status`, { status });
  }

  /**
   * Mark meeting as started
   */
  async startMeeting(meetingId: string): Promise<void> {
    await this.post(`/api/v1/meetings/${meetingId}/start`, {});
  }

  /**
   * Mark meeting as complete
   */
  async completeMeeting(meetingId: string): Promise<void> {
    await this.post(`/api/v1/meetings/${meetingId}/complete`, {});
  }

  /**
   * Add a participant to the meeting
   */
  async addParticipant(
    meetingId: string,
    displayName: string,
    isBot: boolean = false
  ): Promise<void> {
    await this.post(`/api/v1/meetings/${meetingId}/participants`, {
      displayName,
      isBot,
    });
  }

  /**
   * Send a batch of transcript events
   */
  async sendTranscriptBatch(
    meetingId: string,
    payload: TranscriptBatchPayload
  ): Promise<{ inserted: number }> {
    const res = await this.post(`/api/v1/meetings/${meetingId}/transcripts/batch`, payload);
    return res as { inserted: number };
  }

  /**
   * Trigger MoM generation for a meeting
   */
  async generateMoM(meetingId: string): Promise<void> {
    await this.post(`/api/v1/meetings/${meetingId}/generate-mom`, {});
  }

  /**
   * Trigger action item extraction
   */
  async extractItems(meetingId: string): Promise<void> {
    await this.post(`/api/v1/meetings/${meetingId}/extract-items`, {});
  }

  /**
   * Open a WebSocket connection for streaming audio chunks
   * Returns the WebSocket instance for sending binary audio data
   */
  connectAudioStream(meetingId: string): Promise<import('ws').WebSocket> {
    const wsUrl = this.baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    const url = `${wsUrl}/api/v1/meetings/${meetingId}/audio-stream`;

    logger.info({ url }, 'Connecting audio stream WebSocket');

    return new Promise((resolve, reject) => {
      // Dynamic import to avoid issues if ws is not available
      import('ws')
        .then(({ default: WebSocket }) => {
          const ws = new WebSocket(url);

          ws.on('open', () => {
            logger.info({ meetingId }, '✅ Audio stream WebSocket connected');
            resolve(ws);
          });

          ws.on('error', (error) => {
            logger.error({ error, meetingId }, 'Audio stream WebSocket error');
            reject(error);
          });

          ws.on('close', (code, reason) => {
            logger.info(
              { code, reason: reason.toString(), meetingId },
              'Audio stream WebSocket closed'
            );
          });

          ws.on('message', (data) => {
            // Handle any messages from backend (e.g., transcription results)
            try {
              const msg = JSON.parse(data.toString());
              logger.debug({ msg }, 'Received message from audio stream');
            } catch {
              // Binary or non-JSON message
            }
          });
        })
        .catch(reject);
    });
  }

  // ─── Private helpers ─────────────────────────────────────────

  private async post(path: string, body: unknown): Promise<unknown> {
    return this.request('POST', path, body);
  }

  private async patch(path: string, body: unknown): Promise<unknown> {
    return this.request('PATCH', path, body);
  }

  private async request(method: string, path: string, body: unknown): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    logger.debug({ method, url }, 'Backend request');

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      const data = await res.json();

      if (!res.ok) {
        logger.error({ method, url, status: res.status, data }, 'Backend request failed');
        throw new Error(`Backend ${method} ${path} failed: ${res.status}`);
      }

      logger.debug({ method, url, status: res.status }, 'Backend request success');
      return data;
    } catch (error) {
      if (error instanceof Error && error.message.includes('failed')) {
        throw error;
      }
      logger.error({ method, url, error }, 'Backend request error');
      throw new Error(`Backend ${method} ${path} error: ${error}`);
    }
  }
}
