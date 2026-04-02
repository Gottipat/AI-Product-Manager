/**
 * @fileoverview MoM Repository
 * @description Data access layer for Minutes of Meeting and highlights
 */

import { eq, desc, and } from 'drizzle-orm';

import { db } from '../index.js';
import { moms, meetingHighlights } from '../schema/index.js';

// Types
export type NewMom = typeof moms.$inferInsert;
export type Mom = typeof moms.$inferSelect;
export type NewHighlight = typeof meetingHighlights.$inferInsert;
export type Highlight = typeof meetingHighlights.$inferSelect;

export class MomRepository {
  /**
   * Create or update MoM for a meeting
   */
  async upsert(data: NewMom): Promise<Mom | undefined> {
    // Check if MoM exists for this meeting
    const existing = await this.findByMeetingId(data.meetingId);

    if (existing) {
      // Update existing
      const result = await db
        .update(moms)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(moms.meetingId, data.meetingId))
        .returning();
      return result[0];
    } else {
      // Create new
      const result = await db.insert(moms).values(data).returning();
      return result[0];
    }
  }

  /**
   * Find MoM by meeting ID
   */
  async findByMeetingId(meetingId: string) {
    return db.query.moms.findFirst({
      where: eq(moms.meetingId, meetingId),
      with: {
        highlights: true,
      },
    });
  }

  /**
   * Find MoM by ID
   */
  async findById(id: string) {
    return db.query.moms.findFirst({
      where: eq(moms.id, id),
      with: {
        highlights: true,
      },
    });
  }

  /**
   * Add a highlight to a meeting
   */
  async addHighlight(data: NewHighlight): Promise<Highlight | undefined> {
    const result = await db.insert(meetingHighlights).values(data).returning();
    return result[0];
  }

  /**
   * Batch add highlights
   */
  async addHighlights(highlights: NewHighlight[]): Promise<Highlight[]> {
    if (highlights.length === 0) return [];
    return db.insert(meetingHighlights).values(highlights).returning();
  }

  /**
   * Get all highlights for a meeting
   */
  async getHighlights(meetingId: string) {
    return db
      .select()
      .from(meetingHighlights)
      .where(eq(meetingHighlights.meetingId, meetingId))
      .orderBy(desc(meetingHighlights.importance));
  }

  /**
   * Get highlights by type
   */
  async getHighlightsByType(
    meetingId: string,
    type: 'executive_summary' | 'key_point' | 'notable_quote' | 'outcome'
  ) {
    return db
      .select()
      .from(meetingHighlights)
      .where(
        and(eq(meetingHighlights.meetingId, meetingId), eq(meetingHighlights.highlightType, type))
      );
  }

  /**
   * Search highlights by keywords
   */
  async searchByKeywords(_organizationId: string, keywords: string[]) {
    // Note: This is a simple implementation. For production, use full-text search
    // or pgvector for semantic search
    const allHighlights = await db.query.meetingHighlights.findMany({
      with: {
        meeting: true,
      },
    });

    // Filter by keywords (simple string matching)
    return allHighlights.filter((h) => {
      if (!h.keywords) return false;
      return keywords.some((kw) =>
        h.keywords?.some((hkw) => hkw.toLowerCase().includes(kw.toLowerCase()))
      );
    });
  }

  /**
   * Get recent MoMs for an organization
   */
  async findRecent(limit = 20) {
    return db.query.moms.findMany({
      orderBy: [desc(moms.generatedAt)],
      limit,
      with: {
        meeting: true,
        highlights: true,
      },
    });
  }

  /**
   * Delete MoM and its highlights
   */
  async deleteByMeetingId(meetingId: string) {
    // Delete highlights first (foreign key constraint)
    await db.delete(meetingHighlights).where(eq(meetingHighlights.meetingId, meetingId));

    // Delete MoM
    return db.delete(moms).where(eq(moms.meetingId, meetingId)).returning();
  }
}

// Singleton instance
export const momRepository = new MomRepository();
