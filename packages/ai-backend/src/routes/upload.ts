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
        // 1. Look up the project
        const [project] = await db
          .select()
          .from(projects)
          .where(eq(projects.id, projectId))
          .limit(1);

        if (!project) {
          return reply.status(404).send({ error: 'Project not found' });
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
          return reply.status(400).send({ error: 'Transcript contains no valid lines' });
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
          return reply.status(500).send({ error: 'Failed to create meeting' });
        }

        // 6. Batch insert transcript events
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

        // Update meeting transcript count
        await db
          .update(meetings)
          .set({ totalTranscriptEvents: inserted.length })
          .where(eq(meetings.id, meeting.id));

        // 7. Run the full AI extraction pipeline
        const momResult = await momPipeline.generate(meeting.id);

        // 8. Return results
        return reply.status(201).send({
          success: true,
          meetingId: meeting.id,
          transcriptEventsCreated: inserted.length,
          momGeneration: {
            success: momResult.success,
            momId: momResult.momId,
            highlightsCreated: momResult.highlightsCreated,
            itemsCreated: momResult.itemsCreated,
            processingTimeMs: momResult.processingTimeMs,
            error: momResult.error,
          },
        });
      } catch (error) {
        console.error('Upload transcript error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({ error: `Failed to process transcript: ${message}` });
      }
    }
  );
}
