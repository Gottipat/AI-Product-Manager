/**
 * @fileoverview Audio Stream WebSocket Route
 * @description Receives real-time audio chunks from the bot-runner via WebSocket,
 * pipes them through the TranscriptionService (Deepgram), and saves diarized
 * transcript events to the database.
 *
 * Uses @fastify/websocket's SocketStream pattern:
 * - The handler receives (connection: SocketStream, request)
 * - The raw WebSocket is at connection.socket
 */

import { FastifyInstance } from 'fastify';
import pino from 'pino';

import {
  transcriptRepository,
  type NewTranscriptEvent,
} from '../db/repositories/transcript.repository.js';
import { meetingRepository } from '../db/repositories/meeting.repository.js';
import { TranscriptionService, type TranscriptSegment } from '../services/transcription.service.js';

const logger = pino({ name: 'audio-stream-route' });

// Track active transcription sessions
const activeSessions: Map<string, TranscriptionService> = new Map();

export async function audioStreamRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * WebSocket: /api/v1/meetings/:id/audio-stream
   *
   * Binary audio chunks flow in from the bot-runner.
   * Diarized transcript segments flow out as JSON messages.
   */
  fastify.get(
    '/api/v1/meetings/:id/audio-stream',
    { websocket: true },
    async (connection, request) => {
      const { id: meetingId } = request.params as { id: string };
      const ws = connection.socket; // Raw WebSocket from SocketStream
      let sequenceNumber = 0;

      logger.info({ meetingId }, 'Audio stream WebSocket connected');

      // Check if there's already an active session for this meeting
      if (activeSessions.has(meetingId)) {
        logger.warn({ meetingId }, 'Replacing existing transcription session');
        const existing = activeSessions.get(meetingId);
        await existing?.endSession();
      }

      // Create a new transcription service
      const transcriptionService = new TranscriptionService();
      activeSessions.set(meetingId, transcriptionService);

      // Get participant list from the meeting
      let participants: string[] = [];
      try {
        const meetingParticipants = await meetingRepository.getParticipants(meetingId);
        participants = meetingParticipants
          .filter((p) => !p.isBot)
          .map((p) => p.displayName);
      } catch (error) {
        logger.debug({ error }, 'Could not fetch participants for speaker mapping');
      }

      // Start the transcription session
      const started = await transcriptionService.startSession({
        meetingId,
        participants,
      });

      if (!started) {
        logger.error({ meetingId }, 'Failed to start transcription session');
        ws.send(
          JSON.stringify({
            type: 'error',
            message: 'Failed to start transcription. Check DEEPGRAM_API_KEY.',
          })
        );
      }

      // Wire: transcript segments → save to DB + send back to client
      transcriptionService.onTranscript(async (segment: TranscriptSegment) => {
        // Only save final results to DB (avoid duplicates from interim results)
        if (segment.isFinal && segment.text.trim()) {
          try {
            const event: NewTranscriptEvent = {
              meetingId,
              speaker: segment.speakerName,
              content: segment.text,
              sequenceNumber: sequenceNumber++,
              speakerId: `deepgram-speaker-${segment.speakerIndex}`,
              isFinal: true,
              confidence: segment.confidence,
              capturedAt: segment.receivedAt,
            };

            await transcriptRepository.create(event);
            await meetingRepository.incrementTranscriptCount(meetingId);

            logger.debug(
              {
                speaker: segment.speakerName,
                textLength: segment.text.length,
                seq: event.sequenceNumber,
              },
              'Saved audio transcript to DB'
            );
          } catch (error) {
            logger.error({ error }, 'Failed to save transcript event');
          }
        }

        // Send the segment back to the bot-runner (for logging/display)
        try {
          if (ws.readyState === ws.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'transcript',
                speaker: segment.speakerName,
                text: segment.text,
                isFinal: segment.isFinal,
                confidence: segment.confidence,
                speakerIndex: segment.speakerIndex,
              })
            );
          }
        } catch {
          // Socket may be closed
        }
      });

      // Handle incoming binary audio data via the raw WebSocket
      ws.on('message', (data: Buffer) => {
        // Check if it's a JSON control message or binary audio
        if (data.length > 0 && data[0] === 0x7b) {
          // Starts with '{' — likely JSON
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'update_participants') {
              transcriptionService.updateParticipants(msg.participants || []);
              logger.info({ participants: msg.participants }, 'Updated participant list');
              return;
            }
          } catch {
            // Not valid JSON, treat as binary
          }
        }

        // Binary audio data
        const binaryData = Buffer.isBuffer(data) ? data : Buffer.from(data);
        if (sequenceNumber % 50 === 0) {
            logger.info({ meetingId, seq: sequenceNumber, bytes: binaryData.byteLength }, 'Received PCM chunk from extension');
        }
        transcriptionService.feedAudio(binaryData);
      });

      // Handle WebSocket close
      ws.on('close', async () => {
        logger.info({ meetingId, segments: sequenceNumber }, 'Audio stream WebSocket closed');
        await transcriptionService.endSession();
        activeSessions.delete(meetingId);
      });

      // Handle errors
      ws.on('error', (error: Error) => {
        logger.error({ error: error.message, meetingId }, 'Audio stream WebSocket error');
      });

      // Send confirmation
      ws.send(
        JSON.stringify({
          type: 'connected',
          meetingId,
          transcriptionActive: started,
          message: started
            ? 'Audio stream connected. Transcription active.'
            : 'Audio stream connected. Transcription unavailable (no API key).',
        })
      );
    }
  );

  /**
   * GET /api/v1/meetings/:id/audio-stream/status
   * Check the status of an active transcription session
   */
  fastify.get('/api/v1/meetings/:id/audio-stream/status', async (request, reply) => {
    const { id: meetingId } = request.params as { id: string };
    const session = activeSessions.get(meetingId);

    if (!session) {
      return reply.status(404).send({
        active: false,
        message: 'No active transcription session for this meeting',
      });
    }

    return reply.send({
      active: session.getIsActive(),
      speakerMap: Object.fromEntries(session.getSpeakerMap()),
    });
  });
}
