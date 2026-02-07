/**
 * @fileoverview Action Items Pipeline Tests
 * @description Unit tests for action item extraction with mocked dependencies
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Mock repositories
vi.mock('../db/repositories/meetingItems.repository.js', () => ({
  meetingItemsRepository: {
    createBatch: vi.fn(),
  },
}));

vi.mock('../db/repositories/transcript.repository.js', () => ({
  transcriptRepository: {
    getTranscriptText: vi.fn(),
  },
}));

// Mock OpenAI service
vi.mock('../services/openai.service.js', () => ({
  openaiService: {
    extractActionItems: vi.fn(),
  },
}));

import { meetingItemsRepository } from '../db/repositories/meetingItems.repository.js';
import { transcriptRepository } from '../db/repositories/transcript.repository.js';
import { openaiService } from '../services/openai.service.js';

import { actionItemsPipeline } from './actionItems.pipeline.js';

describe('Action Items Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTranscript = `
    John: We need to finish the API documentation by Friday.
    Sarah: I'll handle the frontend updates.
    John: There's a blocker with the database migration.
  `;

  const mockActionItems = [
    {
      itemType: 'action_item' as const,
      title: 'Finish API documentation',
      assignee: 'John',
      dueDate: '2024-02-09',
      priority: 'high' as const,
    },
    {
      itemType: 'action_item' as const,
      title: 'Handle frontend updates',
      assignee: 'Sarah',
      priority: 'medium' as const,
    },
    {
      itemType: 'blocker' as const,
      title: 'Database migration issue',
      priority: 'critical' as const,
    },
  ];

  describe('extract', () => {
    it('should extract action items successfully', async () => {
      (transcriptRepository.getTranscriptText as Mock).mockResolvedValue(mockTranscript);
      (openaiService.extractActionItems as Mock).mockResolvedValue(mockActionItems);
      (meetingItemsRepository.createBatch as Mock).mockResolvedValue([
        { id: 'item-1' },
        { id: 'item-2' },
        { id: 'item-3' },
      ]);

      const result = await actionItemsPipeline.extract('meeting-123');

      expect(result.success).toBe(true);
      expect(result.itemsCreated).toBe(3);
      expect(result.items).toHaveLength(3);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should fail when no transcript available', async () => {
      (transcriptRepository.getTranscriptText as Mock).mockResolvedValue('');

      const result = await actionItemsPipeline.extract('meeting-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No transcript available for this meeting');
      expect(result.items).toEqual([]);
    });

    it('should handle empty items array', async () => {
      (transcriptRepository.getTranscriptText as Mock).mockResolvedValue(mockTranscript);
      (openaiService.extractActionItems as Mock).mockResolvedValue([]);

      const result = await actionItemsPipeline.extract('meeting-123');

      expect(result.success).toBe(true);
      expect(result.itemsCreated).toBe(0);
      expect(result.items).toEqual([]);
      expect(meetingItemsRepository.createBatch).not.toHaveBeenCalled();
    });

    it('should handle OpenAI errors gracefully', async () => {
      (transcriptRepository.getTranscriptText as Mock).mockResolvedValue(mockTranscript);
      (openaiService.extractActionItems as Mock).mockRejectedValue(new Error('API quota exceeded'));

      const result = await actionItemsPipeline.extract('meeting-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('API quota exceeded');
    });
  });

  describe('extractFromText', () => {
    it('should extract from raw text without database', async () => {
      (openaiService.extractActionItems as Mock).mockResolvedValue(mockActionItems);

      const result = await actionItemsPipeline.extractFromText(mockTranscript);

      expect(result).toHaveLength(3);
      expect(transcriptRepository.getTranscriptText).not.toHaveBeenCalled();
      expect(meetingItemsRepository.createBatch).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should calculate statistics for items', () => {
      const stats = actionItemsPipeline.getStats(mockActionItems);

      expect(stats.total).toBe(3);
      expect(stats.byType.action_item).toBe(2);
      expect(stats.byType.blocker).toBe(1);
      expect(stats.withAssignee).toBe(2);
      expect(stats.withDueDate).toBe(1);
    });

    it('should handle empty items array', () => {
      const stats = actionItemsPipeline.getStats([]);

      expect(stats.total).toBe(0);
      expect(stats.byType).toEqual({});
      expect(stats.withAssignee).toBe(0);
      expect(stats.withDueDate).toBe(0);
    });
  });
});
