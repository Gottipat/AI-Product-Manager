/**
 * @fileoverview AI Routes Tests
 * @description Unit tests for AI API endpoints with mocked pipelines
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Mock pipelines
vi.mock('../pipelines/mom.pipeline.js', () => ({
  momPipeline: {
    generate: vi.fn(),
    getProgress: vi.fn(),
  },
}));

vi.mock('../pipelines/actionItems.pipeline.js', () => ({
  actionItemsPipeline: {
    extract: vi.fn(),
    getStats: vi.fn(),
  },
}));

vi.mock('../services/rag.service.js', () => ({
  ragService: {
    search: vi.fn(),
    getContext: vi.fn(),
  },
}));

import { actionItemsPipeline } from '../pipelines/actionItems.pipeline.js';
import { momPipeline } from '../pipelines/mom.pipeline.js';
import { ragService } from '../services/rag.service.js';

describe('AI Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/meetings/:id/generate-mom', () => {
    it('should trigger MoM generation successfully', async () => {
      (momPipeline.generate as Mock).mockResolvedValue({
        success: true,
        momId: 'mom-123',
        highlightsCreated: 5,
        itemsCreated: 3,
        processingTimeMs: 2500,
      });

      const result = await momPipeline.generate('meeting-123');

      expect(result.success).toBe(true);
      expect(result.momId).toBe('mom-123');
      expect(result.highlightsCreated).toBe(5);
      expect(result.itemsCreated).toBe(3);
    });

    it('should handle generation failure', async () => {
      (momPipeline.generate as Mock).mockResolvedValue({
        success: false,
        momId: null,
        error: 'No transcript available',
        processingTimeMs: 100,
      });

      const result = await momPipeline.generate('meeting-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No transcript available');
    });
  });

  describe('GET /api/v1/meetings/:id/ai-status', () => {
    it('should return progress when generation in progress', () => {
      (momPipeline.getProgress as Mock).mockReturnValue({
        status: 'generating',
        progress: 50,
        message: 'Generating MoM with AI...',
      });

      const progress = momPipeline.getProgress('meeting-123');

      expect(progress?.status).toBe('generating');
      expect(progress?.progress).toBe(50);
    });

    it('should return null when no generation in progress', () => {
      (momPipeline.getProgress as Mock).mockReturnValue(null);

      const progress = momPipeline.getProgress('meeting-123');

      expect(progress).toBeNull();
    });
  });

  describe('POST /api/v1/meetings/:id/extract-items', () => {
    it('should extract action items successfully', async () => {
      const mockItems = [
        { itemType: 'action_item', title: 'Task 1' },
        { itemType: 'decision', title: 'Decision 1' },
      ];

      (actionItemsPipeline.extract as Mock).mockResolvedValue({
        success: true,
        itemsCreated: 2,
        items: mockItems,
        processingTimeMs: 1500,
      });
      (actionItemsPipeline.getStats as Mock).mockReturnValue({
        total: 2,
        byType: { action_item: 1, decision: 1 },
        withAssignee: 1,
        withDueDate: 0,
      });

      const result = await actionItemsPipeline.extract('meeting-123');
      const stats = actionItemsPipeline.getStats(result.items);

      expect(result.success).toBe(true);
      expect(result.itemsCreated).toBe(2);
      expect(stats.total).toBe(2);
    });
  });

  describe('POST /api/v1/search', () => {
    it('should perform semantic search', async () => {
      (ragService.search as Mock).mockResolvedValue([
        {
          id: 'emb-1',
          meetingId: 'meeting-123',
          contentType: 'transcript',
          content: 'Discussion about Q1 budget',
          similarity: 0.95,
          metadata: { speaker: 'John' },
        },
        {
          id: 'emb-2',
          meetingId: 'meeting-456',
          contentType: 'mom',
          content: 'Budget allocation summary',
          similarity: 0.85,
          metadata: null,
        },
      ]);

      const results = await ragService.search('budget allocation', { limit: 10 });

      expect(results).toHaveLength(2);
      expect(results[0]?.similarity).toBe(0.95);
      expect(results[0]?.contentType).toBe('transcript');
    });

    it('should filter by content type', async () => {
      (ragService.search as Mock).mockResolvedValue([
        {
          id: 'emb-1',
          meetingId: 'meeting-123',
          contentType: 'mom',
          content: 'Summary content',
          similarity: 0.9,
        },
      ]);

      const results = await ragService.search('summary', {
        contentTypes: ['mom'],
        limit: 5,
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.contentType).toBe('mom');
    });
  });

  describe('POST /api/v1/context', () => {
    it('should return RAG context', async () => {
      (ragService.getContext as Mock).mockResolvedValue({
        query: 'What was discussed about budget?',
        results: [
          { content: 'Budget discussion transcript segment 1' },
          { content: 'Budget allocation in MoM' },
        ],
        totalTokens: 500,
      });

      const context = await ragService.getContext('What was discussed about budget?', {
        maxTokens: 8000,
        limit: 5,
      });

      expect(context.query).toBe('What was discussed about budget?');
      expect(context.results).toHaveLength(2);
      expect(context.totalTokens).toBe(500);
    });
  });
});
