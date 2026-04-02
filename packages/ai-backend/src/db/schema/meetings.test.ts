/**
 * @fileoverview Tests for Database Schema - Meetings
 * @description Validates meeting tables structure
 */

import { describe, it, expect } from 'vitest';

import { meetings, participants, recurringSeries } from './meetings';

describe('Meeting Tables', () => {
  describe('meetings table', () => {
    it('should have all required columns', () => {
      const columns = Object.keys(meetings);
      expect(columns).toContain('id');
      expect(columns).toContain('googleMeetLink');
      expect(columns).toContain('title');
      expect(columns).toContain('meetingType');
      expect(columns).toContain('status');
      expect(columns).toContain('startTime');
      expect(columns).toContain('endTime');
    });

    it('should have foreign key references', () => {
      expect(meetings.organizationId).toBeDefined();
      expect(meetings.projectId).toBeDefined();
      expect(meetings.recurringSeriesId).toBeDefined();
    });

    it('should require google meet link', () => {
      expect(meetings.googleMeetLink.notNull).toBe(true);
    });

    it('should require title', () => {
      expect(meetings.title.notNull).toBe(true);
    });

    it('should track bot session', () => {
      expect(meetings.botSessionId).toBeDefined();
    });

    it('should track duration', () => {
      expect(meetings.durationMinutes).toBeDefined();
    });
  });

  describe('participants table', () => {
    it('should have required columns', () => {
      const columns = Object.keys(participants);
      expect(columns).toContain('id');
      expect(columns).toContain('meetingId');
      expect(columns).toContain('displayName');
      expect(columns).toContain('email');
      expect(columns).toContain('speakerId');
      expect(columns).toContain('isBot');
      expect(columns).toContain('joinedAt');
      expect(columns).toContain('leftAt');
      expect(columns).toContain('speakingDurationSeconds');
    });

    it('should require meeting reference', () => {
      expect(participants.meetingId.notNull).toBe(true);
    });

    it('should require display name', () => {
      expect(participants.displayName.notNull).toBe(true);
    });

    it('should track bot participants', () => {
      expect(participants.isBot).toBeDefined();
    });
  });

  describe('recurringSeries table', () => {
    it('should have required columns', () => {
      const columns = Object.keys(recurringSeries);
      expect(columns).toContain('id');
      expect(columns).toContain('organizationId');
      expect(columns).toContain('title');
      expect(columns).toContain('recurrencePattern');
    });

    it('should reference organization', () => {
      expect(recurringSeries.organizationId.notNull).toBe(true);
    });
  });
});
