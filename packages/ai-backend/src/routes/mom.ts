/**
 * @fileoverview MoM Routes
 * @description REST API endpoints for Minutes of Meeting and highlights
 */

import { FastifyInstance } from 'fastify';

import {
  momRepository,
  type NewMom,
  type NewHighlight,
} from '../db/repositories/mom.repository.js';

// Request types
interface CreateMomBody {
  executiveSummary?: string;
  detailedSummary?: string;
  attendanceSummary?: Record<string, unknown>;
  aiModelVersion?: string;
  overallConfidence?: number;
  processingTimeMs?: number;
}

interface AddHighlightBody {
  highlightType: 'executive_summary' | 'key_point' | 'notable_quote' | 'outcome';
  content: string;
  importance?: number;
  keywords?: string[];
}

interface AddHighlightsBatchBody {
  highlights: AddHighlightBody[];
}

export async function momRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/meetings/:id/mom
   * Create or update MoM for a meeting
   */
  fastify.post<{ Params: { id: string }; Body: CreateMomBody }>(
    '/api/v1/meetings/:id/mom',
    async (request, reply) => {
      const {
        executiveSummary,
        detailedSummary,
        attendanceSummary,
        aiModelVersion,
        overallConfidence,
        processingTimeMs,
      } = request.body;

      const momData: NewMom = {
        meetingId: request.params.id,
        executiveSummary: executiveSummary || null,
        detailedSummary: detailedSummary || null,
        attendanceSummary: attendanceSummary || null,
        aiModelVersion: aiModelVersion || null,
        overallConfidence: overallConfidence || null,
        processingTimeMs: processingTimeMs || null,
      };

      const mom = await momRepository.upsert(momData);
      return reply.status(201).send({ mom });
    }
  );

  /**
   * GET /api/v1/meetings/:id/mom
   * Get MoM for a meeting
   */
  fastify.get<{ Params: { id: string } }>('/api/v1/meetings/:id/mom', async (request, reply) => {
    const mom = await momRepository.findByMeetingId(request.params.id);
    if (!mom) {
      return reply.status(404).send({ error: 'MoM not found for this meeting' });
    }
    return { mom };
  });

  /**
   * POST /api/v1/meetings/:id/highlights
   * Add a highlight to a meeting
   */
  fastify.post<{ Params: { id: string }; Body: AddHighlightBody }>(
    '/api/v1/meetings/:id/highlights',
    async (request, reply) => {
      const { highlightType, content, importance, keywords } = request.body;

      if (!highlightType || !content) {
        return reply.status(400).send({ error: 'highlightType and content are required' });
      }

      const highlightData: NewHighlight = {
        meetingId: request.params.id,
        highlightType,
        content,
        importance: importance || null,
        keywords: keywords || null,
      };

      const highlight = await momRepository.addHighlight(highlightData);
      return reply.status(201).send({ highlight });
    }
  );

  /**
   * POST /api/v1/meetings/:id/highlights/batch
   * Batch add highlights
   */
  fastify.post<{ Params: { id: string }; Body: AddHighlightsBatchBody }>(
    '/api/v1/meetings/:id/highlights/batch',
    async (request, reply) => {
      const { highlights } = request.body;

      if (!highlights || !Array.isArray(highlights) || highlights.length === 0) {
        return reply.status(400).send({ error: 'highlights array is required' });
      }

      const highlightData: NewHighlight[] = highlights.map((h) => ({
        meetingId: request.params.id,
        highlightType: h.highlightType,
        content: h.content,
        importance: h.importance || null,
        keywords: h.keywords || null,
      }));

      const inserted = await momRepository.addHighlights(highlightData);
      return reply.status(201).send({
        inserted: inserted.length,
        highlights: inserted,
      });
    }
  );

  /**
   * GET /api/v1/meetings/:id/highlights
   * Get all highlights for a meeting
   */
  fastify.get<{ Params: { id: string }; Querystring: { type?: string } }>(
    '/api/v1/meetings/:id/highlights',
    async (request) => {
      const { type } = request.query;

      if (type) {
        const validTypes = ['executive_summary', 'key_point', 'notable_quote', 'outcome'];
        if (!validTypes.includes(type)) {
          return { error: 'Invalid highlight type' };
        }
        const highlights = await momRepository.getHighlightsByType(
          request.params.id,
          type as NewHighlight['highlightType']
        );
        return { highlights };
      }

      const highlights = await momRepository.getHighlights(request.params.id);
      return { highlights };
    }
  );

  /**
   * GET /api/v1/mom/recent
   * Get recent MoMs
   */
  fastify.get<{ Querystring: { limit?: string } }>('/api/v1/mom/recent', async (request) => {
    const limit = parseInt(request.query.limit || '20', 10);
    const moms = await momRepository.findRecent(limit);
    return { moms };
  });
}
