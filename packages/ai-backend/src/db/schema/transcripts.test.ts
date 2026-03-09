/**
 * @fileoverview Tests for Database Schema - Transcripts
 * @description Validates transcript event table
 */

import { describe, it, expect } from 'vitest';

import { transcriptEvents } from './transcripts';

describe('Transcript Tables', () => {
  describe('transcriptEvents table', () => {
    it('should have all required columns', () => {
      const columns = Object.keys(transcriptEvents);
      expect(columns).toContain('id');
      expect(columns).toContain('meetingId');
      expect(columns).toContain('speaker');
      expect(columns).toContain('speakerId');
      expect(columns).toContain('content');
      expect(columns).toContain('sequenceNumber');
      expect(columns).toContain('isFinal');
      expect(columns).toContain('confidence');
      expect(columns).toContain('capturedAt');
    });

    it('should require meeting reference', () => {
      expect(transcriptEvents.meetingId.notNull).toBe(true);
    });

    it('should require speaker name', () => {
      expect(transcriptEvents.speaker.notNull).toBe(true);
    });

    it('should require content', () => {
      expect(transcriptEvents.content.notNull).toBe(true);
    });

    it('should require sequence number for ordering', () => {
      expect(transcriptEvents.sequenceNumber.notNull).toBe(true);
    });

    it('should require captured timestamp', () => {
      expect(transcriptEvents.capturedAt.notNull).toBe(true);
    });

    it('should allow optional speaker ID', () => {
      // speakerId is for caption attribution, may not always be available
      expect(transcriptEvents.speakerId.notNull).toBeFalsy();
    });

    it('should allow optional confidence score', () => {
      expect(transcriptEvents.confidence.notNull).toBeFalsy();
    });
  });
});
