/**
 * @fileoverview WebM Recording Stream WebSocket Route
 * @description Receives continuous audio chunks (WebM/Opus) from the Chrome extension
 *   and pipes them directly to disk for playback.
 *
 * Transcription is handled separately by the /audio-stream route which receives
 * raw PCM data from the extension's ScriptProcessorNode.
 */

import fs from 'fs';

import { FastifyInstance } from 'fastify';
import pino from 'pino';

import { getRecordingPath } from '../utils/storage.js';

const logger = pino({ name: 'recording-stream-route' });

export async function recordingStreamRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/api/v1/meetings/:id/recording-stream',
    { websocket: true },
    async (connection, request) => {
      const { id: meetingId } = request.params as { id: string };
      const ws = connection.socket;
      let totalBytes = 0;

      logger.info({ meetingId }, 'Recording stream WebSocket connected');

      let fileStream: fs.WriteStream | null = null;
      try {
        const filePath = getRecordingPath(meetingId);
        fileStream = fs.createWriteStream(filePath);
        logger.info({ meetingId, filePath }, 'Recording file stream opened');
      } catch (err) {
        logger.error({ err, meetingId }, 'Failed to create recording file stream');
      }

      ws.on('message', (data: Buffer) => {
        // Skip JSON control messages (ping keepalive)
        if (data.length > 0 && data[0] === 0x7b) {
          try {
            JSON.parse(data.toString());
            return; // valid JSON = control message, skip
          } catch {
            // Not JSON, treat as binary audio
          }
        }

        const binaryData = Buffer.isBuffer(data) ? data : Buffer.from(data);
        totalBytes += binaryData.byteLength;

        if (fileStream && !fileStream.closed) {
          fileStream.write(binaryData);
        }
      });

      ws.on('close', () => {
        logger.info({ meetingId, totalBytes }, 'Recording stream closed');
        if (fileStream) {
          fileStream.end();
        }
      });

      ws.on('error', (error: Error) => {
        logger.error({ error: error.message, meetingId }, 'Recording stream WebSocket error');
      });

      ws.send(JSON.stringify({ type: 'connected', meetingId, message: 'Recording active' }));
    }
  );
}
