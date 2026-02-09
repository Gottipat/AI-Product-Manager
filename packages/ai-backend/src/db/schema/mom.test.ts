/**
 * @fileoverview Tests for Database Schema - MoM (Minutes of Meeting)
 * @description Validates MoM and highlights tables
 */

import { describe, it, expect } from 'vitest';

import { moms, meetingHighlights } from './mom';

describe('MoM Tables', () => {
  describe('moms table', () => {
    it('should have all required columns', () => {
      const columns = Object.keys(moms);
      expect(columns).toContain('id');
      expect(columns).toContain('meetingId');
      expect(columns).toContain('executiveSummary');
      expect(columns).toContain('detailedSummary');
      expect(columns).toContain('attendanceSummary');
      expect(columns).toContain('aiModelVersion');
      expect(columns).toContain('overallConfidence');
      expect(columns).toContain('processingTimeMs');
      expect(columns).toContain('generatedAt');
    });

    it('should require meeting reference', () => {
      expect(moms.meetingId.notNull).toBe(true);
    });

    it('should have unique meeting reference (one MoM per meeting)', () => {
      expect(moms.meetingId.isUnique).toBe(true);
    });

    it('should track AI model version', () => {
      expect(moms.aiModelVersion).toBeDefined();
    });

    it('should track processing performance', () => {
      expect(moms.processingTimeMs).toBeDefined();
    });
  });

  describe('meetingHighlights table', () => {
    it('should have all required columns', () => {
      const columns = Object.keys(meetingHighlights);
      expect(columns).toContain('id');
      expect(columns).toContain('meetingId');
      expect(columns).toContain('momId');
      expect(columns).toContain('highlightType');
      expect(columns).toContain('content');
      expect(columns).toContain('importance');
      expect(columns).toContain('keywords');
    });

    it('should require meeting reference', () => {
      expect(meetingHighlights.meetingId.notNull).toBe(true);
    });

    it('should require highlight type', () => {
      expect(meetingHighlights.highlightType.notNull).toBe(true);
    });

    it('should require content', () => {
      expect(meetingHighlights.content.notNull).toBe(true);
    });

    it('should support keywords array for search', () => {
      expect(meetingHighlights.keywords).toBeDefined();
    });

    it('should have optional MoM reference', () => {
      // Highlights can exist before full MoM generation
      expect(meetingHighlights.momId.notNull).toBeFalsy();
    });
  });
});
