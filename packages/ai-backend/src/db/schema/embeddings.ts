/**
 * @fileoverview Embeddings Schema
 * @description pgvector-enabled table for semantic search
 */

import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

import { meetings } from './meetings.js';

// Note: pgvector extension must be enabled in PostgreSQL
// CREATE EXTENSION IF NOT EXISTS vector;

/**
 * Meeting embeddings for semantic search
 * Uses pgvector for similarity search with OpenAI embeddings
 */
export const meetingEmbeddings = pgTable(
  'meeting_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Meeting reference
    meetingId: uuid('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),

    // Content type: what this embedding represents
    contentType: text('content_type').notNull(), // 'transcript', 'mom', 'highlight', 'action_item'

    // The original text content
    content: text('content').notNull(),

    // Vector embedding - using text for now, would use vector(1536) with pgvector
    // In production: embedding: vector('embedding', { dimensions: 1536 }),
    embedding: text('embedding'), // JSON-encoded float array until pgvector is set up

    // Metadata for filtering
    metadata: jsonb('metadata').$type<{
      speaker?: string;
      startIndex?: number;
      endIndex?: number;
      highlightType?: string;
      itemType?: string;
      importance?: number;
    }>(),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    meetingIdIdx: index('embedding_meeting_id_idx').on(table.meetingId),
    contentTypeIdx: index('embedding_content_type_idx').on(table.contentType),
  })
);

// Type exports
export type MeetingEmbedding = typeof meetingEmbeddings.$inferSelect;
export type NewMeetingEmbedding = typeof meetingEmbeddings.$inferInsert;
