/**
 * @fileoverview Database Schema - Meeting Items
 * @description Unified table for all extracted meeting content (action items, decisions, etc.)
 */

import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, date, integer, real, jsonb } from 'drizzle-orm/pg-core';

import { meetingItemTypeEnum, priorityEnum, itemStatusEnum } from './enums';
import { meetings } from './meetings';
import { moms } from './mom';
import { projects } from './organizations';

// Unified meeting items table
export const meetingItems = pgTable('meeting_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id')
    .notNull()
    .references(() => meetings.id),
  momId: uuid('mom_id').references(() => moms.id),
  projectId: uuid('project_id').references(() => projects.id),
  itemType: meetingItemTypeEnum('item_type').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  assignee: text('assignee'),
  assigneeEmail: text('assignee_email'),
  dueDate: date('due_date'),
  status: itemStatusEnum('status').default('pending'),
  priority: priorityEnum('priority').default('medium'),
  metadata: jsonb('metadata'), // Type-specific data (see below)
  aiConfidence: real('ai_confidence'), // How confident AI was in extraction
  sourceTranscriptRange: jsonb('source_transcript_range'), // { startSeq: 10, endSeq: 15 }
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/*
 * Metadata examples by item_type:
 *
 * ACTION_ITEM: { estimated_hours: 4, context: "..." }
 * DECISION: { rationale: "...", alternatives_considered: [...] }
 * BLOCKER: { blocked_by: "...", team_affected: "..." }
 * RISK: { severity: "high", probability: "medium", mitigation: "..." }
 * DEADLINE: { date: "2024-03-15", is_hard_deadline: true }
 * REFERENCE: { url: "...", document_type: "confluence" }
 * DEPENDENCY: { external_team: "...", expected_date: "..." }
 */

// Progress updates for tracking items across meetings
export const progressUpdates = pgTable('progress_updates', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingItemId: uuid('meeting_item_id')
    .notNull()
    .references(() => meetingItems.id),
  meetingId: uuid('meeting_id')
    .notNull()
    .references(() => meetings.id),
  previousStatus: itemStatusEnum('previous_status'),
  newStatus: itemStatusEnum('new_status').notNull(),
  updateDescription: text('update_description'),
  percentComplete: integer('percent_complete'),
  updatedBy: text('updated_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Tags for flexible categorization
export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  color: text('color'), // Hex color for UI
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Many-to-many: meeting items to tags
export const meetingItemTags = pgTable('meeting_item_tags', {
  meetingItemId: uuid('meeting_item_id')
    .notNull()
    .references(() => meetingItems.id),
  tagId: uuid('tag_id')
    .notNull()
    .references(() => tags.id),
});

// Relations
export const meetingItemsRelations = relations(meetingItems, ({ one, many }) => ({
  meeting: one(meetings, {
    fields: [meetingItems.meetingId],
    references: [meetings.id],
  }),
  mom: one(moms, {
    fields: [meetingItems.momId],
    references: [moms.id],
  }),
  project: one(projects, {
    fields: [meetingItems.projectId],
    references: [projects.id],
  }),
  progressUpdates: many(progressUpdates),
  tags: many(meetingItemTags),
}));

export const progressUpdatesRelations = relations(progressUpdates, ({ one }) => ({
  meetingItem: one(meetingItems, {
    fields: [progressUpdates.meetingItemId],
    references: [meetingItems.id],
  }),
  meeting: one(meetings, {
    fields: [progressUpdates.meetingId],
    references: [meetings.id],
  }),
}));

export const meetingItemTagsRelations = relations(meetingItemTags, ({ one }) => ({
  meetingItem: one(meetingItems, {
    fields: [meetingItemTags.meetingItemId],
    references: [meetingItems.id],
  }),
  tag: one(tags, {
    fields: [meetingItemTags.tagId],
    references: [tags.id],
  }),
}));
