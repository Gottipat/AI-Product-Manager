/**
 * @fileoverview Transcript Upload Routes
 * @description Endpoint for uploading raw transcript text, parsing it into events,
 *              and triggering the full AI extraction + MoM generation pipeline.
 */

import { randomUUID } from 'crypto';

import { eq } from 'drizzle-orm';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { db } from '../db/index.js';
import { meetingRepository } from '../db/repositories/meeting.repository.js';
import { transcriptRepository } from '../db/repositories/transcript.repository.js';
import { meetings } from '../db/schema/meetings.js';
import { projects } from '../db/schema/organizations.js';
import { parseTranscript } from '../lib/transcript.js';
import { momPipeline } from '../pipelines/mom.pipeline.js';

// ============================================================================
// VALIDATION
// ============================================================================

const uploadTranscriptSchema = z.object({
  title: z.string().min(1, 'Meeting title is required'),
  transcript: z.string().min(10, 'Transcript must be at least 10 characters'),
  analysisMode: z.enum(['general', 'product_manager']).optional().default('product_manager'),
  contextNote: z.string().max(4000).optional(),
});

const bulkUploadTranscriptSchema = z.object({
  meetings: z.array(uploadTranscriptSchema).min(1).max(25),
});

type UploadTranscriptPayload = z.infer<typeof uploadTranscriptSchema>;

async function processUploadedTranscript(args: {
  projectId: string;
  payload: UploadTranscriptPayload;
}) {
  const { projectId, payload } = args;
  const { title, transcript, analysisMode, contextNote } = payload;

  // 1. Look up the project
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

  if (!project) {
    throw new Error('Project not found');
  }

  // 2. Generate a synthetic meet link for uploaded transcripts
  const syntheticLink = `uploaded://transcript-${randomUUID()}`;

  // 3. If project has no googleMeetLink, set it so the lookup works
  if (!project.googleMeetLink) {
    await db
      .update(projects)
      .set({ googleMeetLink: syntheticLink, updatedAt: new Date() })
      .where(eq(projects.id, projectId));
  }

  const meetLink = project.googleMeetLink || syntheticLink;
  const parsedTranscript = parseTranscript(transcript);

  if (parsedTranscript.events.length === 0) {
    throw new Error('Transcript contains no valid lines');
  }

  const meetingStartTime = parsedTranscript.startedAt ?? new Date();

  // 4. Create a meeting record
  const meeting = await meetingRepository.create({
    title,
    googleMeetLink: meetLink,
    projectId,
    organizationId: project.organizationId,
    description:
      contextNote?.trim() ||
      (analysisMode === 'product_manager'
        ? 'Analyze this meeting like a senior product manager. Prioritize product context, decisions, risks, dependencies, user impact, and follow-up actions.'
        : null),
    meetingType: 'other',
    status: 'completed',
    captureSource: 'manual',
    startTime: meetingStartTime,
    endTime: new Date(),
  });

  if (!meeting) {
    throw new Error('Failed to create meeting');
  }

  // 5. Batch insert transcript events
  const transcriptEvents = parsedTranscript.events.map((line, idx) => ({
    meetingId: meeting.id,
    speaker: line.speaker,
    content: line.content,
    sequenceNumber: idx + 1,
    isFinal: true as const,
    confidence: null,
    speakerId: null,
    capturedAt: line.capturedAt ?? new Date(meetingStartTime.getTime() + idx * 1000),
  }));

  const inserted = await transcriptRepository.createBatch(transcriptEvents);

  await db
    .update(meetings)
    .set({ totalTranscriptEvents: inserted.length })
    .where(eq(meetings.id, meeting.id));

  // 6. Run the full AI extraction pipeline
  const momResult = await momPipeline.generate(meeting.id);

  return {
    success: true,
    meetingId: meeting.id,
    meetingStartTime: meetingStartTime.toISOString(),
    transcriptEventsCreated: inserted.length,
    momGeneration: {
      success: momResult.success,
      momId: momResult.momId,
      highlightsCreated: momResult.highlightsCreated,
      itemsCreated: momResult.itemsCreated,
      processingTimeMs: momResult.processingTimeMs,
      error: momResult.error,
    },
  };
}

// ============================================================================
// ROUTES
// ============================================================================

export async function uploadRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/projects/:id/upload-transcript
   * Upload raw transcript text, parse it, create a meeting,
   * store transcript events, and trigger AI extraction pipeline.
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/v1/projects/:id/upload-transcript',
    async (request, reply) => {
      const { id: projectId } = request.params;

      // Validate body
      const parseResult = uploadTranscriptSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parseResult.error.errors,
        });
      }

      const { title, transcript, analysisMode, contextNote } = parseResult.data;

      try {
        const result = await processUploadedTranscript({
          projectId,
          payload: { title, transcript, analysisMode, contextNote },
        });

        return reply.status(201).send(result);
      } catch (error) {
        console.error('Upload transcript error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        const statusCode = message === 'Project not found' ? 404 : 500;
        const errorMessage =
          message === 'Transcript contains no valid lines'
            ? message
            : `Failed to process transcript: ${message}`;
        return reply.status(statusCode).send({ error: errorMessage });
      }
    }
  );

  /**
   * POST /api/v1/projects/:id/upload-transcripts/bulk
   * Upload multiple transcripts and process them sequentially in chronological order.
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/v1/projects/:id/upload-transcripts/bulk',
    async (request, reply) => {
      const { id: projectId } = request.params;
      const parseResult = bulkUploadTranscriptSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parseResult.error.errors,
        });
      }

      const sortedPayloads = parseResult.data.meetings
        .map((payload, index) => ({
          payload,
          index,
          startedAt:
            parseTranscript(payload.transcript).startedAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
        }))
        .sort((left, right) =>
          left.startedAt === right.startedAt
            ? left.index - right.index
            : left.startedAt - right.startedAt
        );

      try {
        const results = [];

        for (const { payload } of sortedPayloads) {
          results.push(await processUploadedTranscript({ projectId, payload }));
        }

        return reply.status(201).send({
          success: true,
          processedCount: results.length,
          processingOrder: results.map((result) => ({
            meetingId: result.meetingId,
            meetingStartTime: result.meetingStartTime,
          })),
          results,
        });
      } catch (error) {
        console.error('Bulk upload transcript error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        const statusCode = message === 'Project not found' ? 404 : 500;
        return reply.status(statusCode).send({
          error: `Failed to process transcript batch: ${message}`,
        });
      }
    }
  );
}
