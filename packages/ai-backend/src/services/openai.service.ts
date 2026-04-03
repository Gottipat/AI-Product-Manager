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

export const SourceTranscriptRangeSchema = z.object({
  startSeq: z.number().int().positive(),
  endSeq: z.number().int().positive(),
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
  context: z.string().optional().describe('Relevant surrounding context for the item'),
  aiConfidence: z.number().min(0).max(1).optional(),
  sourceTranscriptRange: SourceTranscriptRangeSchema.optional(),
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
  overallConfidence: z.number().min(0).max(1).optional(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ExecutiveSummary = z.infer<typeof ExecutiveSummarySchema>;
export type Highlight = z.infer<typeof HighlightSchema>;
export type ActionItem = z.infer<typeof ActionItemSchema>;
export type MoMResponse = z.infer<typeof MoMResponseSchema>;

export interface MeetingAnalysisContext {
  meetingId?: string | undefined;
  title?: string | undefined;
  description?: string | null | undefined;
  projectName?: string | undefined;
  projectDescription?: string | null | undefined;
  organizationName?: string | undefined;
  meetingType?: string | null | undefined;
  status?: string | null | undefined;
  captureSource?: string | null | undefined;
  analysisMode?: 'general' | 'product_manager' | undefined;
  startTime?: string | null | undefined;
  endTime?: string | null | undefined;
  durationMinutes?: number | null | undefined;
  participants?:
    | Array<{
        displayName: string;
        email?: string | null | undefined;
        isBot?: boolean | undefined;
      }>
    | undefined;
  transcript?:
    | {
        eventCount: number;
        speakers: string[];
        firstCapturedAt?: string | undefined;
        lastCapturedAt?: string | undefined;
      }
    | undefined;
  recentMeetingSummaries?: string[] | undefined;
  openItemsSummary?: string[] | undefined;
  accountabilityAlerts?: string[] | undefined;
  resolvedItemsSummary?: string[] | undefined;
  readinessSignals?: string[] | undefined;
  projectPriority?: 'low' | 'medium' | 'high' | 'critical' | undefined;
  projectContextSummary?: string | undefined;
}

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

  private buildContextBlock(context?: MeetingAnalysisContext): string {
    if (!context) return 'No additional meeting context provided.';

    const participants = (context.participants ?? [])
      .filter((participant) => !participant.isBot)
      .map((participant) =>
        participant.email
          ? `${participant.displayName} <${participant.email}>`
          : participant.displayName
      );

    return [
      `Meeting ID: ${context.meetingId ?? 'unknown'}`,
      `Title: ${context.title ?? 'unknown'}`,
      `Description: ${context.description ?? 'n/a'}`,
      `Project: ${context.projectName ?? 'n/a'}`,
      `Project Description: ${context.projectDescription ?? 'n/a'}`,
      `Organization: ${context.organizationName ?? 'n/a'}`,
      `Meeting Type: ${context.meetingType ?? 'n/a'}`,
      `Status: ${context.status ?? 'n/a'}`,
      `Capture Source: ${context.captureSource ?? 'n/a'}`,
      `Analysis Mode: ${context.analysisMode ?? 'general'}`,
      `Start Time: ${context.startTime ?? 'n/a'}`,
      `End Time: ${context.endTime ?? 'n/a'}`,
      `Duration Minutes: ${context.durationMinutes ?? 'n/a'}`,
      `Participants: ${participants.length > 0 ? participants.join(', ') : 'n/a'}`,
      `Transcript Event Count: ${context.transcript?.eventCount ?? 0}`,
      `Transcript Speakers: ${
        context.transcript?.speakers?.length ? context.transcript.speakers.join(', ') : 'n/a'
      }`,
      `Transcript First Event: ${context.transcript?.firstCapturedAt ?? 'n/a'}`,
      `Transcript Last Event: ${context.transcript?.lastCapturedAt ?? 'n/a'}`,
      `Recent Project Meetings: ${
        context.recentMeetingSummaries?.length
          ? `\n- ${context.recentMeetingSummaries.join('\n- ')}`
          : 'n/a'
      }`,
      `Open Project Items: ${
        context.openItemsSummary?.length ? `\n- ${context.openItemsSummary.join('\n- ')}` : 'n/a'
      }`,
      `Accountability Alerts: ${
        context.accountabilityAlerts?.length
          ? `\n- ${context.accountabilityAlerts.join('\n- ')}`
          : 'n/a'
      }`,
      `Resolved Carry-Over Items: ${
        context.resolvedItemsSummary?.length
          ? `\n- ${context.resolvedItemsSummary.join('\n- ')}`
          : 'n/a'
      }`,
      `Readiness Signals: ${
        context.readinessSignals?.length ? `\n- ${context.readinessSignals.join('\n- ')}` : 'n/a'
      }`,
      `Project Priority Signal: ${context.projectPriority ?? 'n/a'}`,
      `Project Context Summary:\n${context.projectContextSummary ?? 'n/a'}`,
    ].join('\n');
  }

  private asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object' && 'title' in item && typeof item.title === 'string') {
          return item.title.trim();
        }
        return '';
      })
      .filter((item) => item.length > 0);
  }

  private stringifyDetailedSummary(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return undefined;

    const sections = Object.entries(value as Record<string, unknown>)
      .map(([key, sectionValue]) => {
        const heading = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/[_-]/g, ' ')
          .trim()
          .replace(/\b\w/g, (char) => char.toUpperCase());

        if (typeof sectionValue === 'string') {
          return `## ${heading}\n${sectionValue.trim()}`;
        }

        if (Array.isArray(sectionValue)) {
          const lines = sectionValue
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter(Boolean)
            .map((item) => `- ${item}`)
            .join('\n');

          return lines ? `## ${heading}\n${lines}` : '';
        }

        if (sectionValue && typeof sectionValue === 'object') {
          const lines = Object.entries(sectionValue)
            .map(([subKey, subValue]) => {
              if (typeof subValue !== 'string') return '';
              const label = subKey
                .replace(/([A-Z])/g, ' $1')
                .replace(/[_-]/g, ' ')
                .trim()
                .replace(/\b\w/g, (char) => char.toUpperCase());
              return `- ${label}: ${subValue.trim()}`;
            })
            .filter(Boolean)
            .join('\n');

          return lines ? `## ${heading}\n${lines}` : '';
        }

        return '';
      })
      .filter(Boolean);

    return sections.length > 0 ? sections.join('\n\n') : undefined;
  }

  private normalizeHighlight(raw: unknown): unknown {
    if (!raw || typeof raw !== 'object') return raw;
    const value = raw as Record<string, unknown>;

    const highlightType =
      typeof value.highlightType === 'string'
        ? value.highlightType
        : typeof value.type === 'string'
          ? value.type
          : typeof value.category === 'string'
            ? value.category
            : 'key_point';

    const content =
      typeof value.content === 'string'
        ? value.content
        : typeof value.text === 'string'
          ? value.text
          : typeof value.summary === 'string'
            ? value.summary
            : '';

    return {
      highlightType,
      content,
      speaker: typeof value.speaker === 'string' ? value.speaker : undefined,
      importance:
        typeof value.importance === 'number'
          ? value.importance
          : typeof value.priority === 'number'
            ? value.priority
            : 5,
      keywords: this.asStringArray(value.keywords ?? value.tags ?? value.topics),
    };
  }

  private normalizeActionItem(raw: unknown): unknown {
    if (!raw || typeof raw !== 'object') return raw;
    const value = raw as Record<string, unknown>;
    const normalizedPriority =
      typeof value.priority === 'string'
        ? value.priority.trim().toLowerCase()
        : typeof value.severity === 'string'
          ? value.severity.trim().toLowerCase()
          : undefined;

    const rawDueDate =
      typeof value.dueDate === 'string'
        ? value.dueDate
        : typeof value.targetDate === 'string'
          ? value.targetDate
          : undefined;

    return {
      itemType:
        typeof value.itemType === 'string'
          ? value.itemType
          : typeof value.type === 'string'
            ? value.type
            : 'action_item',
      title:
        typeof value.title === 'string'
          ? value.title
          : typeof value.action === 'string'
            ? value.action
            : typeof value.name === 'string'
              ? value.name
              : 'Untitled follow-up',
      description:
        typeof value.description === 'string'
          ? value.description
          : typeof value.details === 'string'
            ? value.details
            : typeof value.context === 'string'
              ? value.context
              : undefined,
      assignee:
        typeof value.assignee === 'string'
          ? value.assignee
          : typeof value.owner === 'string'
            ? value.owner
            : undefined,
      assigneeEmail:
        typeof value.assigneeEmail === 'string'
          ? value.assigneeEmail
          : typeof value.ownerEmail === 'string'
            ? value.ownerEmail
            : undefined,
      dueDate: this.normalizeDueDate(rawDueDate),
      priority:
        normalizedPriority === 'critical' ||
        normalizedPriority === 'high' ||
        normalizedPriority === 'medium' ||
        normalizedPriority === 'low'
          ? normalizedPriority
          : undefined,
      sourceQuote:
        typeof value.sourceQuote === 'string'
          ? value.sourceQuote
          : typeof value.quote === 'string'
            ? value.quote
            : undefined,
      context: typeof value.context === 'string' ? value.context : undefined,
      aiConfidence: typeof value.aiConfidence === 'number' ? value.aiConfidence : undefined,
      sourceTranscriptRange:
        value.sourceTranscriptRange &&
        typeof value.sourceTranscriptRange === 'object' &&
        typeof (value.sourceTranscriptRange as Record<string, unknown>).startSeq === 'number' &&
        typeof (value.sourceTranscriptRange as Record<string, unknown>).endSeq === 'number'
          ? value.sourceTranscriptRange
          : undefined,
    };
  }

  private normalizeDueDate(value: string | undefined): string | undefined {
    if (!value) return undefined;

    const trimmed = value.trim();

    // Persist only true ISO calendar dates; relative phrases belong in context, not a DATE column.
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    return undefined;
  }

  private normalizeMoMResponse(raw: unknown): MoMResponse {
    const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

    const normalized = {
      executiveSummary:
        typeof value.executiveSummary === 'string'
          ? value.executiveSummary
          : typeof value.summary === 'string'
            ? value.summary
            : typeof value.overview === 'string'
              ? value.overview
              : 'Meeting analyzed successfully.',
      detailedSummary: this.stringifyDetailedSummary(
        value.detailedSummary ?? value.detailedMinutes ?? value.minutes ?? value.sections
      ),
      mainTopics: this.asStringArray(value.mainTopics ?? value.topics ?? value.keyThemes),
      highlights: Array.isArray(value.highlights)
        ? value.highlights.map((item) => this.normalizeHighlight(item))
        : Array.isArray(value.keyHighlights)
          ? value.keyHighlights.map((item) => this.normalizeHighlight(item))
          : [],
      items: Array.isArray(value.items)
        ? value.items.map((item) => this.normalizeActionItem(item))
        : Array.isArray(value.actionItems)
          ? value.actionItems.map((item) => this.normalizeActionItem(item))
          : [],
      nextMeetingTopics: this.asStringArray(
        value.nextMeetingTopics ?? value.followUps ?? value.nextStepsTopics
      ),
      overallConfidence:
        typeof value.overallConfidence === 'number' ? value.overallConfidence : undefined,
    };

    return MoMResponseSchema.parse(normalized);
  }

  private applyReadinessGuard(
    response: MoMResponse,
    context?: MeetingAnalysisContext
  ): MoMResponse {
    const readinessSignals = context?.readinessSignals ?? [];
    if (readinessSignals.length === 0) return response;

    const hasActiveBlocker = readinessSignals.some((signal) =>
      /\bopen\b|\bblocked\b|\brisk\b|\bpending\b|\boverdue\b|\bactive\b/i.test(signal)
    );
    if (!hasActiveBlocker) return response;

    const optimisticReadinessPattern =
      /\bready\b|\breadiness confirmed\b|\bcleared for launch\b|\bon track\b|\bconfirmed\b/i;

    if (
      optimisticReadinessPattern.test(response.executiveSummary) &&
      !/conditional|blocked|risk|pending|open/i.test(response.executiveSummary)
    ) {
      const blockerSummary = readinessSignals.slice(0, 2).join('; ');
      response.executiveSummary = `${response.executiveSummary} Readiness remains conditional because ${blockerSummary}.`;
    }

    return response;
  }

  /**
   * Generate executive summary from transcript
   */
  async generateExecutiveSummary(
    transcript: string,
    context?: MeetingAnalysisContext
  ): Promise<ExecutiveSummary> {
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
          content: `Meeting context:
${this.buildContextBlock(context)}

Analyze this meeting transcript and provide an executive summary:

${transcript}`,
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
  async extractHighlights(
    transcript: string,
    context?: MeetingAnalysisContext
  ): Promise<Highlight[]> {
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
          content: `Meeting context:
${this.buildContextBlock(context)}

Extract highlights from this meeting transcript:

${transcript}`,
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
  async extractActionItems(
    transcript: string,
    context?: MeetingAnalysisContext
  ): Promise<ActionItem[]> {
    const response = await openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are an expert meeting analyst. Extract all actionable items from the transcript.
Look for: action items, decisions, blockers, risks, questions, concerns, next steps, 
follow-ups, dependencies, milestones, requirements, assumptions, constraints, and feedback.
Include assignees and due dates when mentioned. Extract the source quote if available.
Use the meeting context to disambiguate people, teams, and timing, but do not invent facts.
Each item should include:
- a concise title
- optional context
- aiConfidence from 0 to 1
- sourceTranscriptRange using the transcript seq numbers when possible

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
      "sourceQuote": "direct quote (optional)",
      "context": "surrounding context (optional)",
      "aiConfidence": 0.0,
      "sourceTranscriptRange": { "startSeq": 1, "endSeq": 2 }
    }
  ]
}`,
        },
        {
          role: 'user',
          content: `Meeting context:
${this.buildContextBlock(context)}

Extract all action items and meeting items from this transcript:

${transcript}`,
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
  async generateMoM(transcript: string, context?: MeetingAnalysisContext): Promise<MoMResponse> {
    return this.generateMoMWithSeedItems(transcript, context);
  }

  async generateMoMWithSeedItems(
    transcript: string,
    context?: MeetingAnalysisContext,
    seedItems: ActionItem[] = []
  ): Promise<MoMResponse> {
    const seedItemsBlock =
      seedItems.length > 0
        ? JSON.stringify(
            seedItems.map((item) => ({
              itemType: item.itemType,
              title: item.title,
              description: item.description,
              assignee: item.assignee,
              dueDate: item.dueDate,
              priority: item.priority,
              context: item.context,
            })),
            null,
            2
          )
        : '[]';

    const response = await openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are a senior enterprise product manager creating comprehensive Minutes of Meeting (MoM).
Write with the judgment, clarity, and prioritization discipline expected in a high-end PM organization.

Generate:
1. Executive summary: 2-3 sentences focused on business/product outcome, not generic recap
2. Detailed summary: structured markdown with short sections for:
   - Objective / context
   - Decisions made
   - Product implications
   - Delivery risks / blockers
   - Open questions
   - Next steps
3. Main topics discussed
4. Highlights: key points, notable quotes, outcomes, concerns
5. Action items: with assignees, due dates, priorities
6. Suggested topics for next meeting

Rules:
- Behave like a PM synthesizing context for leadership and the delivery team.
- Tie discussion points back to user impact, business goals, scope, timeline, dependencies, and tradeoffs when supported by the transcript.
- Distinguish clearly between decisions, proposals, concerns, unresolved questions, and follow-ups.
- Treat historical project context and accountability alerts as first-class inputs, not side notes.
- Treat resolved carry-over items as closed unless the transcript re-opens them.
- Explicitly call out overdue tasks, stale commitments, unresolved questions, and missing status updates when supported by the provided context.
- Do not claim launch, beta, or delivery readiness is confirmed if the provided readiness signals still show open blockers, pending fixes, unresolved risks, or missing sign-off.
- Do not invent product strategy, owners, dates, or rationale that are not grounded in the meeting context.
- Prefer crisp, enterprise-ready language over conversational filler.
- When information is ambiguous, capture the ambiguity explicitly as a risk or open question.
- Rate highlight importance 1-10.
- For extracted items, include aiConfidence and sourceTranscriptRange whenever possible.
- Use the provided candidate items as a starting point, refine them where needed, and avoid duplicating the same follow-up in multiple forms.

Return your response as JSON.`,
        },
        {
          role: 'user',
          content: `Meeting context:
${this.buildContextBlock(context)}

Candidate accountability and extraction items:
${seedItemsBlock}

Generate complete Minutes of Meeting from this transcript:

${transcript}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');

    return this.applyReadinessGuard(this.normalizeMoMResponse(JSON.parse(content)), context);
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
