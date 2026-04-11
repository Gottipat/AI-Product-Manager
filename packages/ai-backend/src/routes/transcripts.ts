/**
 * @fileoverview Transcript Routes
 * @description REST API endpoints for transcript streaming and retrieval
 */

import { FastifyInstance } from 'fastify';

import { meetingRepository } from '../db/repositories/meeting.repository.js';
import {
  transcriptRepository,
  type NewTranscriptEvent,
} from '../db/repositories/transcript.repository.js';
import { actionItemsPipeline } from '../pipelines/actionItems.pipeline.js';
import { canEditMeeting, canViewMeeting } from '../services/collaboration.service.js';

// Request types
interface TranscriptEventBody {
  speaker: string;
  content: string;
  sequenceNumber: number;
  speakerId?: string;
  isFinal?: boolean;
  confidence?: number;
  capturedAt?: string;
}

interface BatchTranscriptBody {
  events: TranscriptEventBody[];
}

export async function transcriptRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/meetings/:id/transcripts
   * Add single transcript event
   */
  fastify.post<{ Params: { id: string }; Body: TranscriptEventBody }>(
    '/api/v1/meetings/:id/transcripts',
    async (request, reply) => {
      if (!request.user || !(await canEditMeeting(request.params.id, request.user))) {
        return reply
          .status(403)
          .send({ error: 'You do not have permission to update this meeting transcript' });
      }

      const { speaker, content, sequenceNumber, speakerId, isFinal, confidence, capturedAt } =
        request.body;

      if (!speaker || !content || sequenceNumber === undefined) {
        return reply
          .status(400)
          .send({ error: 'speaker, content, and sequenceNumber are required' });
      }

      const event = await transcriptRepository.create({
        meetingId: request.params.id,
        speaker,
        content,
        sequenceNumber,
        speakerId: speakerId || null,
        isFinal: isFinal ?? true,
        confidence: confidence || null,
        capturedAt: capturedAt ? new Date(capturedAt) : new Date(),
      });

      // Update meeting transcript count
      await meetingRepository.incrementTranscriptCount(request.params.id);

      // Trigger Real-Time Extraction
      actionItemsPipeline.extractLiveChunk(request.params.id, content).catch(console.error);

      return reply.status(201).send({ event });
    }
  );

  /**
   * POST /api/v1/meetings/:id/transcripts/batch
   * Batch insert transcript events (streaming)
   */
  fastify.post<{ Params: { id: string }; Body: BatchTranscriptBody }>(
    '/api/v1/meetings/:id/transcripts/batch',
    async (request, reply) => {
      if (!request.user || !(await canEditMeeting(request.params.id, request.user))) {
        return reply
          .status(403)
          .send({ error: 'You do not have permission to update this meeting transcript' });
      }

      const { events } = request.body;

      if (!events || !Array.isArray(events) || events.length === 0) {
        return reply.status(400).send({ error: 'events array is required' });
      }

      const transcriptEvents: NewTranscriptEvent[] = events.map((e) => ({
        meetingId: request.params.id,
        speaker: e.speaker,
        content: e.content,
        sequenceNumber: e.sequenceNumber,
        speakerId: e.speakerId || null,
        isFinal: e.isFinal ?? true,
        confidence: e.confidence || null,
        capturedAt: e.capturedAt ? new Date(e.capturedAt) : new Date(),
      }));

      const inserted = await transcriptRepository.createBatch(transcriptEvents);

      // Update meeting transcript count
      await meetingRepository.incrementTranscriptCount(request.params.id, inserted.length);

      // Trigger Real-Time Extraction with concatenated text
      const chunkText = events.map((e) => `${e.speaker}: ${e.content}`).join('\n');
      actionItemsPipeline.extractLiveChunk(request.params.id, chunkText).catch(console.error);

      return reply.status(201).send({
        inserted: inserted.length,
        events: inserted,
      });
    }
  );

  /**
   * GET /api/v1/meetings/:id/transcripts
   * Get all transcripts for a meeting
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/v1/meetings/:id/transcripts',
    async (request, reply) => {
      if (!request.user || !(await canViewMeeting(request.params.id, request.user))) {
        return reply.status(403).send({ error: 'You do not have access to this meeting' });
      }

      const events = await transcriptRepository.findByMeetingId(request.params.id);
      return { events, count: events.length };
    }
  );

  /**
   * GET /api/v1/meetings/:id/transcripts/text
   * Get full transcript as text (for AI processing)
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/v1/meetings/:id/transcripts/text',
    async (request, reply) => {
      if (!request.user || !(await canViewMeeting(request.params.id, request.user))) {
        return reply.status(403).send({ error: 'You do not have access to this meeting' });
      }

      const text = await transcriptRepository.getTranscriptText(request.params.id);
      return { text };
    }
  );

  /**
   * GET /api/v1/meetings/:id/transcripts/by-speaker
   * Get transcript grouped by speaker
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/v1/meetings/:id/transcripts/by-speaker',
    async (request, reply) => {
      if (!request.user || !(await canViewMeeting(request.params.id, request.user))) {
        return reply.status(403).send({ error: 'You do not have access to this meeting' });
      }

      const bySpeaker = await transcriptRepository.getTranscriptBySpeaker(request.params.id);
      return { bySpeaker };
    }
  );

  /**
   * GET /api/v1/meetings/:id/transcripts/latest
   * Get latest N transcript events
   */
  fastify.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/api/v1/meetings/:id/transcripts/latest',
    async (request, reply) => {
      if (!request.user || !(await canViewMeeting(request.params.id, request.user))) {
        return reply.status(403).send({ error: 'You do not have access to this meeting' });
      }

      const limit = parseInt(request.query.limit || '50', 10);
      const events = await transcriptRepository.findLatest(request.params.id, limit);
      return { events };
    }
  );
}
