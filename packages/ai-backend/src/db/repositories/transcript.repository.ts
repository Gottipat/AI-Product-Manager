/**
 * @fileoverview Transcript Repository
 * @description Data access layer for transcript events
 */

import { eq, desc, asc, and, gte, lte } from 'drizzle-orm';

import { db } from '../index.js';
import { transcriptEvents } from '../schema/index.js';

// Types
export type NewTranscriptEvent = typeof transcriptEvents.$inferInsert;
export type TranscriptEvent = typeof transcriptEvents.$inferSelect;

export class TranscriptRepository {
  /**
   * Create a single transcript event
   */
  async create(data: NewTranscriptEvent): Promise<TranscriptEvent | undefined> {
    const result = await db.insert(transcriptEvents).values(data).returning();
    return result[0];
  }

  /**
   * Batch insert transcript events (for streaming efficiency)
   */
  async createBatch(events: NewTranscriptEvent[]): Promise<TranscriptEvent[]> {
    if (events.length === 0) return [];
    return db.insert(transcriptEvents).values(events).returning();
  }

  /**
   * Get all transcript events for a meeting (ordered by sequence)
   */
  async findByMeetingId(meetingId: string) {
    return db
      .select()
      .from(transcriptEvents)
      .where(eq(transcriptEvents.meetingId, meetingId))
      .orderBy(asc(transcriptEvents.sequenceNumber));
  }

  /**
   * Get transcript events within a sequence range
   */
  async findBySequenceRange(meetingId: string, startSeq: number, endSeq: number) {
    return db
      .select()
      .from(transcriptEvents)
      .where(
        and(
          eq(transcriptEvents.meetingId, meetingId),
          gte(transcriptEvents.sequenceNumber, startSeq),
          lte(transcriptEvents.sequenceNumber, endSeq)
        )
      )
      .orderBy(asc(transcriptEvents.sequenceNumber));
  }

  /**
   * Get latest transcript events (for real-time display)
   */
  async findLatest(meetingId: string, limit = 50) {
    return db
      .select()
      .from(transcriptEvents)
      .where(eq(transcriptEvents.meetingId, meetingId))
      .orderBy(desc(transcriptEvents.sequenceNumber))
      .limit(limit);
  }

  /**
   * Count transcript events for a meeting
   */
  async countByMeetingId(meetingId: string): Promise<number> {
    const result = await db
      .select()
      .from(transcriptEvents)
      .where(eq(transcriptEvents.meetingId, meetingId));
    return result.length;
  }

  /**
   * Get full transcript as text (for AI processing)
   */
  async getTranscriptText(meetingId: string): Promise<string> {
    const events = await this.findByMeetingId(meetingId);
    return events.map((e) => `${e.speaker}: ${e.content}`).join('\n');
  }

  /**
   * Get transcript grouped by speaker
   */
  async getTranscriptBySpeaker(meetingId: string) {
    const events = await this.findByMeetingId(meetingId);
    const bySpeaker: Record<string, TranscriptEvent[]> = {};

    for (const event of events) {
      if (!bySpeaker[event.speaker]) {
        bySpeaker[event.speaker] = [];
      }
      bySpeaker[event.speaker]!.push(event);
    }

    return bySpeaker;
  }

  /**
   * Delete all transcript events for a meeting
   */
  async deleteByMeetingId(meetingId: string) {
    return db.delete(transcriptEvents).where(eq(transcriptEvents.meetingId, meetingId)).returning();
  }
}

// Singleton instance
export const transcriptRepository = new TranscriptRepository();
