/**
 * @fileoverview Action Items Extraction Pipeline
 * @description Standalone pipeline for extracting action items from transcripts
 */

import { meetingRepository } from '../db/repositories/meeting.repository.js';
import { meetingItemsRepository } from '../db/repositories/meetingItems.repository.js';
import { transcriptRepository } from '../db/repositories/transcript.repository.js';
import {
  dedupeContextualItems,
  reconcileMeetingItems,
  type ContextualActionItem,
} from '../lib/productManager.js';
import { formatTranscriptForAI, getTranscriptSpeakerStats } from '../lib/transcript.js';
import {
  openaiService,
  type ActionItem,
  type MeetingAnalysisContext,
} from '../services/openai.service.js';
import { productManagerService } from '../services/productManager.service.js';

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
      const [meeting, transcriptEvents] = await Promise.all([
        meetingRepository.findById(meetingId),
        transcriptRepository.findByMeetingId(meetingId),
      ]);

      const transcriptText = formatTranscriptForAI(transcriptEvents);

      if (!transcriptText || transcriptText.trim().length === 0) {
        throw new Error('No transcript available for this meeting');
      }

      const projectContext = await productManagerService.buildProjectContext({
        meetingId,
        projectId: meeting?.projectId ?? null,
        transcriptText,
        meetingStartTime: meeting?.startTime ?? null,
      });

      const baseContext = this.buildContext(meetingId, meeting, transcriptEvents, projectContext);

      // Extract items via OpenAI
      const extractedItems = dedupeContextualItems([
        ...(await openaiService.extractActionItems(transcriptText, baseContext)),
        ...projectContext.accountabilityAlerts,
      ]);
      const reconciliation = reconcileMeetingItems({
        currentItems: extractedItems,
        openItems: projectContext.openItems,
        transcriptText,
        referenceDate: meeting?.startTime ?? new Date(),
      });
      const items = reconciliation.contextualItems;

      // Save to database
      await meetingItemsRepository.deleteGeneratedByMeeting(meetingId, 'action_items_pipeline');
      await this.applyPriorItemUpdates(meetingId, reconciliation);
      const savedItems = await this.saveItems(meetingId, meeting?.projectId ?? null, items);

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

  private buildContext(
    meetingId: string,
    meeting: Awaited<ReturnType<typeof meetingRepository.findById>>,
    transcriptEvents: Awaited<ReturnType<typeof transcriptRepository.findByMeetingId>>,
    projectContext: Awaited<ReturnType<typeof productManagerService.buildProjectContext>>,
    reconciliation?: ReturnType<typeof reconcileMeetingItems>
  ): MeetingAnalysisContext {
    return {
      meetingId,
      title: meeting?.title,
      description: meeting?.description,
      projectName: meeting?.project?.name,
      projectDescription: meeting?.project?.description,
      organizationName: meeting?.organization?.name,
      meetingType: meeting?.meetingType,
      status: meeting?.status,
      captureSource: meeting?.captureSource,
      analysisMode: 'product_manager',
      startTime: meeting?.startTime?.toISOString(),
      endTime: meeting?.endTime?.toISOString(),
      durationMinutes: meeting?.durationMinutes,
      participants: (meeting?.participants ?? []).map((participant) => ({
        displayName: participant.displayName,
        email: participant.email,
        isBot: participant.isBot,
      })),
      transcript: getTranscriptSpeakerStats(transcriptEvents),
      recentMeetingSummaries: projectContext.recentMeetingSummaries,
      openItemsSummary: projectContext.openItemsSummary,
      accountabilityAlerts: projectContext.accountabilityAlerts.map((item) => item.title),
      accountabilityOwners: projectContext.accountabilityOwners,
      resolvedItemsSummary: reconciliation?.resolvedItemsSummary,
      readinessSignals: reconciliation?.readinessSignals ?? projectContext.readinessSignals,
      projectPriority: reconciliation?.projectPriority ?? projectContext.projectPriority,
      projectContextSummary: projectContext.contextSummary,
    };
  }

  /**
   * Save extracted items to database
   */
  private async saveItems(
    meetingId: string,
    projectId: string | null,
    items: ContextualActionItem[]
  ): Promise<{ id: string }[]> {
    if (items.length === 0) return [];

    const records = items.map((item) => ({
      meetingId,
      projectId,
      itemType: item.itemType,
      title: item.title,
      description: item.description,
      assignee: item.assignee,
      assigneeEmail: item.assigneeEmail,
      dueDate: item.dueDate, // Keep as string, DB expects string
      priority: item.priority ?? 'medium',
      status: 'pending' as const,
      aiConfidence: item.aiConfidence ?? null,
      sourceTranscriptRange: item.sourceTranscriptRange ?? null,
      metadata: {
        generatedBy: 'action_items_pipeline',
        sourceQuote: item.sourceQuote,
        context: item.context,
        accountability: {
          ownerLabel: item.assignee ?? null,
          accountabilityType: item.accountabilityType ?? 'unknown',
          accountableTeam:
            item.accountabilityType === 'team'
              ? (item.accountableTeam ?? item.assignee ?? null)
              : (item.accountableTeam ?? null),
        },
        ...(item.metadata ?? {}),
      },
    }));

    return await meetingItemsRepository.createBatch(records);
  }

  private async applyPriorItemUpdates(
    meetingId: string,
    reconciliation: ReturnType<typeof reconcileMeetingItems>
  ): Promise<void> {
    for (const update of reconciliation.priorItemUpdates) {
      await meetingItemsRepository.syncStatusFromMeeting({
        id: update.itemId,
        meetingId,
        status: update.newStatus,
        updateDescription: update.updateDescription,
        updatedBy: 'ai_product_manager',
      });
    }
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
