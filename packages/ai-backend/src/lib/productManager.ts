/**
 * @fileoverview Product Manager context utilities
 * @description Deterministic helpers for project continuity, accountability alerts,
 *              and de-duplication before AI-generated MoM synthesis.
 */

import type { ActionItem } from '../services/openai.service.js';

export interface ContextualActionItem extends ActionItem {
  metadata?: Record<string, unknown>;
}

export interface ProjectContextItem {
  id: string;
  meetingId: string;
  itemType: ActionItem['itemType'];
  title: string;
  description?: string | null;
  assignee?: string | null;
  assigneeEmail?: string | null;
  dueDate?: string | null;
  status?: string | null;
  priority?: ActionItem['priority'] | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface RecentMeetingContext {
  id: string;
  title: string;
  startTime?: Date | null;
  executiveSummary?: string | null;
  mainHighlights?: string[];
}

export interface ProjectContextSnapshot {
  recentMeetingSummaries: string[];
  openItemsSummary: string[];
  accountabilityAlerts: ContextualActionItem[];
  contextSummary: string;
}

const STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'against',
  'align',
  'also',
  'been',
  'before',
  'being',
  'between',
  'build',
  'could',
  'deadline',
  'deliver',
  'deliverable',
  'during',
  'every',
  'follow',
  'from',
  'have',
  'into',
  'item',
  'items',
  'meeting',
  'needs',
  'next',
  'note',
  'open',
  'product',
  'project',
  'review',
  'should',
  'since',
  'some',
  'status',
  'sprint',
  'task',
  'team',
  'that',
  'there',
  'these',
  'they',
  'this',
  'update',
  'updates',
  'with',
]);

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractKeywords(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token));
}

function titleCaseItemType(type: ActionItem['itemType']): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function daysBetween(dateA: Date, dateB: Date): number {
  const a = Date.UTC(dateA.getUTCFullYear(), dateA.getUTCMonth(), dateA.getUTCDate());
  const b = Date.UTC(dateB.getUTCFullYear(), dateB.getUTCMonth(), dateB.getUTCDate());
  return Math.round((a - b) / 86400000);
}

function parseISODate(value?: string | null): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isItemReferencedInTranscript(
  item: Pick<ProjectContextItem, 'title' | 'description' | 'assignee'>,
  transcriptText: string
): boolean {
  const haystack = normalizeText(transcriptText);
  const exactTitle = normalizeText(item.title);

  if (exactTitle && haystack.includes(exactTitle)) {
    return true;
  }

  if (item.assignee) {
    const assignee = normalizeText(item.assignee);
    if (assignee && haystack.includes(assignee)) {
      return true;
    }
  }

  const keywordPool = [
    ...extractKeywords(item.title),
    ...extractKeywords(item.description ?? ''),
    ...extractKeywords(item.assignee ?? ''),
  ];

  const uniqueKeywords = Array.from(new Set(keywordPool));
  let hits = 0;

  for (const keyword of uniqueKeywords) {
    if (haystack.includes(keyword)) {
      hits += 1;
    }
  }

  return hits >= Math.min(2, uniqueKeywords.length);
}

function buildItemFingerprint(item: Pick<ContextualActionItem, 'itemType' | 'title'>): string {
  return `${item.itemType}:${normalizeText(item.title)}`;
}

export function dedupeContextualItems(items: ContextualActionItem[]): ContextualActionItem[] {
  const seen = new Set<string>();
  const deduped: ContextualActionItem[] = [];

  for (const item of items) {
    const fingerprint = buildItemFingerprint(item);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    deduped.push(item);
  }

  return deduped;
}

function summarizeProjectItem(item: ProjectContextItem): string {
  const parts = [titleCaseItemType(item.itemType), item.title];

  if (item.assignee) parts.push(`owner: ${item.assignee}`);
  if (item.status) parts.push(`status: ${item.status}`);
  if (item.dueDate) parts.push(`due: ${item.dueDate}`);

  return parts.join(' | ');
}

export function buildProjectContextSnapshot(args: {
  openItems: ProjectContextItem[];
  recentMeetings: RecentMeetingContext[];
  transcriptText: string;
  referenceDate?: Date;
}): ProjectContextSnapshot {
  const { openItems, recentMeetings, transcriptText, referenceDate = new Date() } = args;

  const recentMeetingSummaries = recentMeetings.map((meeting) => {
    const datePart = meeting.startTime ? meeting.startTime.toISOString().slice(0, 10) : 'unknown';
    const highlights =
      meeting.mainHighlights && meeting.mainHighlights.length > 0
        ? ` Highlights: ${meeting.mainHighlights.join('; ')}`
        : '';
    const summary = meeting.executiveSummary ? ` Summary: ${meeting.executiveSummary}` : '';

    return `${datePart} | ${meeting.title}.${summary}${highlights}`.trim();
  });

  const openItemsSummary = openItems.slice(0, 12).map(summarizeProjectItem);

  const accountabilityAlerts: ContextualActionItem[] = [];

  for (const item of openItems) {
    const dueDate = parseISODate(item.dueDate);
    const isReferenced = isItemReferencedInTranscript(item, transcriptText);
    const updatedAt = item.updatedAt ?? item.createdAt ?? referenceDate;
    const staleDays = daysBetween(referenceDate, updatedAt ?? referenceDate);

    if (dueDate) {
      const dueDeltaDays = daysBetween(referenceDate, dueDate);

      if (dueDeltaDays > 0 && !isReferenced) {
        accountabilityAlerts.push({
          itemType: 'risk',
          title: `Overdue follow-up without status update: ${item.title}`,
          description: `${item.assignee ?? 'Owner not recorded'} had a due date of ${
            item.dueDate
          }, but this meeting transcript does not contain a clear status update.`,
          assignee: item.assignee ?? undefined,
          assigneeEmail: item.assigneeEmail ?? undefined,
          dueDate: item.dueDate ?? undefined,
          priority: dueDeltaDays >= 7 ? 'critical' : 'high',
          context: `Carry-over accountability alert for prior ${item.itemType.replace(/_/g, ' ')}.`,
          aiConfidence: 1,
          metadata: {
            generatedBy: 'product_manager_context',
            alertType: 'overdue_without_status',
            sourceItemId: item.id,
            sourceMeetingId: item.meetingId,
          },
        });
        continue;
      }

      if (dueDeltaDays >= -3 && dueDeltaDays <= 0 && !isReferenced) {
        accountabilityAlerts.push({
          itemType: 'deadline',
          title: `Deadline approaching without status update: ${item.title}`,
          description: `${item.assignee ?? 'Owner not recorded'} has a due date of ${
            item.dueDate
          }, and this meeting did not confirm whether the work is on track.`,
          assignee: item.assignee ?? undefined,
          assigneeEmail: item.assigneeEmail ?? undefined,
          dueDate: item.dueDate ?? undefined,
          priority: 'high',
          context: 'Upcoming deadline needs explicit confirmation in the next check-in.',
          aiConfidence: 1,
          metadata: {
            generatedBy: 'product_manager_context',
            alertType: 'deadline_needs_status',
            sourceItemId: item.id,
            sourceMeetingId: item.meetingId,
          },
        });
      }
    }

    if (item.itemType === 'question' && !isReferenced) {
      accountabilityAlerts.push({
        itemType: 'question',
        title: `Open question still unresolved: ${item.title}`,
        description:
          item.description ??
          'This open question remains unresolved and was not clearly addressed in the current meeting.',
        assignee: item.assignee ?? undefined,
        assigneeEmail: item.assigneeEmail ?? undefined,
        priority: 'medium',
        context: 'Carry-over question from prior project context.',
        aiConfidence: 1,
        metadata: {
          generatedBy: 'product_manager_context',
          alertType: 'unresolved_question',
          sourceItemId: item.id,
          sourceMeetingId: item.meetingId,
        },
      });
    }

    if (
      staleDays >= 7 &&
      !isReferenced &&
      ['action_item', 'commitment', 'dependency'].includes(item.itemType)
    ) {
      accountabilityAlerts.push({
        itemType: 'risk',
        title: `Carry-over item missing fresh status: ${item.title}`,
        description: `${item.assignee ?? 'Owner not recorded'} has an open ${item.itemType.replace(
          /_/g,
          ' '
        )} that has not been updated for ${staleDays} days and was not clearly discussed in this meeting.`,
        assignee: item.assignee ?? undefined,
        assigneeEmail: item.assigneeEmail ?? undefined,
        dueDate: item.dueDate ?? undefined,
        priority: item.priority ?? 'medium',
        context: 'This is a deterministic accountability alert based on stale project context.',
        aiConfidence: 1,
        metadata: {
          generatedBy: 'product_manager_context',
          alertType: 'stale_item_without_status',
          sourceItemId: item.id,
          sourceMeetingId: item.meetingId,
          staleDays,
        },
      });
    }
  }

  const dedupedAlerts = dedupeContextualItems(accountabilityAlerts);

  const contextSummaryLines = [
    recentMeetingSummaries.length > 0
      ? `Recent meeting continuity:\n- ${recentMeetingSummaries.join('\n- ')}`
      : 'Recent meeting continuity:\n- No recent meeting history found.',
    openItemsSummary.length > 0
      ? `Open project items:\n- ${openItemsSummary.join('\n- ')}`
      : 'Open project items:\n- No prior open items found.',
    dedupedAlerts.length > 0
      ? `Accountability alerts:\n- ${dedupedAlerts
          .map((item) => `${item.title}${item.dueDate ? ` (due ${item.dueDate})` : ''}`)
          .join('\n- ')}`
      : 'Accountability alerts:\n- No deterministic alerts triggered.',
  ];

  return {
    recentMeetingSummaries,
    openItemsSummary,
    accountabilityAlerts: dedupedAlerts,
    contextSummary: contextSummaryLines.join('\n\n'),
  };
}
