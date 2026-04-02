/**
 * @fileoverview MoM Pipeline Tests
 * @description Unit tests for MoM generation pipeline with mocked dependencies
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Mock repositories
vi.mock('../db/repositories/mom.repository.js', () => ({
  momRepository: {
    upsert: vi.fn(),
    addHighlights: vi.fn(),
  },
}));

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
    generateMoM: vi.fn(),
    fitsInContext: vi.fn().mockReturnValue(true),
  },
}));

import { meetingItemsRepository } from '../db/repositories/meetingItems.repository.js';
import { momRepository } from '../db/repositories/mom.repository.js';
import { transcriptRepository } from '../db/repositories/transcript.repository.js';
import { openaiService } from '../services/openai.service.js';

import { MoMPipeline, momPipeline } from './mom.pipeline.js';

describe('MoM Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTranscript = `
    John: Good morning everyone.
    Sarah: Let's discuss the Q1 budget.
    John: I think we should allocate 50% to engineering.
    Sarah: Agreed. Let's also hire two more engineers.
  `;

  const mockMoMResponse = {
    executiveSummary: 'Team discussed Q1 budget allocation.',
    detailedSummary: 'Detailed discussion about engineering budget and hiring.',
    mainTopics: ['Budget', 'Hiring'],
    highlights: [
      {
        highlightType: 'key_point' as const,
        content: 'Allocate 50% to engineering',
        speaker: 'John',
        importance: 8,
        keywords: ['budget', 'engineering'],
      },
    ],
    items: [
      {
        itemType: 'action_item' as const,
        title: 'Hire two engineers',
        assignee: 'Sarah',
        priority: 'high' as const,
      },
      {
        itemType: 'decision' as const,
        title: 'Approved 50% budget for engineering',
        priority: 'medium' as const,
      },
    ],
    nextMeetingTopics: ['Review hiring progress'],
  };

  describe('generate', () => {
    it('should generate MoM successfully', async () => {
      // Setup mocks
      (transcriptRepository.getTranscriptText as Mock).mockResolvedValue(mockTranscript);
      (openaiService.generateMoM as Mock).mockResolvedValue(mockMoMResponse);
      (momRepository.upsert as Mock).mockResolvedValue({ id: 'mom-123', meetingId: 'meeting-123' });
      (momRepository.addHighlights as Mock).mockResolvedValue([{ id: 'highlight-1' }]);
      (meetingItemsRepository.createBatch as Mock).mockResolvedValue([
        { id: 'item-1' },
        { id: 'item-2' },
      ]);

      const result = await momPipeline.generate('meeting-123');

      expect(result.success).toBe(true);
      expect(result.momId).toBe('mom-123');
      expect(result.highlightsCreated).toBe(1);
      expect(result.itemsCreated).toBe(2);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should fail when no transcript available', async () => {
      (transcriptRepository.getTranscriptText as Mock).mockResolvedValue('');

      const result = await momPipeline.generate('meeting-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No transcript available for this meeting');
      expect(result.momId).toBeNull();
    });

    it('should fail when transcript is null', async () => {
      (transcriptRepository.getTranscriptText as Mock).mockResolvedValue(null);

      const result = await momPipeline.generate('meeting-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No transcript available for this meeting');
    });

    it('should handle OpenAI errors gracefully', async () => {
      (transcriptRepository.getTranscriptText as Mock).mockResolvedValue(mockTranscript);
      (openaiService.generateMoM as Mock).mockRejectedValue(new Error('Rate limit exceeded'));

      const result = await momPipeline.generate('meeting-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded');
    });

    it('should handle empty highlights array', async () => {
      const responseNoHighlights = { ...mockMoMResponse, highlights: [] };
      (transcriptRepository.getTranscriptText as Mock).mockResolvedValue(mockTranscript);
      (openaiService.generateMoM as Mock).mockResolvedValue(responseNoHighlights);
      (momRepository.upsert as Mock).mockResolvedValue({ id: 'mom-123' });
      (meetingItemsRepository.createBatch as Mock).mockResolvedValue([{ id: 'item-1' }]);

      const result = await momPipeline.generate('meeting-123');

      expect(result.success).toBe(true);
      expect(result.highlightsCreated).toBe(0);
      expect(momRepository.addHighlights).not.toHaveBeenCalled();
    });

    it('should handle empty items array', async () => {
      const responseNoItems = { ...mockMoMResponse, items: [] };
      (transcriptRepository.getTranscriptText as Mock).mockResolvedValue(mockTranscript);
      (openaiService.generateMoM as Mock).mockResolvedValue(responseNoItems);
      (momRepository.upsert as Mock).mockResolvedValue({ id: 'mom-123' });
      (momRepository.addHighlights as Mock).mockResolvedValue([{ id: 'h-1' }]);

      const result = await momPipeline.generate('meeting-123');

      expect(result.success).toBe(true);
      expect(result.itemsCreated).toBe(0);
      expect(meetingItemsRepository.createBatch).not.toHaveBeenCalled();
    });
  });

  describe('progress tracking', () => {
    it('should return null for meetings without progress', () => {
      const pipeline = new MoMPipeline();

      // New pipeline has no progress for random meeting
      expect(pipeline.getProgress('never-existed')).toBeNull();
    });

    it('should clear progress', () => {
      const pipeline = new MoMPipeline();
      pipeline.clearProgress('meeting-123');

      expect(pipeline.getProgress('meeting-123')).toBeNull();
    });
  });
});
