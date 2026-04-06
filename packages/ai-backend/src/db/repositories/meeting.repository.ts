/**
 * @fileoverview Meeting Repository
 * @description Data access layer for meetings table
 */

import { eq, desc, and, gte, lte, not } from 'drizzle-orm';

import { db } from '../index.js';
import { meetings, participants } from '../schema/index.js';

// Types
export type NewMeeting = typeof meetings.$inferInsert;
export type Meeting = typeof meetings.$inferSelect;
export type NewParticipant = typeof participants.$inferInsert;
export type Participant = typeof participants.$inferSelect;

export class MeetingRepository {
  /**
   * Create a new meeting
   */
  async create(data: NewMeeting): Promise<Meeting | undefined> {
    const result = await db.insert(meetings).values(data).returning();
    return result[0];
  }

  /**
   * Find meeting by ID with participants
   */
  async findById(id: string) {
    return db.query.meetings.findFirst({
      where: eq(meetings.id, id),
      with: {
        participants: true,
        recurringSeries: true,
        project: true,
        organization: true,
      },
    });
  }

  /**
   * Find meeting by Google Meet link
   */
  async findByMeetLink(meetLink: string) {
    return db.query.meetings.findFirst({
      where: eq(meetings.googleMeetLink, meetLink),
    });
  }

  /**
   * Update meeting status
   */
  async updateStatus(
    id: string,
    status: 'scheduled' | 'bot_joining' | 'in_progress' | 'completed' | 'cancelled' | 'error'
  ) {
    const result = await db
      .update(meetings)
      .set({ status, updatedAt: new Date() })
      .where(eq(meetings.id, id))
      .returning();
    return result[0];
  }

  /**
   * Complete a meeting (set end time and calculate duration)
   */
  async complete(id: string, endTime = new Date()) {
    const meeting = await this.findById(id);
    if (!meeting || !meeting.startTime) return null;

    const durationMinutes = Math.round((endTime.getTime() - meeting.startTime.getTime()) / 60000);

    const result = await db
      .update(meetings)
      .set({
        status: 'completed',
        endTime,
        durationMinutes,
        updatedAt: new Date(),
      })
      .where(eq(meetings.id, id))
      .returning();
    return result[0];
  }

  /**
   * Find recent meetings for an organization
   */
  async findRecent(organizationId: string, limit = 20) {
    return db.query.meetings.findMany({
      where: eq(meetings.organizationId, organizationId),
      orderBy: [desc(meetings.startTime)],
      limit,
      with: {
        participants: true,
        project: true,
      },
    });
  }

  /**
   * Find recent meetings for a project, excluding the current meeting when needed.
   */
  async findRecentByProject(projectId: string, limit = 5, excludeMeetingId?: string) {
    const conditions = [eq(meetings.projectId, projectId)];
    if (excludeMeetingId) {
      conditions.push(not(eq(meetings.id, excludeMeetingId)));
    }

    return db.query.meetings.findMany({
      where: and(...conditions),
      orderBy: [desc(meetings.startTime), desc(meetings.createdAt)],
      limit,
      with: {
        participants: true,
        project: true,
        organization: true,
      },
    });
  }

  /**
   * Find meetings in a date range
   */
  async findByDateRange(organizationId: string, startDate: Date, endDate: Date) {
    return db.query.meetings.findMany({
      where: and(
        eq(meetings.organizationId, organizationId),
        gte(meetings.startTime, startDate),
        lte(meetings.startTime, endDate)
      ),
      orderBy: [desc(meetings.startTime)],
    });
  }

  /**
   * Add a participant to a meeting
   */
  async addParticipant(data: NewParticipant): Promise<Participant | undefined> {
    const result = await db.insert(participants).values(data).returning();
    return result[0];
  }

  /**
   * Update participant (e.g., when they leave)
   */
  async updateParticipant(id: string, data: Partial<NewParticipant>) {
    const result = await db
      .update(participants)
      .set(data)
      .where(eq(participants.id, id))
      .returning();
    return result[0];
  }

  /**
   * Get all participants for a meeting
   */
  async getParticipants(meetingId: string) {
    return db.select().from(participants).where(eq(participants.meetingId, meetingId));
  }

  /**
   * Increment transcript event count
   */
  async incrementTranscriptCount(meetingId: string, count = 1) {
    const meeting = await this.findById(meetingId);
    if (!meeting) return null;

    const result = await db
      .update(meetings)
      .set({
        totalTranscriptEvents: (meeting.totalTranscriptEvents || 0) + count,
      })
      .where(eq(meetings.id, meetingId))
      .returning();
    return result[0];
  }

  /**
   * Delete a meeting
   */
  async delete(id: string) {
    return db.delete(meetings).where(eq(meetings.id, id)).returning();
  }
}

// Singleton instance
export const meetingRepository = new MeetingRepository();
