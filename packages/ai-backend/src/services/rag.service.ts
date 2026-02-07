/**
 * @fileoverview RAG Service
 * @description Semantic search and context retrieval using embeddings
 */

import { eq } from 'drizzle-orm';

import { db } from '../db/index.js';
import {
  meetingEmbeddings,
  type MeetingEmbedding,
  type NewMeetingEmbedding,
} from '../db/schema/embeddings.js';

import { openaiService } from './openai.service.js';

// ============================================================================
// TYPES
// ============================================================================

export interface SearchResult {
  id: string;
  meetingId: string;
  contentType: string;
  content: string;
  similarity: number;
  metadata: MeetingEmbedding['metadata'];
}

export interface RAGContext {
  query: string;
  results: SearchResult[];
  totalTokens: number;
}

// ============================================================================
// RAG SERVICE CLASS
// ============================================================================

export class RAGService {
  /**
   * Index content for a meeting (create embeddings)
   */
  async indexContent(
    meetingId: string,
    contentType: string,
    content: string,
    metadata?: MeetingEmbedding['metadata']
  ): Promise<MeetingEmbedding> {
    // Generate embedding
    const embedding = await openaiService.generateEmbedding(content);

    // Store in database
    const result = await db
      .insert(meetingEmbeddings)
      .values({
        meetingId,
        contentType,
        content,
        embedding: JSON.stringify(embedding),
        metadata,
      })
      .returning();

    const record = result[0];
    if (!record) {
      throw new Error('Failed to create embedding record');
    }
    return record;
  }

  /**
   * Batch index multiple content pieces
   */
  async indexBatch(
    items: Array<{
      meetingId: string;
      contentType: string;
      content: string;
      metadata?: MeetingEmbedding['metadata'];
    }>
  ): Promise<MeetingEmbedding[]> {
    if (items.length === 0) return [];

    // Generate embeddings in batch
    const texts = items.map((i) => i.content);
    const embeddings = await openaiService.generateEmbeddings(texts);

    // Prepare records
    const records: NewMeetingEmbedding[] = items.map((item, idx) => ({
      meetingId: item.meetingId,
      contentType: item.contentType,
      content: item.content,
      embedding: JSON.stringify(embeddings[idx]),
      metadata: item.metadata,
    }));

    // Insert all
    return await db.insert(meetingEmbeddings).values(records).returning();
  }

  /**
   * Semantic search across all meetings
   * Note: This is a simplified version. With pgvector, we'd use vector similarity operators.
   */
  async search(
    query: string,
    options: {
      limit?: number | undefined;
      contentTypes?: string[] | undefined;
      meetingId?: string | undefined;
    } = {}
  ): Promise<SearchResult[]> {
    const { limit = 10, contentTypes, meetingId } = options;

    // Generate query embedding
    const queryEmbedding = await openaiService.generateEmbedding(query);

    // Fetch all embeddings (in production, use pgvector's <=> operator)
    let queryBuilder = db.select().from(meetingEmbeddings);

    if (meetingId) {
      queryBuilder = queryBuilder.where(
        eq(meetingEmbeddings.meetingId, meetingId)
      ) as typeof queryBuilder;
    }

    const records = await queryBuilder;

    // Calculate cosine similarity in memory (would be done by pgvector in production)
    const results: SearchResult[] = records
      .map((record) => {
        const recordEmbedding = JSON.parse(record.embedding || '[]') as number[];
        const similarity = this.cosineSimilarity(queryEmbedding, recordEmbedding);

        return {
          id: record.id,
          meetingId: record.meetingId,
          contentType: record.contentType,
          content: record.content,
          similarity,
          metadata: record.metadata,
        };
      })
      .filter((r) => {
        // Filter by content type if specified
        if (contentTypes && !contentTypes.includes(r.contentType)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return results;
  }

  /**
   * Get context for RAG (top K relevant documents)
   */
  async getContext(
    query: string,
    options: {
      maxTokens?: number | undefined;
      limit?: number | undefined;
      meetingId?: string | undefined;
    } = {}
  ): Promise<RAGContext> {
    const { maxTokens = 8000, limit = 5, meetingId } = options;

    const results = await this.search(query, { limit, meetingId });

    // Truncate results to fit within token budget
    let totalTokens = 0;
    const truncatedResults: SearchResult[] = [];

    for (const result of results) {
      const resultTokens = openaiService.estimateTokens(result.content);
      if (totalTokens + resultTokens > maxTokens) {
        break;
      }
      truncatedResults.push(result);
      totalTokens += resultTokens;
    }

    return {
      query,
      results: truncatedResults,
      totalTokens,
    };
  }

  /**
   * Delete all embeddings for a meeting
   */
  async deleteByMeeting(meetingId: string): Promise<void> {
    await db.delete(meetingEmbeddings).where(eq(meetingEmbeddings.meetingId, meetingId));
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i] ?? 0;
      const bVal = b[i] ?? 0;
      dotProduct += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }
}

// Singleton instance
export const ragService = new RAGService();
