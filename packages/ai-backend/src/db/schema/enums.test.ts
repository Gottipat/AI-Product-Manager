/**
 * @fileoverview Tests for Database Schema - Enums
 * @description Validates enum definitions are correct and complete
 */

import { describe, it, expect } from 'vitest';

import {
  meetingStatusEnum,
  meetingTypeEnum,
  meetingItemTypeEnum,
  priorityEnum,
  itemStatusEnum,
  highlightTypeEnum,
} from './enums.js';

describe('Database Enums', () => {
  describe('meetingStatusEnum', () => {
    it('should have all required statuses', () => {
      const values = meetingStatusEnum.enumValues;
      expect(values).toContain('scheduled');
      expect(values).toContain('bot_joining');
      expect(values).toContain('in_progress');
      expect(values).toContain('completed');
      expect(values).toContain('cancelled');
      expect(values).toContain('error');
    });

    it('should have exactly 6 statuses', () => {
      expect(meetingStatusEnum.enumValues).toHaveLength(6);
    });
  });

  describe('meetingTypeEnum', () => {
    it('should include common meeting types', () => {
      const values = meetingTypeEnum.enumValues;
      expect(values).toContain('standup');
      expect(values).toContain('sprint_planning');
      expect(values).toContain('one_on_one');
      expect(values).toContain('all_hands');
      expect(values).toContain('client_call');
    });

    it('should have 12 meeting types', () => {
      expect(meetingTypeEnum.enumValues).toHaveLength(12);
    });
  });

  describe('meetingItemTypeEnum', () => {
    const requiredTypes = [
      'action_item',
      'decision',
      'announcement',
      'project_update',
      'blocker',
      'idea',
      'question',
      'risk',
      'commitment',
      'deadline',
      'dependency',
      'parking_lot',
      'key_takeaway',
      'reference',
    ];

    it('should have all 14 required item types', () => {
      const values = meetingItemTypeEnum.enumValues;
      requiredTypes.forEach((type) => {
        expect(values).toContain(type);
      });
    });

    it('should have exactly 14 item types', () => {
      expect(meetingItemTypeEnum.enumValues).toHaveLength(14);
    });
  });

  describe('priorityEnum', () => {
    it('should have low, medium, high, critical', () => {
      const values = priorityEnum.enumValues;
      expect(values).toEqual(['low', 'medium', 'high', 'critical']);
    });
  });

  describe('itemStatusEnum', () => {
    it('should have all required statuses', () => {
      const values = itemStatusEnum.enumValues;
      expect(values).toContain('pending');
      expect(values).toContain('in_progress');
      expect(values).toContain('completed');
      expect(values).toContain('blocked');
      expect(values).toContain('deferred');
      expect(values).toContain('cancelled');
    });
  });

  describe('highlightTypeEnum', () => {
    it('should have all highlight types', () => {
      const values = highlightTypeEnum.enumValues;
      expect(values).toEqual(['executive_summary', 'key_point', 'notable_quote', 'outcome']);
    });
  });
});
