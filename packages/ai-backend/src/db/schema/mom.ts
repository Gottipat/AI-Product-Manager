/**
 * @fileoverview Database Schema - Minutes of Meeting (MoM)
 * @description AI-generated meeting summaries and highlights
 */

import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, real, integer, jsonb } from 'drizzle-orm/pg-core';

import { highlightTypeEnum } from './enums.js';
import { meetings } from './meetings.js';

// Minutes of Meeting (generated summaries)
export const moms = pgTable('moms', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id')
    .notNull()
    .references(() => meetings.id)
    .unique(),
  executiveSummary: text('executive_summary'),
  detailedSummary: text('detailed_summary'),
  attendanceSummary: jsonb('attendance_summary'), // { total: 5, names: [...], duration: ... }
  aiModelVersion: text('ai_model_version'),
  overallConfidence: real('overall_confidence'),
  processingTimeMs: integer('processing_time_ms'),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Meeting highlights (concise key points for search)
export const meetingHighlights = pgTable('meeting_highlights', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id')
    .notNull()
    .references(() => meetings.id),
  momId: uuid('mom_id').references(() => moms.id),
  highlightType: highlightTypeEnum('highlight_type').notNull(),
  content: text('content').notNull(),
  importance: integer('importance').default(3), // 1-5 scale
  keywords: text('keywords').array(), // For text search
  // embedding: vector('embedding', { dimensions: 1536 }), // Added when pgvector enabled
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const momsRelations = relations(moms, ({ one, many }) => ({
  meeting: one(meetings, {
    fields: [moms.meetingId],
    references: [meetings.id],
  }),
  highlights: many(meetingHighlights),
}));

export const meetingHighlightsRelations = relations(meetingHighlights, ({ one }) => ({
  meeting: one(meetings, {
    fields: [meetingHighlights.meetingId],
    references: [meetings.id],
  }),
  mom: one(moms, {
    fields: [meetingHighlights.momId],
    references: [moms.id],
  }),
}));
