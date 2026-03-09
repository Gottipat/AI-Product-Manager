/**
 * @fileoverview Transcript Routes Tests
 * @description Test cases for transcript streaming endpoints
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Mock repositories
vi.mock('../db/repositories/meeting.repository.js', () => ({
  meetingRepository: { incrementTranscriptCount: vi.fn() },
}));

vi.mock('../db/repositories/transcript.repository.js', () => ({
  transcriptRepository: {
    create: vi.fn(),
    createBatch: vi.fn(),
    findByMeetingId: vi.fn(),
    getTranscriptText: vi.fn(),
    getTranscriptBySpeaker: vi.fn(),
    findLatest: vi.fn(),
  },
}));

import { transcriptRepository } from '../db/repositories/transcript.repository.js';

describe('Transcript Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/meetings/:id/transcripts', () => {
    it('should create a single transcript event', async () => {
      (transcriptRepository.create as Mock).mockResolvedValue({
        id: 'event-123',
        meetingId: 'meeting-123',
        speaker: 'John Doe',
        content: 'Hello everyone',
        sequenceNumber: 1,
        isFinal: true,
      });

      const result = await transcriptRepository.create({
        meetingId: 'meeting-123',
        speaker: 'John Doe',
        content: 'Hello everyone',
        sequenceNumber: 1,
        isFinal: true,
        capturedAt: new Date(),
      });

      expect(result?.speaker).toBe('John Doe');
      expect(result?.content).toBe('Hello everyone');
    });
  });

  describe('POST /api/v1/meetings/:id/transcripts/batch', () => {
    it('should batch insert transcript events', async () => {
      (transcriptRepository.createBatch as Mock).mockResolvedValue([
        { id: 'e1', speaker: 'Alice', content: 'Hello', sequenceNumber: 1 },
        { id: 'e2', speaker: 'Bob', content: 'Hi there', sequenceNumber: 2 },
      ]);

      const result = await transcriptRepository.createBatch([
        {
          meetingId: 'm1',
          speaker: 'Alice',
          content: 'Hello',
          sequenceNumber: 1,
          capturedAt: new Date(),
        },
        {
          meetingId: 'm1',
          speaker: 'Bob',
          content: 'Hi',
          sequenceNumber: 2,
          capturedAt: new Date(),
        },
      ]);

      expect(result).toHaveLength(2);
    });

    it('should return empty array for empty input', async () => {
      (transcriptRepository.createBatch as Mock).mockResolvedValue([]);

      const result = await transcriptRepository.createBatch([]);

      expect(result).toHaveLength(0);
    });
  });

  describe('GET /api/v1/meetings/:id/transcripts', () => {
    it('should return all transcripts ordered by sequence', async () => {
      (transcriptRepository.findByMeetingId as Mock).mockResolvedValue([
        { sequenceNumber: 1, content: 'First' },
        { sequenceNumber: 2, content: 'Second' },
        { sequenceNumber: 3, content: 'Third' },
      ]);

      const result = await transcriptRepository.findByMeetingId('meeting-123');

      expect(result).toHaveLength(3);
    });
  });

  describe('GET /api/v1/meetings/:id/transcripts/text', () => {
    it('should return transcript as formatted text', async () => {
      const mockText = 'John: Hello everyone\nAlice: Hi John!';

      (transcriptRepository.getTranscriptText as Mock).mockResolvedValue(mockText);

      const result = await transcriptRepository.getTranscriptText('meeting-123');

      expect(result).toContain('John: Hello everyone');
      expect(result).toContain('Alice: Hi John!');
    });
  });

  describe('GET /api/v1/meetings/:id/transcripts/by-speaker', () => {
    it('should group transcripts by speaker', async () => {
      (transcriptRepository.getTranscriptBySpeaker as Mock).mockResolvedValue({
        John: [{ content: 'Hello' }, { content: 'Goodbye' }],
        Alice: [{ content: 'Hi' }],
      });

      const result = await transcriptRepository.getTranscriptBySpeaker('meeting-123');

      expect(Object.keys(result)).toHaveLength(2);
    });
  });

  describe('GET /api/v1/meetings/:id/transcripts/latest', () => {
    it('should return latest N events', async () => {
      (transcriptRepository.findLatest as Mock).mockResolvedValue([
        { sequenceNumber: 100 },
        { sequenceNumber: 99 },
        { sequenceNumber: 98 },
      ]);

      const result = await transcriptRepository.findLatest('meeting-123', 3);

      expect(result).toHaveLength(3);
    });
  });
});
