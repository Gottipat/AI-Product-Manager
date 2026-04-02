/**
 * @fileoverview OpenAI Service
 * @description Core wrapper for OpenAI API with rate limiting and structured outputs
 */

import OpenAI from 'openai';
import { z } from 'zod';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================================
// SCHEMAS - Structured output definitions
// ============================================================================

/** Schema for executive summary generation */
export const ExecutiveSummarySchema = z.object({
  summary: z.string().describe('2-3 sentence executive summary'),
  mainTopics: z.array(z.string()).describe('Main topics discussed'),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']),
  participantCount: z.number().optional(),
});

/** Schema for meeting highlights - matches highlightTypeEnum in enums.ts */
export const HighlightSchema = z.object({
  highlightType: z.enum(['executive_summary', 'key_point', 'notable_quote', 'outcome']),
  content: z.string(),
  speaker: z.string().optional(),
  importance: z.number().min(1).max(10),
  keywords: z.array(z.string()),
});

export const HighlightsResponseSchema = z.object({
  highlights: z.array(HighlightSchema),
});

/** Schema for action item extraction - matches meetingItemTypeEnum in enums.ts */
export const ActionItemSchema = z.object({
  itemType: z.enum([
    'action_item',
    'decision',
    'announcement',
    'project_update',
    'blocker',
    'idea',
    'question',
    'risk',
    'commitment',
    'deadline',
    'dependency',
    'parking_lot',
    'key_takeaway',
    'reference',
  ]),
  title: z.string().max(200),
  description: z.string().optional(),
  assignee: z.string().optional().describe('Name of person assigned'),
  assigneeEmail: z.string().email().optional(),
  dueDate: z.string().optional().describe('ISO date if mentioned'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  sourceQuote: z.string().optional().describe('Direct quote from transcript'),
});

export const ActionItemsResponseSchema = z.object({
  items: z.array(ActionItemSchema),
});

/** Full MoM generation response */
export const MoMResponseSchema = z.object({
  executiveSummary: z.string(),
  detailedSummary: z.string().optional(),
  mainTopics: z.array(z.string()),
  highlights: z.array(HighlightSchema),
  items: z.array(ActionItemSchema),
  nextMeetingTopics: z.array(z.string()).optional(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ExecutiveSummary = z.infer<typeof ExecutiveSummarySchema>;
export type Highlight = z.infer<typeof HighlightSchema>;
export type ActionItem = z.infer<typeof ActionItemSchema>;
export type MoMResponse = z.infer<typeof MoMResponseSchema>;

// ============================================================================
// OPENAI SERVICE CLASS
// ============================================================================

export class OpenAIService {
  private model: string;
  private embeddingModel: string;

  constructor(model: string = 'gpt-4o', embeddingModel: string = 'text-embedding-3-small') {
    this.model = model;
    this.embeddingModel = embeddingModel;
  }

  /**
   * Generate executive summary from transcript
   */
  async generateExecutiveSummary(transcript: string): Promise<ExecutiveSummary> {
    const response = await openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are an expert meeting analyst. Generate a concise executive summary from the meeting transcript. 
Focus on the key outcomes and decisions. Be professional and objective.

Return your response as JSON with this exact structure:
{
  "summary": "2-3 sentence executive summary",
  "mainTopics": ["topic1", "topic2"],
  "sentiment": "positive" | "neutral" | "negative" | "mixed",
  "participantCount": number (optional)
}`,
        },
        {
          role: 'user',
          content: `Analyze this meeting transcript and provide an executive summary:\n\n${transcript}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');

    return ExecutiveSummarySchema.parse(JSON.parse(content));
  }

  /**
   * Extract highlights from transcript
   */
  async extractHighlights(transcript: string): Promise<Highlight[]> {
    const response = await openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are an expert meeting analyst. Extract key highlights from the transcript.
Include: key points, notable quotes, outcomes, concerns, and opportunities.
Rate importance from 1-10. Extract relevant keywords for search.

Return your response as JSON with this exact structure:
{
  "highlights": [
    {
      "highlightType": "executive_summary" | "key_point" | "notable_quote" | "outcome",
      "content": "the highlight text",
      "speaker": "speaker name (optional)",
      "importance": 1-10,
      "keywords": ["keyword1", "keyword2"]
    }
  ]
}`,
        },
        {
          role: 'user',
          content: `Extract highlights from this meeting transcript:\n\n${transcript}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');

    const parsed = HighlightsResponseSchema.parse(JSON.parse(content));
    return parsed.highlights;
  }

  /**
   * Extract action items and other meeting items
   */
  async extractActionItems(transcript: string): Promise<ActionItem[]> {
    const response = await openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are an expert meeting analyst. Extract all actionable items from the transcript.
Look for: action items, decisions, blockers, risks, questions, concerns, next steps, 
follow-ups, dependencies, milestones, requirements, assumptions, constraints, and feedback.
Include assignees and due dates when mentioned. Extract the source quote if available.

Return your response as JSON with this exact structure:
{
  "items": [
    {
      "itemType": "action_item" | "decision" | "announcement" | "project_update" | "blocker" | "idea" | "question" | "risk" | "commitment" | "deadline" | "dependency" | "parking_lot" | "key_takeaway" | "reference",
      "title": "short title max 200 chars",
      "description": "detailed description (optional)",
      "assignee": "person name (optional)",
      "assigneeEmail": "email (optional)",
      "dueDate": "YYYY-MM-DD (optional)",
      "priority": "low" | "medium" | "high" | "critical",
      "sourceQuote": "direct quote (optional)"
    }
  ]
}`,
        },
        {
          role: 'user',
          content: `Extract all action items and meeting items from this transcript:\n\n${transcript}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');

    const parsed = ActionItemsResponseSchema.parse(JSON.parse(content));
    return parsed.items;
  }

  /**
   * Generate complete MoM from transcript
   */
  async generateMoM(transcript: string): Promise<MoMResponse> {
    const response = await openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are an expert meeting analyst creating comprehensive Minutes of Meeting (MoM).

Generate:
1. Executive summary (2-3 sentences)
2. Detailed summary (paragraph form, optional)
3. Main topics discussed
4. Highlights: key points, notable quotes, outcomes, concerns
5. Action items: with assignees, due dates, priorities
6. Suggested topics for next meeting

Be thorough but concise. Rate highlight importance 1-10.
Extract all actionable items including decisions, blockers, and risks. Return your response as JSON.`,
        },
        {
          role: 'user',
          content: `Generate complete Minutes of Meeting from this transcript:\n\n${transcript}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');

    return MoMResponseSchema.parse(JSON.parse(content));
  }

  /**
   * Generate embeddings for semantic search
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
      model: this.embeddingModel,
      input: text,
    });

    return response.data[0]?.embedding ?? [];
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const response = await openai.embeddings.create({
      model: this.embeddingModel,
      input: texts,
    });

    return response.data.map((d) => d.embedding);
  }

  /**
   * Estimate token count (rough approximation)
   */
  estimateTokens(text: string): number {
    // Rough estimate: ~4 chars per token for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if text fits within token limit
   */
  fitsInContext(text: string, maxTokens: number = 128000): boolean {
    return this.estimateTokens(text) < maxTokens;
  }
}

// Singleton instance
export const openaiService = new OpenAIService();
