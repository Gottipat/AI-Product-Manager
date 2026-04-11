/**
 * @fileoverview Meeting Routes
 * @description REST API endpoints for meeting lifecycle management
 */

import { createReadStream, existsSync, statSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

import { FastifyInstance } from 'fastify';

import { meetingRepository, type NewMeeting } from '../db/repositories/meeting.repository.js';

// Request/Response types
interface CreateMeetingBody {
  title: string;
  googleMeetLink: string;
  organizationId?: string;
  meetingType?: string;
  startTime?: string;
  captureSource?: 'bot' | 'extension' | 'manual';
}

interface UpdateStatusBody {
  status: 'scheduled' | 'bot_joining' | 'in_progress' | 'completed' | 'cancelled' | 'error';
}

interface AddParticipantBody {
  displayName: string;
  email?: string;
  isBot?: boolean;
}

export async function meetingRoutes(fastify: FastifyInstance): Promise<void> {
  if (!fastify.hasContentTypeParser(/^audio\/webm(?:;.*)?$/i)) {
    fastify.addContentTypeParser(
      /^audio\/webm(?:;.*)?$/i,
      { parseAs: 'buffer' },
      (_request, payload, done) => done(null, payload)
    );
  }

  if (!fastify.hasContentTypeParser('application/octet-stream')) {
    fastify.addContentTypeParser(
      'application/octet-stream',
      { parseAs: 'buffer' },
      (_request, payload, done) => done(null, payload)
    );
  }

  /**
   * POST /api/v1/meetings
   * Create a new meeting
   */
  fastify.post<{ Body: CreateMeetingBody }>('/api/v1/meetings', async (request, reply) => {
    const { title, googleMeetLink, organizationId, meetingType, startTime, captureSource } =
      request.body;

    if (!title || !googleMeetLink) {
      return reply.status(400).send({ error: 'title and googleMeetLink are required' });
    }

    const meetingData: NewMeeting = {
      title,
      googleMeetLink,
      organizationId: organizationId || null,
      meetingType: (meetingType as NewMeeting['meetingType']) || 'standup',
      startTime: startTime ? new Date(startTime) : null,
      status: 'scheduled',
      captureSource: (captureSource as NewMeeting['captureSource']) || 'bot',
    };

    const meeting = await meetingRepository.create(meetingData);
    return reply.status(201).send({ meeting });
  });

  /**
   * GET /api/v1/meetings/:id
   * Get meeting by ID with participants
   */
  fastify.get<{ Params: { id: string } }>('/api/v1/meetings/:id', async (request, reply) => {
    const meeting = await meetingRepository.findById(request.params.id);
    if (!meeting) {
      return reply.status(404).send({ error: 'Meeting not found' });
    }
    return { meeting };
  });

  /**
   * POST /api/v1/meetings/:id/start
   * Start a meeting (bot joining)
   */
  fastify.post<{ Params: { id: string } }>('/api/v1/meetings/:id/start', async (request, reply) => {
    const meeting = await meetingRepository.findById(request.params.id);
    if (!meeting) {
      return reply.status(404).send({ error: 'Meeting not found' });
    }

    const updated = await meetingRepository.start(request.params.id);
    return { meeting: updated };
  });

  /**
   * PATCH /api/v1/meetings/:id/status
   * Update meeting status
   */
  fastify.patch<{ Params: { id: string }; Body: UpdateStatusBody }>(
    '/api/v1/meetings/:id/status',
    async (request, reply) => {
      const { status } = request.body;
      if (!status) {
        return reply.status(400).send({ error: 'status is required' });
      }

      const meeting = await meetingRepository.updateStatus(request.params.id, status);
      if (!meeting) {
        return reply.status(404).send({ error: 'Meeting not found' });
      }
      return { meeting };
    }
  );

  /**
   * POST /api/v1/meetings/:id/complete
   * Mark meeting as complete
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/v1/meetings/:id/complete',
    async (request, reply) => {
      const meeting = await meetingRepository.complete(request.params.id);
      if (!meeting) {
        return reply.status(404).send({ error: 'Meeting not found or not started' });
      }
      return { meeting };
    }
  );

  /**
   * POST /api/v1/meetings/:id/participants
   * Add participant to meeting
   */
  fastify.post<{ Params: { id: string }; Body: AddParticipantBody }>(
    '/api/v1/meetings/:id/participants',
    async (request, reply) => {
      const { displayName, email, isBot } = request.body;
      if (!displayName) {
        return reply.status(400).send({ error: 'displayName is required' });
      }

      const participant = await meetingRepository.addParticipant({
        meetingId: request.params.id,
        displayName,
        email: email || null,
        isBot: isBot || false,
        joinedAt: new Date(),
      });
      return reply.status(201).send({ participant });
    }
  );

  /**
   * GET /api/v1/meetings/:id/participants
   * Get all participants for a meeting
   */
  fastify.get<{ Params: { id: string } }>('/api/v1/meetings/:id/participants', async (request) => {
    const participants = await meetingRepository.getParticipants(request.params.id);
    return { participants };
  });

  /**
   * POST /api/v1/meetings/:id/audio
   * Store a recorded audio file for a meeting
   */
  fastify.post<{ Params: { id: string }; Body: Buffer }>(
    '/api/v1/meetings/:id/audio',
    async (request, reply) => {
      const meetingId = request.params.id;
      const meeting = await meetingRepository.findById(meetingId);

      if (!meeting) {
        return reply.status(404).send({ error: 'Meeting not found' });
      }

      const audioBuffer = request.body;
      if (!audioBuffer || !Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
        return reply.status(400).send({ error: 'Audio payload is required' });
      }

      const recordingsDir = join(process.cwd(), 'uploads', 'recordings');
      const recordingPath = join(recordingsDir, `${meetingId}.webm`);

      await mkdir(recordingsDir, { recursive: true });
      await writeFile(recordingPath, audioBuffer);

      return reply.status(201).send({
        success: true,
        meetingId,
        bytes: audioBuffer.length,
        path: recordingPath,
      });
    }
  );

  /**
   * GET /api/v1/meetings/:id/audio
   * Serve the audio recording file for a meeting
   */
  fastify.get<{ Params: { id: string } }>('/api/v1/meetings/:id/audio', async (request, reply) => {
    const meetingId = request.params.id;
    const recordingPath = join(process.cwd(), 'uploads', 'recordings', `${meetingId}.webm`);

    if (!existsSync(recordingPath)) {
      return reply.status(404).send({ error: 'No audio recording found for this meeting' });
    }

    const stat = statSync(recordingPath);
    return reply
      .header('Content-Type', 'audio/webm')
      .header('Content-Length', stat.size)
      .header('Accept-Ranges', 'bytes')
      .send(createReadStream(recordingPath));
  });

  /**
   * GET /api/v1/organizations/:orgId/meetings
   * Get recent meetings for organization
   */
  fastify.get<{ Params: { orgId: string }; Querystring: { limit?: string } }>(
    '/api/v1/organizations/:orgId/meetings',
    async (request) => {
      const limit = parseInt(request.query.limit || '20', 10);
      const meetings = await meetingRepository.findRecent(request.params.orgId, limit);
      return { meetings };
    }
  );

  /**
   * GET /api/v1/meetings/:id/audio
   * Stream the raw audio recording of the meeting a webm file
   */
  fastify.get<{ Params: { id: string } }>('/api/v1/meetings/:id/audio', async (request, reply) => {
    // We need fs here dynamically or we can import it at top.
    const fs = await import('fs');
    const { getRecordingPath } = await import('../utils/storage.js');
    
    const filePath = getRecordingPath(request.params.id);
    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ error: 'Audio recording not found for this meeting' });
    }

    const stat = fs.statSync(filePath);
    return reply
      .header('Content-Type', 'audio/webm')
      .header('Content-Length', stat.size)
      .send(fs.createReadStream(filePath));
  });
}
