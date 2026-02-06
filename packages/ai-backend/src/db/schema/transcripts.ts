/**
 * @fileoverview Database Schema - Transcripts
 * @description Transcript events captured during meetings
 */

import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, boolean, integer, real } from 'drizzle-orm/pg-core';

import { meetings } from './meetings.js';

// Transcript events (raw captions with speaker attribution)
export const transcriptEvents = pgTable('transcript_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id')
    .notNull()
    .references(() => meetings.id),
  speaker: text('speaker').notNull(),
  speakerId: text('speaker_id'),
  content: text('content').notNull(),
  sequenceNumber: integer('sequence_number').notNull(),
  isFinal: boolean('is_final').default(true).notNull(),
  confidence: real('confidence'),
  capturedAt: timestamp('captured_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const transcriptEventsRelations = relations(transcriptEvents, ({ one }) => ({
  meeting: one(meetings, {
    fields: [transcriptEvents.meetingId],
    references: [meetings.id],
  }),
}));
