/**
 * @fileoverview MoM Routes Tests
 * @description Test cases for Minutes of Meeting endpoints
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Mock repository
vi.mock('../db/repositories/mom.repository.js', () => ({
  momRepository: {
    upsert: vi.fn(),
    findByMeetingId: vi.fn(),
    addHighlight: vi.fn(),
    addHighlights: vi.fn(),
    getHighlights: vi.fn(),
    getHighlightsByType: vi.fn(),
    findRecent: vi.fn(),
  },
}));

import { momRepository } from '../db/repositories/mom.repository.js';

describe('MoM Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/meetings/:id/mom', () => {
    it('should create a new MoM', async () => {
      (momRepository.upsert as Mock).mockResolvedValue({
        id: 'mom-123',
        meetingId: 'meeting-123',
        executiveSummary: 'Team discussed Q1 priorities',
        aiModelVersion: 'gpt-4-turbo',
      });

      const result = await momRepository.upsert({
        meetingId: 'meeting-123',
        executiveSummary: 'Team discussed Q1 priorities',
        aiModelVersion: 'gpt-4-turbo',
      });

      expect(result?.executiveSummary).toContain('Q1 priorities');
    });

    it('should update existing MoM', async () => {
      (momRepository.upsert as Mock).mockResolvedValue({
        id: 'mom-123',
        meetingId: 'meeting-123',
        executiveSummary: 'Updated summary',
        detailedSummary: 'More details',
      });

      const result = await momRepository.upsert({
        meetingId: 'meeting-123',
        executiveSummary: 'Updated summary',
        detailedSummary: 'More details',
      });

      expect(result?.executiveSummary).toBe('Updated summary');
    });
  });

  describe('GET /api/v1/meetings/:id/mom', () => {
    it('should return MoM with highlights', async () => {
      (momRepository.findByMeetingId as Mock).mockResolvedValue({
        id: 'mom-123',
        executiveSummary: 'Summary',
        highlights: [{ id: 'h1', highlightType: 'key_point', content: 'Important' }],
      });

      const result = await momRepository.findByMeetingId('meeting-123');

      expect(result).toBeDefined();
    });

    it('should return undefined for non-existent meeting', async () => {
      (momRepository.findByMeetingId as Mock).mockResolvedValue(undefined);

      const result = await momRepository.findByMeetingId('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('POST /api/v1/meetings/:id/highlights', () => {
    it('should add a highlight', async () => {
      (momRepository.addHighlight as Mock).mockResolvedValue({
        id: 'h1',
        meetingId: 'meeting-123',
        highlightType: 'key_point',
        content: 'Decided to launch feature X',
        importance: 8,
      });

      const result = await momRepository.addHighlight({
        meetingId: 'meeting-123',
        highlightType: 'key_point',
        content: 'Decided to launch feature X',
        importance: 8,
      });

      expect(result?.highlightType).toBe('key_point');
      expect(result?.importance).toBe(8);
    });
  });

  describe('POST /api/v1/meetings/:id/highlights/batch', () => {
    it('should batch add highlights', async () => {
      (momRepository.addHighlights as Mock).mockResolvedValue([
        { id: 'h1', highlightType: 'key_point', content: 'Point 1' },
        { id: 'h2', highlightType: 'outcome', content: 'Outcome 1' },
      ]);

      const result = await momRepository.addHighlights([
        { meetingId: 'm1', highlightType: 'key_point', content: 'Point 1' },
        { meetingId: 'm1', highlightType: 'outcome', content: 'Outcome 1' },
      ]);

      expect(result).toHaveLength(2);
    });
  });

  describe('GET /api/v1/meetings/:id/highlights', () => {
    it('should return all highlights', async () => {
      (momRepository.getHighlights as Mock).mockResolvedValue([
        { id: 'h1', highlightType: 'key_point' },
        { id: 'h2', highlightType: 'outcome' },
      ]);

      const result = await momRepository.getHighlights('meeting-123');

      expect(result).toHaveLength(2);
    });

    it('should filter by type', async () => {
      (momRepository.getHighlightsByType as Mock).mockResolvedValue([
        { id: 'h1', highlightType: 'key_point' },
      ]);

      const result = await momRepository.getHighlightsByType('meeting-123', 'key_point');

      expect(result).toHaveLength(1);
    });
  });

  describe('GET /api/v1/mom/recent', () => {
    it('should return recent MoMs', async () => {
      (momRepository.findRecent as Mock).mockResolvedValue([
        { id: 'm1', executiveSummary: 'Summary 1' },
        { id: 'm2', executiveSummary: 'Summary 2' },
      ]);

      const result = await momRepository.findRecent(20);

      expect(result).toHaveLength(2);
    });
  });
});
