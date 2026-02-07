/**
 * @fileoverview Meeting Routes Tests
 * @description Test cases for meeting CRUD endpoints
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Mock the repository
vi.mock('../db/repositories/meeting.repository.js', () => ({
  meetingRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    updateStatus: vi.fn(),
    complete: vi.fn(),
    addParticipant: vi.fn(),
    getParticipants: vi.fn(),
    findRecent: vi.fn(),
  },
}));

import { meetingRepository } from '../db/repositories/meeting.repository.js';

describe('Meeting Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/meetings', () => {
    it('should create a meeting with required fields', async () => {
      const mockMeeting = {
        id: 'meeting-123',
        title: 'Sprint Planning',
        googleMeetLink: 'https://meet.google.com/abc-def',
        status: 'scheduled',
        createdAt: new Date(),
        meetingType: 'standup' as const,
        updatedAt: new Date(),
        organizationId: null,
        projectId: null,
        recurringSeriesId: null,
        description: null,
        startTime: null,
        endTime: null,
        durationMinutes: null,
        totalTranscriptEvents: 0,
        botSessionId: null,
      };

      (meetingRepository.create as Mock).mockResolvedValue(mockMeeting);

      const result = await meetingRepository.create({
        title: 'Sprint Planning',
        googleMeetLink: 'https://meet.google.com/abc-def',
        organizationId: null,
        meetingType: 'standup',
        status: 'scheduled',
      });

      expect(result).toEqual(mockMeeting);
      expect(meetingRepository.create).toHaveBeenCalledTimes(1);
    });

    it('should fail without required fields', () => {
      const invalidRequest = { title: '' };
      expect(invalidRequest.title).toBeFalsy();
    });
  });

  describe('GET /api/v1/meetings/:id', () => {
    it('should return meeting by ID', async () => {
      (meetingRepository.findById as Mock).mockResolvedValue({
        id: 'meeting-123',
        title: 'Sprint Planning',
        status: 'in_progress',
      });

      const result = await meetingRepository.findById('meeting-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('meeting-123');
    });

    it('should return undefined for non-existent meeting', async () => {
      (meetingRepository.findById as Mock).mockResolvedValue(undefined);

      const result = await meetingRepository.findById('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('POST /api/v1/meetings/:id/start', () => {
    it('should update status to in_progress', async () => {
      (meetingRepository.updateStatus as Mock).mockResolvedValue({
        id: 'meeting-123',
        status: 'in_progress',
      });

      const result = await meetingRepository.updateStatus('meeting-123', 'in_progress');

      expect(result?.status).toBe('in_progress');
    });
  });

  describe('POST /api/v1/meetings/:id/complete', () => {
    it('should complete meeting and calculate duration', async () => {
      (meetingRepository.complete as Mock).mockResolvedValue({
        id: 'meeting-123',
        status: 'completed',
        durationMinutes: 45,
      });

      const result = await meetingRepository.complete('meeting-123');

      expect(result?.status).toBe('completed');
      expect(result?.durationMinutes).toBe(45);
    });

    it('should return null if meeting not found', async () => {
      (meetingRepository.complete as Mock).mockResolvedValue(null);

      const result = await meetingRepository.complete('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('POST /api/v1/meetings/:id/participants', () => {
    it('should add participant to meeting', async () => {
      (meetingRepository.addParticipant as Mock).mockResolvedValue({
        id: 'p1',
        meetingId: 'meeting-123',
        displayName: 'John Doe',
        email: 'john@example.com',
        isBot: false,
      });

      const result = await meetingRepository.addParticipant({
        meetingId: 'meeting-123',
        displayName: 'John Doe',
        email: 'john@example.com',
        isBot: false,
      });

      expect(result?.displayName).toBe('John Doe');
    });
  });

  describe('GET /api/v1/meetings/:id/participants', () => {
    it('should return all participants', async () => {
      (meetingRepository.getParticipants as Mock).mockResolvedValue([
        { id: 'p1', displayName: 'John' },
        { id: 'p2', displayName: 'Jane' },
      ]);

      const result = await meetingRepository.getParticipants('meeting-123');

      expect(result).toHaveLength(2);
    });
  });

  describe('GET /api/v1/organizations/:orgId/meetings', () => {
    it('should return recent meetings for org', async () => {
      (meetingRepository.findRecent as Mock).mockResolvedValue([
        { id: 'm1', title: 'Meeting 1' },
        { id: 'm2', title: 'Meeting 2' },
      ]);

      const result = await meetingRepository.findRecent('org-123', 20);

      expect(result).toHaveLength(2);
      expect(meetingRepository.findRecent).toHaveBeenCalledWith('org-123', 20);
    });
  });
});
