/**
 * @fileoverview Benchmark Routes
 * @description Research and evaluation endpoints for comparing different
 *              meeting-analysis strategies against the same transcript input.
 */

import { randomUUID } from 'crypto';

import { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  formatTranscriptForAI,
  getTranscriptSpeakerStats,
  parseTranscript,
} from '../lib/transcript.js';
import { openaiService, type MeetingAnalysisContext } from '../services/openai.service.js';

const transcriptOnlyBenchmarkSchema = z.object({
  title: z.string().min(1, 'Meeting title is required'),
  transcript: z.string().min(10, 'Transcript must be at least 10 characters'),
  analysisMode: z.enum(['general', 'product_manager']).optional().default('product_manager'),
  contextNote: z.string().max(4000).optional(),
  projectName: z.string().min(1).optional(),
  projectDescription: z.string().optional(),
});

function defaultMeetingDescription(analysisMode: 'general' | 'product_manager'): string | null {
  if (analysisMode === 'product_manager') {
    return 'Analyze this meeting like a senior product manager. Prioritize product context, decisions, risks, dependencies, user impact, and follow-up actions.';
  }

  return null;
}

function inferDurationMinutes(args: {
  startTime: Date;
  firstCapturedAt?: Date | null | undefined;
  lastCapturedAt?: Date | null | undefined;
  eventCount: number;
}): number | null {
  const { startTime, firstCapturedAt, lastCapturedAt, eventCount } = args;
  const boundedStart = firstCapturedAt ?? startTime;

  if (lastCapturedAt && lastCapturedAt.getTime() >= boundedStart.getTime()) {
    return Math.max(1, Math.ceil((lastCapturedAt.getTime() - boundedStart.getTime()) / 60_000));
  }

  return eventCount > 0 ? Math.max(1, Math.ceil(eventCount / 4)) : null;
}

export async function benchmarkRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/v1/benchmark/transcript-only-mom', async (request, reply) => {
    const parseResult = transcriptOnlyBenchmarkSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { title, transcript, analysisMode, contextNote, projectName, projectDescription } =
      parseResult.data;

    try {
      const parsedTranscript = parseTranscript(transcript);

      if (parsedTranscript.events.length === 0) {
        return reply.status(400).send({
          error: 'Transcript contains no valid lines',
        });
      }

      const meetingStartTime = parsedTranscript.startedAt ?? new Date();
      const transcriptEvents = parsedTranscript.events.map((line, index) => ({
        speaker: line.speaker,
        content: line.content,
        sequenceNumber: index + 1,
        capturedAt: line.capturedAt ?? new Date(meetingStartTime.getTime() + index * 1000),
      }));
      const transcriptText = formatTranscriptForAI(transcriptEvents);
      const transcriptStats = getTranscriptSpeakerStats(transcriptEvents);
      const participants = transcriptStats.speakers.map((speaker) => ({
        displayName: speaker,
      }));
      const lastCapturedAt =
        transcriptEvents[transcriptEvents.length - 1]?.capturedAt ?? meetingStartTime;
      const context: MeetingAnalysisContext = {
        meetingId: `benchmark-${randomUUID()}`,
        title,
        description: contextNote?.trim() || defaultMeetingDescription(analysisMode),
        projectName: projectName ?? 'Transcript-Only Benchmark Project',
        projectDescription:
          projectDescription?.trim() || 'Benchmark run without prior project memory.',
        meetingType: 'other',
        status: 'completed',
        captureSource: 'manual',
        analysisMode,
        startTime: meetingStartTime.toISOString(),
        endTime: lastCapturedAt?.toISOString() ?? meetingStartTime.toISOString(),
        durationMinutes: inferDurationMinutes({
          startTime: meetingStartTime,
          firstCapturedAt: transcriptEvents[0]?.capturedAt,
          lastCapturedAt,
          eventCount: transcriptEvents.length,
        }),
        participants,
        transcript: transcriptStats,
        projectContextSummary:
          contextNote?.trim() ||
          'Transcript-only benchmark mode: use only the current meeting transcript and meeting-local metadata. No prior project memory, reconciled carry-forward items, or database state is provided.',
      };

      const start = Date.now();
      const extractedItems = await openaiService.extractActionItems(transcriptText, context);
      const mom = await openaiService.generateMoMWithSeedItems(
        transcriptText,
        context,
        extractedItems
      );

      return reply.status(200).send({
        success: true,
        analysisId: context.meetingId,
        meetingStartTime: meetingStartTime.toISOString(),
        transcriptEventsCreated: transcriptEvents.length,
        processingTimeMs: Date.now() - start,
        extractedItems,
        mom,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(500).send({
        success: false,
        error: `Failed to generate transcript-only benchmark MoM: ${message}`,
      });
    }
  });
}
