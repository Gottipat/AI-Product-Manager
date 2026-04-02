/**
 * @fileoverview Database Schema - Meetings
 * @description Meeting and participant tables
 */

import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';

import { captureSourceEnum, meetingStatusEnum, meetingTypeEnum } from './enums';
import { organizations, projects } from './organizations';

// Recurring meeting series
export const recurringSeries = pgTable('recurring_series', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  title: text('title').notNull(),
  recurrencePattern: text('recurrence_pattern'), // 'weekly', 'biweekly', 'monthly'
  firstMeetingDate: timestamp('first_meeting_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Meetings table
export const meetings = pgTable('meetings', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  projectId: uuid('project_id').references(() => projects.id),
  recurringSeriesId: uuid('recurring_series_id').references(() => recurringSeries.id),
  googleMeetLink: text('google_meet_link').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  meetingType: meetingTypeEnum('meeting_type').default('other').notNull(),
  status: meetingStatusEnum('status').default('scheduled').notNull(),
  startTime: timestamp('start_time'),
  endTime: timestamp('end_time'),
  durationMinutes: integer('duration_minutes'),
  totalTranscriptEvents: integer('total_transcript_events').default(0),
  botSessionId: text('bot_session_id'),
  captureSource: captureSourceEnum('capture_source').default('bot').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Meeting participants
export const participants = pgTable('participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  meetingId: uuid('meeting_id')
    .notNull()
    .references(() => meetings.id),
  displayName: text('display_name').notNull(),
  email: text('email'),
  speakerId: text('speaker_id'), // ID from caption attribution
  isBot: boolean('is_bot').default(false).notNull(),
  joinedAt: timestamp('joined_at'),
  leftAt: timestamp('left_at'),
  speakingDurationSeconds: integer('speaking_duration_seconds').default(0),
});

// Relations
export const recurringSeriesRelations = relations(recurringSeries, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [recurringSeries.organizationId],
    references: [organizations.id],
  }),
  meetings: many(meetings),
}));

export const meetingsRelations = relations(meetings, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [meetings.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [meetings.projectId],
    references: [projects.id],
  }),
  recurringSeries: one(recurringSeries, {
    fields: [meetings.recurringSeriesId],
    references: [recurringSeries.id],
  }),
  participants: many(participants),
}));

export const participantsRelations = relations(participants, ({ one }) => ({
  meeting: one(meetings, {
    fields: [participants.meetingId],
    references: [meetings.id],
  }),
}));
