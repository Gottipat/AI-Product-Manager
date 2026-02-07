/**
 * @fileoverview Action Items Extraction Pipeline
 * @description Standalone pipeline for extracting action items from transcripts
 */

import { meetingItemsRepository } from '../db/repositories/meetingItems.repository.js';
import { transcriptRepository } from '../db/repositories/transcript.repository.js';
import { openaiService, type ActionItem } from '../services/openai.service.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ExtractionResult {
  success: boolean;
  itemsCreated: number;
  items: ActionItem[];
  processingTimeMs: number;
  error?: string;
}

export interface ItemStats {
  total: number;
  byType: Record<string, number>;
  withAssignee: number;
  withDueDate: number;
}

// ============================================================================
// PIPELINE CLASS
// ============================================================================

export class ActionItemsPipeline {
  /**
   * Extract action items from a meeting transcript
   */
  async extract(meetingId: string): Promise<ExtractionResult> {
    const startTime = Date.now();

    try {
      // Fetch transcript
      const transcriptText = await transcriptRepository.getTranscriptText(meetingId);

      if (!transcriptText || transcriptText.trim().length === 0) {
        throw new Error('No transcript available for this meeting');
      }

      // Extract items via OpenAI
      const items = await openaiService.extractActionItems(transcriptText);

      // Save to database
      const savedItems = await this.saveItems(meetingId, items);

      return {
        success: true,
        itemsCreated: savedItems.length,
        items,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        itemsCreated: 0,
        items: [],
        processingTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Extract from raw transcript text (no database fetch)
   */
  async extractFromText(transcriptText: string): Promise<ActionItem[]> {
    return await openaiService.extractActionItems(transcriptText);
  }

  /**
   * Save extracted items to database
   */
  private async saveItems(meetingId: string, items: ActionItem[]): Promise<{ id: string }[]> {
    if (items.length === 0) return [];

    const records = items.map((item) => ({
      meetingId,
      itemType: item.itemType,
      title: item.title,
      description: item.description,
      assignee: item.assignee,
      assigneeEmail: item.assigneeEmail,
      dueDate: item.dueDate, // Keep as string, DB expects string
      priority: item.priority ?? 'medium',
      status: 'pending' as const,
      sourceQuote: item.sourceQuote,
    }));

    return await meetingItemsRepository.createBatch(records);
  }

  /**
   * Get statistics for extracted items
   */
  getStats(items: ActionItem[]): ItemStats {
    const byType: Record<string, number> = {};

    items.forEach((item) => {
      byType[item.itemType] = (byType[item.itemType] ?? 0) + 1;
    });

    return {
      total: items.length,
      byType,
      withAssignee: items.filter((i) => i.assignee).length,
      withDueDate: items.filter((i) => i.dueDate).length,
    };
  }
}

// Singleton instance
export const actionItemsPipeline = new ActionItemsPipeline();
