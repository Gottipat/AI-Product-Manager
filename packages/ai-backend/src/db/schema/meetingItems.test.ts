/**
 * @fileoverview Tests for Database Schema - Meeting Items
 * @description Validates meeting items and progress tracking tables
 */

import { describe, it, expect } from 'vitest';

import { meetingItems, progressUpdates, tags, meetingItemTags } from './meetingItems';

describe('Meeting Items Tables', () => {
  describe('meetingItems table', () => {
    it('should have all required columns', () => {
      const columns = Object.keys(meetingItems);
      expect(columns).toContain('id');
      expect(columns).toContain('meetingId');
      expect(columns).toContain('momId');
      expect(columns).toContain('projectId');
      expect(columns).toContain('itemType');
      expect(columns).toContain('title');
      expect(columns).toContain('description');
      expect(columns).toContain('assignee');
      expect(columns).toContain('dueDate');
      expect(columns).toContain('status');
      expect(columns).toContain('priority');
      expect(columns).toContain('metadata');
      expect(columns).toContain('aiConfidence');
    });

    it('should require meeting reference', () => {
      expect(meetingItems.meetingId.notNull).toBe(true);
    });

    it('should require item type', () => {
      expect(meetingItems.itemType.notNull).toBe(true);
    });

    it('should require title', () => {
      expect(meetingItems.title.notNull).toBe(true);
    });

    it('should have optional project reference', () => {
      // Items may or may not be linked to a project
      expect(meetingItems.projectId.notNull).toBeFalsy();
    });

    it('should support JSONB metadata', () => {
      expect(meetingItems.metadata).toBeDefined();
    });

    it('should track source transcript range', () => {
      expect(meetingItems.sourceTranscriptRange).toBeDefined();
    });
  });

  describe('progressUpdates table', () => {
    it('should have all required columns', () => {
      const columns = Object.keys(progressUpdates);
      expect(columns).toContain('id');
      expect(columns).toContain('meetingItemId');
      expect(columns).toContain('meetingId');
      expect(columns).toContain('previousStatus');
      expect(columns).toContain('newStatus');
      expect(columns).toContain('updateDescription');
      expect(columns).toContain('percentComplete');
      expect(columns).toContain('updatedBy');
    });

    it('should require meeting item reference', () => {
      expect(progressUpdates.meetingItemId.notNull).toBe(true);
    });

    it('should require meeting reference', () => {
      expect(progressUpdates.meetingId.notNull).toBe(true);
    });

    it('should require new status', () => {
      expect(progressUpdates.newStatus.notNull).toBe(true);
    });
  });

  describe('tags table', () => {
    it('should have all required columns', () => {
      const columns = Object.keys(tags);
      expect(columns).toContain('id');
      expect(columns).toContain('name');
      expect(columns).toContain('color');
    });

    it('should have unique tag name', () => {
      expect(tags.name.isUnique).toBe(true);
    });

    it('should require tag name', () => {
      expect(tags.name.notNull).toBe(true);
    });
  });

  describe('meetingItemTags table (junction)', () => {
    it('should have meeting item reference', () => {
      expect(meetingItemTags.meetingItemId.notNull).toBe(true);
    });

    it('should have tag reference', () => {
      expect(meetingItemTags.tagId.notNull).toBe(true);
    });
  });
});
