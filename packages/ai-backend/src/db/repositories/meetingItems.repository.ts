/**
 * @fileoverview Meeting Items Repository
 * @description Data access layer for action items, decisions, etc.
 */

import { eq, desc, and, not } from 'drizzle-orm';

import { db } from '../index.js';
import { meetingItems, progressUpdates, tags, meetingItemTags } from '../schema/index.js';

// Types
export type NewMeetingItem = typeof meetingItems.$inferInsert;
export type MeetingItem = typeof meetingItems.$inferSelect;
export type NewProgressUpdate = typeof progressUpdates.$inferInsert;
export type ProgressUpdate = typeof progressUpdates.$inferSelect;

export class MeetingItemsRepository {
  /**
   * Create a meeting item
   */
  async create(data: NewMeetingItem): Promise<MeetingItem | undefined> {
    const result = await db.insert(meetingItems).values(data).returning();
    return result[0];
  }

  /**
   * Batch create meeting items
   */
  async createBatch(items: NewMeetingItem[]): Promise<MeetingItem[]> {
    if (items.length === 0) return [];
    return db.insert(meetingItems).values(items).returning();
  }

  /**
   * Find by ID
   */
  async findById(id: string) {
    return db.query.meetingItems.findFirst({
      where: eq(meetingItems.id, id),
      with: {
        progressUpdates: true,
        meeting: true,
      },
    });
  }

  /**
   * Find all items for a meeting
   */
  async findByMeetingId(meetingId: string) {
    return db
      .select()
      .from(meetingItems)
      .where(eq(meetingItems.meetingId, meetingId))
      .orderBy(desc(meetingItems.createdAt));
  }

  /**
   * Find items by type
   */
  async findByType(
    meetingId: string,
    type:
      | 'action_item'
      | 'decision'
      | 'blocker'
      | 'risk'
      | 'announcement'
      | 'project_update'
      | 'idea'
      | 'question'
      | 'commitment'
      | 'deadline'
      | 'dependency'
      | 'parking_lot'
      | 'key_takeaway'
      | 'reference'
  ) {
    return db
      .select()
      .from(meetingItems)
      .where(and(eq(meetingItems.meetingId, meetingId), eq(meetingItems.itemType, type)));
  }

  /**
   * Find pending action items for a person
   */
  async findPendingByAssignee(assigneeEmail: string) {
    return db
      .select()
      .from(meetingItems)
      .where(
        and(
          eq(meetingItems.assigneeEmail, assigneeEmail),
          eq(meetingItems.itemType, 'action_item'),
          not(eq(meetingItems.status, 'completed')),
          not(eq(meetingItems.status, 'cancelled'))
        )
      )
      .orderBy(desc(meetingItems.priority), desc(meetingItems.dueDate));
  }

  /**
   * Find overdue action items
   */
  async findOverdue() {
    const allItems = await db
      .select()
      .from(meetingItems)
      .where(
        and(
          eq(meetingItems.itemType, 'action_item'),
          not(eq(meetingItems.status, 'completed')),
          not(eq(meetingItems.status, 'cancelled'))
        )
      );

    const todayStr = new Date().toISOString().split('T')[0]!;
    // Filter by due date
    return allItems.filter((item) => item.dueDate && item.dueDate < todayStr);
  }

  /**
   * Update item status
   */
  async updateStatus(
    id: string,
    status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'deferred' | 'cancelled',
    updatedBy?: string
  ) {
    const item = await this.findById(id);
    if (!item) return null;

    // Create progress update record
    if (item.status !== status) {
      await this.addProgressUpdate({
        meetingItemId: id,
        meetingId: item.meetingId,
        previousStatus: item.status || undefined,
        newStatus: status,
        updatedBy,
      });
    }

    const result = await db
      .update(meetingItems)
      .set({ status, updatedAt: new Date() })
      .where(eq(meetingItems.id, id))
      .returning();
    return result[0];
  }

  /**
   * Add a progress update
   */
  async addProgressUpdate(data: NewProgressUpdate): Promise<ProgressUpdate | undefined> {
    const result = await db.insert(progressUpdates).values(data).returning();
    return result[0];
  }

  /**
   * Get progress history for an item
   */
  async getProgressHistory(itemId: string) {
    return db
      .select()
      .from(progressUpdates)
      .where(eq(progressUpdates.meetingItemId, itemId))
      .orderBy(desc(progressUpdates.createdAt));
  }

  /**
   * Add tag to item
   */
  async addTag(itemId: string, tagName: string) {
    // Find or create tag
    let tag = await db.query.tags.findFirst({
      where: eq(tags.name, tagName),
    });

    if (!tag) {
      const result = await db.insert(tags).values({ name: tagName }).returning();
      tag = result[0];
    }

    // Link tag to item (only if tag exists)
    if (tag) {
      await db.insert(meetingItemTags).values({
        meetingItemId: itemId,
        tagId: tag.id,
      });
    }

    return tag;
  }

  /**
   * Delete item
   */
  async delete(id: string) {
    // Delete progress updates first
    await db.delete(progressUpdates).where(eq(progressUpdates.meetingItemId, id));
    // Delete tag links
    await db.delete(meetingItemTags).where(eq(meetingItemTags.meetingItemId, id));
    // Delete item
    return db.delete(meetingItems).where(eq(meetingItems.id, id)).returning();
  }
}

// Singleton instance
export const meetingItemsRepository = new MeetingItemsRepository();
