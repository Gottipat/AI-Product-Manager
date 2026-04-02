/**
 * @fileoverview MoM Generation Pipeline
 * @description Orchestrates the full Minutes of Meeting generation flow
 */

import { meetingItemsRepository } from '../db/repositories/meetingItems.repository.js';
import { momRepository } from '../db/repositories/mom.repository.js';
import { transcriptRepository } from '../db/repositories/transcript.repository.js';
import { openaiService, type Highlight, type ActionItem } from '../services/openai.service.js';

// ============================================================================
// TYPES
// ============================================================================

export interface MoMGenerationResult {
  success: boolean;
  momId: string | null;
  highlightsCreated: number;
  itemsCreated: number;
  processingTimeMs: number;
  error?: string;
}

export interface GenerationProgress {
  status: 'pending' | 'fetching_transcript' | 'generating' | 'saving' | 'completed' | 'error';
  progress: number; // 0-100
  message: string;
}

// In-memory progress tracking (would use Redis in production)
const progressMap = new Map<string, GenerationProgress>();

// ============================================================================
// PIPELINE CLASS
// ============================================================================

export class MoMPipeline {
  /**
   * Generate MoM for a meeting
   */
  async generate(meetingId: string): Promise<MoMGenerationResult> {
    const startTime = Date.now();

    try {
      // Step 1: Fetch transcript
      this.updateProgress(meetingId, {
        status: 'fetching_transcript',
        progress: 10,
        message: 'Fetching transcript...',
      });

      const transcriptText = await transcriptRepository.getTranscriptText(meetingId);

      if (!transcriptText || transcriptText.trim().length === 0) {
        // Save placeholder MoM
        const mom = await momRepository.upsert({
            meetingId,
            executiveSummary: 'This meeting was completely silent or captions were disabled, so no summary could be generated.',
            detailedSummary: '',
            aiModelVersion: 'gpt-4o',
        });

        return {
          success: true,
          momId: mom?.id || null,
          highlightsCreated: 0,
          itemsCreated: 0,
          processingTimeMs: Date.now() - startTime,
        };
      }

      // Check if transcript is too long
      if (!openaiService.fitsInContext(transcriptText, 100000)) {
        // Would implement chunking here for very long meetings
        console.warn('Large transcript detected, may need chunking');
      }

      // Step 2: Generate MoM via OpenAI
      this.updateProgress(meetingId, {
        status: 'generating',
        progress: 30,
        message: 'Generating MoM with AI...',
      });

      const momResponse = await openaiService.generateMoM(transcriptText);

      // Step 3: Save to database
      this.updateProgress(meetingId, {
        status: 'saving',
        progress: 70,
        message: 'Saving to database...',
      });

      const processingTimeMs = Date.now() - startTime;

      // Save MoM
      const mom = await momRepository.upsert({
        meetingId,
        executiveSummary: momResponse.executiveSummary,
        detailedSummary: momResponse.detailedSummary,
        aiModelVersion: 'gpt-4o',
      });

      if (!mom) {
        throw new Error('Failed to create MoM record');
      }

      // Save highlights
      const highlightRecords = await this.saveHighlights(meetingId, mom.id, momResponse.highlights);

      // Save action items
      const itemRecords = await this.saveActionItems(meetingId, momResponse.items);

      // Step 4: Complete
      this.updateProgress(meetingId, {
        status: 'completed',
        progress: 100,
        message: 'MoM generation complete!',
      });

      return {
        success: true,
        momId: mom.id,
        highlightsCreated: highlightRecords.length,
        itemsCreated: itemRecords.length,
        processingTimeMs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.updateProgress(meetingId, {
        status: 'error',
        progress: 0,
        message: errorMessage,
      });

      return {
        success: false,
        momId: null,
        highlightsCreated: 0,
        itemsCreated: 0,
        processingTimeMs: Date.now() - startTime,
        error: errorMessage,
      };
    }
  }

  /**
   * Save highlights to database
   */
  private async saveHighlights(
    meetingId: string,
    momId: string,
    highlights: Highlight[]
  ): Promise<{ id: string }[]> {
    if (highlights.length === 0) return [];

    const records = highlights.map((h) => ({
      meetingId,
      momId,
      highlightType: h.highlightType,
      content: h.content,
      speaker: h.speaker,
      importance: h.importance,
      keywords: h.keywords,
    }));

    return await momRepository.addHighlights(records);
  }

  /**
   * Save action items to database
   */
  private async saveActionItems(meetingId: string, items: ActionItem[]): Promise<{ id: string }[]> {
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
   * Update generation progress
   */
  private updateProgress(meetingId: string, progress: GenerationProgress): void {
    progressMap.set(meetingId, progress);
  }

  /**
   * Get current generation progress
   */
  getProgress(meetingId: string): GenerationProgress | null {
    return progressMap.get(meetingId) ?? null;
  }

  /**
   * Clear progress tracking
   */
  clearProgress(meetingId: string): void {
    progressMap.delete(meetingId);
  }
}

// Singleton instance
export const momPipeline = new MoMPipeline();
