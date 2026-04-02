/**
 * @fileoverview Database Schema - Enums
 * @description All enum types used in the database
 */

import { pgEnum } from 'drizzle-orm/pg-core';

// Meeting status lifecycle
export const meetingStatusEnum = pgEnum('meeting_status', [
  'scheduled',
  'bot_joining',
  'in_progress',
  'completed',
  'cancelled',
  'error',
]);

// Types of meetings
export const meetingTypeEnum = pgEnum('meeting_type', [
  'standup',
  'sprint_planning',
  'sprint_review',
  'retrospective',
  'one_on_one',
  'all_hands',
  'project_kickoff',
  'brainstorm',
  'client_call',
  'interview',
  'training',
  'other',
]);

// Types of meeting items (extracted content)
export const meetingItemTypeEnum = pgEnum('meeting_item_type', [
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
]);

// Priority levels
export const priorityEnum = pgEnum('priority', ['low', 'medium', 'high', 'critical']);

// Status for trackable items
export const itemStatusEnum = pgEnum('item_status', [
  'pending',
  'in_progress',
  'completed',
  'blocked',
  'deferred',
  'cancelled',
]);

// Highlight types for quick retrieval
export const highlightTypeEnum = pgEnum('highlight_type', [
  'executive_summary',
  'key_point',
  'notable_quote',
  'outcome',
]);

// How the meeting transcript was captured
export const captureSourceEnum = pgEnum('capture_source', ['bot', 'extension', 'manual']);
