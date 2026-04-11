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
    deleteHighlightsByMomId: vi.fn(),
  },
}));

vi.mock('../db/repositories/meetingItems.repository.js', () => ({
  meetingItemsRepository: {
    createBatch: vi.fn(),
    deleteByMomId: vi.fn(),
    deleteGeneratedByMeeting: vi.fn(),
    syncStatusFromMeeting: vi.fn(),
  },
}));

vi.mock('../db/repositories/meeting.repository.js', () => ({
  meetingRepository: {
    findById: vi.fn().mockResolvedValue({
      id: 'meeting-123',
      title: 'Budget Review',
      participants: [],
    }),
  },
}));

vi.mock('../db/repositories/transcript.repository.js', () => ({
  transcriptRepository: {
    findByMeetingId: vi.fn(),
  },
}));

vi.mock('../services/productManager.service.js', () => ({
  productManagerService: {
    buildProjectContext: vi.fn().mockResolvedValue({
      openItems: [],
      recentMeetingSummaries: [],
      openItemsSummary: [],
      accountabilityAlerts: [],
      readinessSignals: [],
      projectPriority: 'low',
      contextSummary: 'No project context.',
    }),
  },
}));

// Mock OpenAI service
vi.mock('../services/openai.service.js', () => ({
  openaiService: {
    extractActionItems: vi.fn().mockResolvedValue([]),
    generateMoMWithSeedItems: vi.fn(),
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

  const mockTranscriptEvents = [
    {
      id: 'te-1',
      meetingId: 'meeting-123',
      speaker: 'John',
      content: 'Good morning everyone.',
      sequenceNumber: 1,
      capturedAt: new Date('2026-04-02T09:00:00.000Z'),
    },
    {
      id: 'te-2',
      meetingId: 'meeting-123',
      speaker: 'Sarah',
      content: "Let's discuss the Q1 budget.",
      sequenceNumber: 2,
      capturedAt: new Date('2026-04-02T09:01:00.000Z'),
    },
    {
      id: 'te-3',
      meetingId: 'meeting-123',
      speaker: 'John',
      content: 'I think we should allocate 50% to engineering.',
      sequenceNumber: 3,
      capturedAt: new Date('2026-04-02T09:02:00.000Z'),
    },
    {
      id: 'te-4',
      meetingId: 'meeting-123',
      speaker: 'Sarah',
      content: "Agreed. Let's also hire two more engineers.",
      sequenceNumber: 4,
      capturedAt: new Date('2026-04-02T09:03:00.000Z'),
    },
  ];

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
      (transcriptRepository.findByMeetingId as Mock).mockResolvedValue(mockTranscriptEvents);
      (openaiService.generateMoMWithSeedItems as Mock).mockResolvedValue(mockMoMResponse);
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

    it('should create a placeholder MoM when no transcript is available', async () => {
      (transcriptRepository.findByMeetingId as Mock).mockResolvedValue([]);
      (momRepository.upsert as Mock).mockResolvedValue({
        id: 'mom-empty',
        meetingId: 'meeting-123',
      });

      const result = await momPipeline.generate('meeting-123');

      expect(result.success).toBe(true);
      expect(result.momId).toBe('mom-empty');
      expect(result.highlightsCreated).toBe(0);
      expect(result.itemsCreated).toBe(0);
    });

    it('should create a placeholder MoM when transcript resolves to empty content', async () => {
      (transcriptRepository.findByMeetingId as Mock).mockResolvedValue([]);
      (momRepository.upsert as Mock).mockResolvedValue({
        id: 'mom-empty',
        meetingId: 'meeting-123',
      });

      const result = await momPipeline.generate('meeting-123');

      expect(result.success).toBe(true);
      expect(result.momId).toBe('mom-empty');
    });

    it('should handle OpenAI errors gracefully', async () => {
      (transcriptRepository.findByMeetingId as Mock).mockResolvedValue(mockTranscriptEvents);
      (openaiService.generateMoMWithSeedItems as Mock).mockRejectedValue(
        new Error('Rate limit exceeded')
      );

      const result = await momPipeline.generate('meeting-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded');
    });

    it('should handle empty highlights array', async () => {
      const responseNoHighlights = { ...mockMoMResponse, highlights: [] };
      (transcriptRepository.findByMeetingId as Mock).mockResolvedValue(mockTranscriptEvents);
      (openaiService.generateMoMWithSeedItems as Mock).mockResolvedValue(responseNoHighlights);
      (momRepository.upsert as Mock).mockResolvedValue({ id: 'mom-123' });
      (meetingItemsRepository.createBatch as Mock).mockResolvedValue([{ id: 'item-1' }]);

      const result = await momPipeline.generate('meeting-123');

      expect(result.success).toBe(true);
      expect(result.highlightsCreated).toBe(0);
      expect(momRepository.addHighlights).not.toHaveBeenCalled();
    });

    it('should handle empty items array', async () => {
      const responseNoItems = { ...mockMoMResponse, items: [] };
      (transcriptRepository.findByMeetingId as Mock).mockResolvedValue(mockTranscriptEvents);
      (openaiService.generateMoMWithSeedItems as Mock).mockResolvedValue(responseNoItems);
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
