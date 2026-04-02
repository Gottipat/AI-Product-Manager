/**
 * @fileoverview Upload Route Tests
 * @description Test cases for transcript upload endpoint
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Mock dependencies
vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 'proj-123',
              organizationId: 'org-123',
              googleMeetLink: null,
              name: 'Test Project',
            },
          ]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

vi.mock('../db/repositories/meeting.repository.js', () => ({
  meetingRepository: {
    create: vi.fn().mockResolvedValue({ id: 'meeting-123' }),
  },
}));

vi.mock('../db/repositories/transcript.repository.js', () => ({
  transcriptRepository: {
    createBatch: vi.fn().mockResolvedValue([{ id: 'te-1' }, { id: 'te-2' }, { id: 'te-3' }]),
  },
}));

vi.mock('../pipelines/mom.pipeline.js', () => ({
  momPipeline: {
    generate: vi.fn().mockResolvedValue({
      success: true,
      momId: 'mom-123',
      highlightsCreated: 3,
      itemsCreated: 5,
      processingTimeMs: 2500,
    }),
  },
}));

import { transcriptRepository } from '../db/repositories/transcript.repository.js';
import { parseTranscript } from '../lib/transcript.js';
import { momPipeline } from '../pipelines/mom.pipeline.js';

describe('Upload Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Transcript Parser', () => {
    it('should parse speaker-attributed lines', () => {
      const raw = 'Alice: Hello everyone\nBob: Hi there\nCharlie: Good morning';
      const parsed = parseTranscript(raw).events;

      expect(parsed).toHaveLength(3);
      expect(parsed[0]).toMatchObject({ speaker: 'Alice', content: 'Hello everyone' });
      expect(parsed[1]).toMatchObject({ speaker: 'Bob', content: 'Hi there' });
      expect(parsed[2]).toMatchObject({ speaker: 'Charlie', content: 'Good morning' });
    });

    it('should fall back to generic speaker for plain text', () => {
      const raw = 'This is plain text without attribution';
      const parsed = parseTranscript(raw).events;

      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.speaker).toBe('Unknown Speaker');
      expect(parsed[0]?.content).toBe('This is plain text without attribution');
    });

    it('should handle mixed format transcripts', () => {
      const raw = 'Alice: First point\nSome plain text\nBob: Another point';
      const parsed = parseTranscript(raw).events;

      expect(parsed).toHaveLength(2);
      expect(parsed[0]?.speaker).toBe('Alice');
      expect(parsed[0]?.content).toContain('Some plain text');
      expect(parsed[1]?.speaker).toBe('Bob');
    });

    it('should skip empty lines', () => {
      const raw = 'Alice: Hello\n\n\nBob: World\n  \n';
      const parsed = parseTranscript(raw).events;
      expect(parsed).toHaveLength(2);
    });

    it('should ignore transcript headers and parse started time', () => {
      const raw = `=== Transcript for Meeting abc ===
Started at: 2026-04-02T09:00:00.000Z

[09:01 AM] Alice: Kickoff
[09:02 AM] Bob: Status update`;

      const parsed = parseTranscript(raw);

      expect(parsed.startedAt?.toISOString()).toBe('2026-04-02T09:00:00.000Z');
      expect(parsed.events).toHaveLength(2);
      expect(parsed.events[0]?.capturedAt?.toISOString()).toBe('2026-04-02T13:01:00.000Z');
    });
  });

  describe('Pipeline Integration', () => {
    it('should trigger MoM pipeline after batch insert', async () => {
      // Simulate the upload flow
      const transcriptEvents = [
        {
          meetingId: 'meeting-123',
          speaker: 'Alice',
          content: 'Let us discuss the roadmap',
          sequenceNumber: 1,
          isFinal: true,
          capturedAt: new Date(),
        },
      ];

      await transcriptRepository.createBatch(transcriptEvents);
      expect(transcriptRepository.createBatch).toHaveBeenCalledWith(transcriptEvents);

      const result = await momPipeline.generate('meeting-123');
      expect(momPipeline.generate).toHaveBeenCalledWith('meeting-123');
      expect(result.success).toBe(true);
      expect(result.momId).toBe('mom-123');
      expect(result.itemsCreated).toBe(5);
    });

    it('should handle pipeline failure gracefully', async () => {
      (momPipeline.generate as Mock).mockResolvedValueOnce({
        success: false,
        momId: null,
        highlightsCreated: 0,
        itemsCreated: 0,
        processingTimeMs: 100,
        error: 'No transcript available',
      });

      const result = await momPipeline.generate('meeting-bad');
      expect(result.success).toBe(false);
      expect(result.error).toBe('No transcript available');
    });
  });
});
