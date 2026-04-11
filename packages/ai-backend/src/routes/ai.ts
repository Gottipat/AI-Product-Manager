/**
 * @fileoverview AI Routes
 * @description API endpoints for AI-powered MoM generation and search
 */

import { FastifyInstance } from 'fastify';

import { actionItemsPipeline } from '../pipelines/actionItems.pipeline.js';
import { momPipeline } from '../pipelines/mom.pipeline.js';
import { canEditMeeting, canViewMeeting } from '../services/collaboration.service.js';
import { ragService } from '../services/rag.service.js';

// ============================================================================
// INTERFACES
// ============================================================================

interface GenerateMoMParams {
  id: string;
}

interface SearchBody {
  query: string;
  limit?: number;
  contentTypes?: string[];
  meetingId?: string;
}

// ============================================================================
// ROUTES
// ============================================================================

export async function aiRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * Generate MoM for a meeting
   * POST /api/v1/meetings/:id/generate-mom
   */
  fastify.post<{ Params: GenerateMoMParams }>(
    '/api/v1/meetings/:id/generate-mom',
    async (request, reply) => {
      const { id } = request.params;

      if (!request.user || !(await canEditMeeting(id, request.user))) {
        return reply
          .status(403)
          .send({ error: 'You do not have permission to update this meeting' });
      }

      // Start async generation
      const result = await momPipeline.generate(id);

      if (!result.success) {
        return reply.status(500).send({
          success: false,
          error: result.error,
        });
      }

      return reply.send({
        success: true,
        momId: result.momId,
        highlightsCreated: result.highlightsCreated,
        itemsCreated: result.itemsCreated,
        processingTimeMs: result.processingTimeMs,
      });
    }
  );

  /**
   * Get MoM generation progress
   * GET /api/v1/meetings/:id/ai-status
   */
  fastify.get<{ Params: GenerateMoMParams }>(
    '/api/v1/meetings/:id/ai-status',
    async (request, reply) => {
      const { id } = request.params;

      if (!request.user || !(await canViewMeeting(id, request.user))) {
        return reply.status(403).send({ error: 'You do not have access to this meeting' });
      }

      const progress = momPipeline.getProgress(id);

      if (!progress) {
        return reply.send({
          status: 'idle',
          message: 'No generation in progress',
        });
      }

      return reply.send(progress);
    }
  );

  /**
   * Extract action items from a meeting
   * POST /api/v1/meetings/:id/extract-items
   */
  fastify.post<{ Params: GenerateMoMParams }>(
    '/api/v1/meetings/:id/extract-items',
    async (request, reply) => {
      const { id } = request.params;

      if (!request.user || !(await canEditMeeting(id, request.user))) {
        return reply
          .status(403)
          .send({ error: 'You do not have permission to update this meeting' });
      }

      const result = await actionItemsPipeline.extract(id);

      if (!result.success) {
        return reply.status(500).send({
          success: false,
          error: result.error,
        });
      }

      const stats = actionItemsPipeline.getStats(result.items);

      return reply.send({
        success: true,
        itemsCreated: result.itemsCreated,
        stats,
        processingTimeMs: result.processingTimeMs,
      });
    }
  );

  /**
   * Semantic search across meetings
   * POST /api/v1/search
   */
  fastify.post<{ Body: SearchBody }>('/api/v1/search', async (request, reply) => {
    const { query, limit = 10, contentTypes, meetingId } = request.body;

    if (!query || query.trim().length === 0) {
      return reply.status(400).send({
        error: 'Query is required',
      });
    }

    const results = await ragService.search(query, {
      limit,
      contentTypes,
      meetingId,
    });

    return reply.send({
      query,
      count: results.length,
      results: results.map((r) => ({
        meetingId: r.meetingId,
        contentType: r.contentType,
        content: r.content,
        similarity: Math.round(r.similarity * 100) / 100,
        metadata: r.metadata,
      })),
    });
  });

  /**
   * Get RAG context for a query
   * POST /api/v1/context
   */
  fastify.post<{ Body: SearchBody & { maxTokens?: number } }>(
    '/api/v1/context',
    async (request, reply) => {
      const { query, maxTokens = 8000, limit = 5, meetingId } = request.body;

      if (!query || query.trim().length === 0) {
        return reply.status(400).send({
          error: 'Query is required',
        });
      }

      const context = await ragService.getContext(query, {
        maxTokens,
        limit,
        meetingId,
      });

      return reply.send({
        query: context.query,
        totalTokens: context.totalTokens,
        resultsCount: context.results.length,
        context: context.results.map((r) => r.content).join('\n\n---\n\n'),
      });
    }
  );
}
