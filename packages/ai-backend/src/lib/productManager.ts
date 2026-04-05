/**
 * @fileoverview Product Manager context utilities
 * @description Deterministic helpers for project continuity, accountability alerts,
 *              and de-duplication before AI-generated MoM synthesis.
 */

import type { ActionItem } from '../services/openai.service.js';

export interface ContextualActionItem extends ActionItem {
  metadata?: Record<string, unknown> | undefined;
}

export type AccountabilityOwnerType = 'individual' | 'team' | 'unknown';

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
  accountabilityType?: AccountabilityOwnerType | null;
  accountableTeam?: string | null;
  metadata?: Record<string, unknown> | null;
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
  openItems: ProjectContextItem[];
  recentMeetingSummaries: string[];
  openItemsSummary: string[];
  accountabilityAlerts: ContextualActionItem[];
  accountabilityOwners: AccountabilityOwnerSummary[];
  readinessSignals: string[];
  projectPriority: ActionItem['priority'];
  contextSummary: string;
}

export interface AccountabilityOwnerSummary {
  ownerLabel: string;
  ownerType: AccountabilityOwnerType;
  openItems: string[];
  overdueItems: string[];
  missingStatusItems: string[];
  activeRisks: string[];
}

export interface ProjectItemStatusUpdate {
  itemId: string;
  sourceMeetingId: string;
  newStatus: 'in_progress' | 'completed' | 'blocked';
  updateDescription: string;
  evidence: string[];
}

export interface ReconciledMeetingState {
  contextualItems: ContextualActionItem[];
  priorItemUpdates: ProjectItemStatusUpdate[];
  resolvedItemsSummary: string[];
  readinessSignals: string[];
  projectPriority: ActionItem['priority'];
}

type MeetingItemMetadata = Record<string, unknown> | null | undefined;

function statusStrength(status: ProjectItemStatusUpdate['newStatus']): number {
  switch (status) {
    case 'completed':
      return 3;
    case 'blocked':
      return 2;
    case 'in_progress':
      return 1;
    default:
      return 0;
  }
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

const STRONG_COMPLETION_CUES = [
  'done',
  'completed',
  'complete',
  'finished',
  'resolved',
  'approved',
  'merged',
  'validated',
  'closed',
  'stable',
  'covered',
  'answered',
  'shipped',
  'shipping',
  'sign off',
  'signoff',
  'ready',
];

const BLOCKED_CUES = [
  'blocked',
  'at risk',
  'not realistic',
  'not stable',
  'waiting',
  'slipped',
  'slip',
  'cannot',
  'can not',
  'delay',
  'delayed',
  'partially blocked',
  'blocker',
];

const OPEN_PROGRESS_CUES = [
  'still open',
  'unresolved',
  'pending',
  'not done',
  'not finished',
  'not complete',
  'not completed',
  'not closed',
  'not fully closed',
  'not closed yet',
  'not done yet',
  'still need',
  'still needs',
  'still not',
  'do not have the final answer',
  'don t have the final answer',
  'needs a final answer',
  'remains unresolved',
  'remains open',
];

const DECISION_CUES = [
  'decided',
  'decision made',
  'approved',
  'we are shipping',
  'will ship',
  'included in beta',
  'effectively answered',
  'answered',
  'go ahead with',
  'moving forward with',
  'ship it in beta',
  'shipping it in beta',
  'phase one is',
  'going public',
  'sign off',
  'signoff',
];

const TEAM_OWNER_HINTS = [
  'team',
  'support',
  'engineering',
  'eng',
  'design',
  'finance',
  'identity',
  'security',
  'compliance',
  'qa',
  'customer success',
  'marketing',
  'sales',
  'ops',
  'leadership',
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeOwnerLabel(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const normalized = trimmed.toLowerCase();
  if (
    ['unknown', 'n/a', 'none', 'unassigned', 'not specified', 'owner not recorded'].includes(
      normalized
    )
  ) {
    return undefined;
  }

  return trimmed;
}

export function normalizeAccountabilityType(value: unknown): AccountabilityOwnerType | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'individual' || normalized === 'team' || normalized === 'unknown') {
    return normalized;
  }

  return undefined;
}

export function inferAccountabilityType(
  ownerLabel?: string | null,
  explicitType?: unknown
): AccountabilityOwnerType {
  const normalizedExplicit = normalizeAccountabilityType(explicitType);
  if (normalizedExplicit) return normalizedExplicit;
  if (!ownerLabel) return 'unknown';

  const normalizedOwner = normalizeText(ownerLabel);
  if (TEAM_OWNER_HINTS.some((hint) => normalizedOwner.includes(normalizeText(hint)))) {
    return 'team';
  }

  return 'individual';
}

export function readAccountabilityDetails(args: { assignee?: string | null; metadata?: unknown }): {
  ownerLabel?: string;
  accountabilityType: AccountabilityOwnerType;
  accountableTeam?: string;
} {
  const metadata =
    args.metadata && typeof args.metadata === 'object'
      ? (args.metadata as Record<string, unknown>)
      : undefined;
  const accountability =
    metadata?.accountability && typeof metadata.accountability === 'object'
      ? (metadata.accountability as Record<string, unknown>)
      : undefined;

  const ownerLabel = sanitizeOwnerLabel(
    (typeof accountability?.ownerLabel === 'string' && accountability.ownerLabel) ||
      args.assignee ||
      (typeof accountability?.accountableTeam === 'string'
        ? accountability.accountableTeam
        : undefined)
  );
  const accountableTeam = sanitizeOwnerLabel(
    typeof accountability?.accountableTeam === 'string' ? accountability.accountableTeam : undefined
  );
  const accountabilityType = inferAccountabilityType(
    ownerLabel,
    accountability?.accountabilityType
  );

  return {
    ...(ownerLabel ? { ownerLabel } : {}),
    accountabilityType,
    ...(accountableTeam ? { accountableTeam } : {}),
  };
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

function priorityWeight(priority?: ActionItem['priority'] | null): number {
  switch (priority) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

function maxPriority(
  ...values: Array<ActionItem['priority'] | null | undefined>
): ActionItem['priority'] {
  return values.reduce<ActionItem['priority']>((current, value) => {
    return priorityWeight(value) > priorityWeight(current) ? (value ?? current) : current;
  }, 'low');
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function compatibilityBonus(left: ActionItem['itemType'], right: ActionItem['itemType']): number {
  if (left === right) return 0.2;

  const compatibleGroups: ActionItem['itemType'][][] = [
    ['action_item', 'commitment', 'deadline', 'project_update'],
    ['question', 'decision', 'project_update'],
    ['blocker', 'risk', 'dependency', 'project_update'],
  ];

  return compatibleGroups.some((group) => group.includes(left) && group.includes(right)) ? 0.12 : 0;
}

function splitTranscriptLines(transcriptText: string): string[] {
  return transcriptText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function findRelevantTranscriptLines(
  item: Pick<ProjectContextItem, 'title' | 'description' | 'assignee'>,
  transcriptText: string
): string[] {
  const lines = splitTranscriptLines(transcriptText);
  const normalizedTitle = normalizeText(item.title);
  const assignee = item.assignee ? normalizeText(item.assignee) : '';
  const keywords = uniqueStrings([
    ...extractKeywords(item.title),
    ...extractKeywords(item.description ?? ''),
    ...extractKeywords(item.assignee ?? ''),
  ]);

  return lines
    .filter((line) => {
      const normalizedLine = normalizeText(line);
      if (normalizedTitle && normalizedLine.includes(normalizedTitle)) return true;
      if (assignee && normalizedLine.includes(assignee) && keywords.length > 0) {
        return keywords.some((keyword) => normalizedLine.includes(keyword));
      }

      const hits = keywords.filter((keyword) => normalizedLine.includes(keyword)).length;
      return hits >= Math.min(2, keywords.length) && hits > 0;
    })
    .slice(0, 4);
}

function hasCue(text: string, cues: string[]): boolean {
  const normalized = normalizeText(text);
  return cues.some((cue) => normalized.includes(normalizeText(cue)));
}

function buildEvidenceText(evidenceLines: string[], relatedItems: ContextualActionItem[]): string {
  return [...evidenceLines, ...relatedItems.map((entry) => entry.title)]
    .concat(
      relatedItems
        .map((entry) =>
          [entry.description, entry.context, entry.sourceQuote].filter(Boolean).join(' ')
        )
        .filter(Boolean)
    )
    .join('\n');
}

function buildEvidenceSegments(
  evidenceLines: string[],
  relatedItems: ContextualActionItem[]
): string[] {
  return [
    ...evidenceLines,
    ...relatedItems.flatMap((entry) =>
      [entry.title, entry.description, entry.context, entry.sourceQuote]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim())
    ),
  ];
}

function keepsWorkOpen(itemType: ActionItem['itemType']): boolean {
  return [
    'action_item',
    'commitment',
    'deadline',
    'dependency',
    'question',
    'risk',
    'blocker',
  ].includes(itemType);
}

function hasDirectStatusSignal(
  item: ProjectContextItem,
  evidenceLines: string[],
  relatedItems: ContextualActionItem[] = []
): boolean {
  const evidenceText = buildEvidenceText(evidenceLines, relatedItems);

  if (!evidenceText) return false;
  if (hasCue(evidenceText, BLOCKED_CUES) || hasCue(evidenceText, OPEN_PROGRESS_CUES)) {
    return true;
  }

  if (item.itemType === 'question' && hasCue(evidenceText, DECISION_CUES)) {
    return true;
  }

  return hasCue(evidenceText, STRONG_COMPLETION_CUES);
}

function inferStatusFromEvidence(
  item: ProjectContextItem,
  evidenceLines: string[],
  relatedItems: ContextualActionItem[]
): ProjectItemStatusUpdate['newStatus'] | null {
  const evidenceText = buildEvidenceText(evidenceLines, relatedItems);
  const evidenceSegments = buildEvidenceSegments(evidenceLines, relatedItems);

  if (!evidenceText) return null;

  const hasBlockedCue = hasCue(evidenceText, BLOCKED_CUES);
  const hasOpenProgressCue = hasCue(evidenceText, OPEN_PROGRESS_CUES);
  const hasStrongCompletionCue =
    hasCue(evidenceText, STRONG_COMPLETION_CUES) && !hasOpenProgressCue && !hasBlockedCue;
  const hasDecisionCue = hasCue(evidenceText, DECISION_CUES);
  const relatedTypes = new Set(relatedItems.map((entry) => entry.itemType));

  if (hasBlockedCue) {
    return 'blocked';
  }

  if (item.itemType === 'question') {
    const hasExplicitQuestionResolution = evidenceSegments.some((segment) => {
      return hasCue(segment, DECISION_CUES) && !hasCue(segment, OPEN_PROGRESS_CUES);
    });

    if (
      hasExplicitQuestionResolution ||
      (!hasOpenProgressCue &&
        (hasDecisionCue ||
          ['decision', 'project_update', 'announcement', 'key_takeaway'].some((type) =>
            relatedTypes.has(type as ActionItem['itemType'])
          )))
    ) {
      return 'completed';
    }

    if (hasOpenProgressCue) {
      return 'in_progress';
    }
  }

  if (
    hasStrongCompletionCue &&
    !relatedItems.some((relatedItem) => keepsWorkOpen(relatedItem.itemType))
  ) {
    return 'completed';
  }

  if (hasOpenProgressCue) {
    return 'in_progress';
  }

  if (evidenceLines.length > 0 || relatedItems.length > 0) {
    return 'in_progress';
  }

  return null;
}

function inferRelationType(args: {
  priorItem: ProjectContextItem;
  currentItem: ContextualActionItem;
  inferredStatus: ProjectItemStatusUpdate['newStatus'] | null;
  evidenceLines: string[];
}): string {
  const { priorItem, currentItem, inferredStatus, evidenceLines } = args;
  const evidenceText = buildEvidenceText(evidenceLines, [currentItem]);
  const explicitlyResolvesPriorItem =
    hasCue(evidenceText, STRONG_COMPLETION_CUES) ||
    hasCue(evidenceText, DECISION_CUES) ||
    ['decision', 'project_update', 'announcement', 'key_takeaway'].includes(currentItem.itemType);

  if (inferredStatus === 'blocked') {
    return 'blocks_prior_item';
  }

  if (inferredStatus === 'completed') {
    return explicitlyResolvesPriorItem ? 'resolves_prior_item' : 'references_prior_item';
  }

  if (
    currentItem.itemType === priorItem.itemType ||
    keepsWorkOpen(currentItem.itemType) ||
    keepsWorkOpen(priorItem.itemType)
  ) {
    return 'carries_forward_prior_item';
  }

  return 'references_prior_item';
}

function scoreItemRelation(
  currentItem: ContextualActionItem,
  priorItem: ProjectContextItem
): number {
  const currentTitle = normalizeText(currentItem.title);
  const priorTitle = normalizeText(priorItem.title);

  if (
    currentTitle &&
    priorTitle &&
    (currentTitle.includes(priorTitle) || priorTitle.includes(currentTitle))
  ) {
    return 1;
  }

  const currentKeywords = new Set([
    ...extractKeywords(currentItem.title),
    ...extractKeywords(currentItem.description ?? ''),
    ...extractKeywords(currentItem.context ?? ''),
  ]);
  const priorKeywords = new Set([
    ...extractKeywords(priorItem.title),
    ...extractKeywords(priorItem.description ?? ''),
  ]);

  const sharedKeywords = Array.from(currentKeywords).filter((keyword) =>
    priorKeywords.has(keyword)
  );
  const baseScore =
    sharedKeywords.length /
    Math.max(1, Math.min(currentKeywords.size || 1, priorKeywords.size || 1));

  const assigneeBonus =
    currentItem.assignee &&
    priorItem.assignee &&
    normalizeText(currentItem.assignee) === normalizeText(priorItem.assignee)
      ? 0.15
      : 0;

  return baseScore + assigneeBonus + compatibilityBonus(currentItem.itemType, priorItem.itemType);
}

function findBestMatchingPriorItem(
  currentItem: ContextualActionItem,
  priorItems: ProjectContextItem[]
): ProjectContextItem | null {
  let bestMatch: ProjectContextItem | null = null;
  let bestScore = 0;

  for (const priorItem of priorItems) {
    const score = scoreItemRelation(currentItem, priorItem);
    if (score > bestScore) {
      bestMatch = priorItem;
      bestScore = score;
    }
  }

  return bestScore >= 0.45 ? bestMatch : null;
}

function mergeItemMetadata(
  left?: Record<string, unknown>,
  right?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!left && !right) return undefined;
  return {
    ...(left ?? {}),
    ...(right ?? {}),
  };
}

function mergeContextualItem(
  existing: ContextualActionItem,
  incoming: ContextualActionItem
): ContextualActionItem {
  const normalizedIncomingAssignee = sanitizeOwnerLabel(incoming.assignee);
  const normalizedExistingAssignee = sanitizeOwnerLabel(existing.assignee);

  return {
    ...existing,
    ...incoming,
    title: existing.title || incoming.title,
    description: incoming.description ?? existing.description,
    assignee: normalizedIncomingAssignee ?? normalizedExistingAssignee,
    assigneeEmail: incoming.assigneeEmail ?? existing.assigneeEmail,
    dueDate: incoming.dueDate ?? existing.dueDate,
    priority: maxPriority(existing.priority, incoming.priority),
    sourceQuote: incoming.sourceQuote ?? existing.sourceQuote,
    context: incoming.context ?? existing.context,
    aiConfidence:
      typeof existing.aiConfidence === 'number' || typeof incoming.aiConfidence === 'number'
        ? Math.max(existing.aiConfidence ?? 0, incoming.aiConfidence ?? 0)
        : undefined,
    sourceTranscriptRange: incoming.sourceTranscriptRange ?? existing.sourceTranscriptRange,
    metadata: mergeItemMetadata(existing.metadata, incoming.metadata),
  };
}

function readRelatedItemIds(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== 'object') return [];
  const value = metadata as Record<string, unknown>;

  return uniqueStrings(
    [value.relatedPriorItemId, value.sourceItemId]
      .map((entry) => (typeof entry === 'string' ? entry : ''))
      .filter(Boolean)
  );
}

function shouldCascadeCompletion(
  item: ProjectContextItem,
  resolvedSourceItem: ProjectContextItem | undefined
): boolean {
  if (!resolvedSourceItem) return false;

  const metadata =
    item.metadata && typeof item.metadata === 'object'
      ? (item.metadata as Record<string, unknown>)
      : undefined;

  if (
    typeof metadata?.generatedBy === 'string' &&
    metadata.generatedBy === 'product_manager_context'
  ) {
    return true;
  }

  if (item.itemType === resolvedSourceItem.itemType) {
    return true;
  }

  return item.itemType === 'question' && resolvedSourceItem.itemType === 'question';
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
  const deduped = new Map<string, ContextualActionItem>();

  for (const item of items) {
    const fingerprint = buildItemFingerprint(item);
    const existing = deduped.get(fingerprint);
    deduped.set(fingerprint, existing ? mergeContextualItem(existing, item) : item);
  }

  return Array.from(deduped.values());
}

export function isSyntheticAccountabilityItem(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;

  const value = metadata as MeetingItemMetadata;
  return (
    (typeof value?.generatedBy === 'string' && value.generatedBy === 'product_manager_context') ||
    typeof value?.alertType === 'string'
  );
}

function summarizeProjectItem(item: ProjectContextItem): string {
  const parts = [titleCaseItemType(item.itemType), item.title];

  if (item.assignee) {
    const ownerType = item.accountabilityType ?? inferAccountabilityType(item.assignee);
    parts.push(`owner (${ownerType}): ${item.assignee}`);
  }
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
  const accountabilityOwnersMap = new Map<string, AccountabilityOwnerSummary>();

  const ensureOwnerSummary = (
    ownerLabel: string,
    ownerType: AccountabilityOwnerType
  ): AccountabilityOwnerSummary => {
    const key = `${ownerType}:${normalizeText(ownerLabel)}`;
    const existing = accountabilityOwnersMap.get(key);
    if (existing) return existing;

    const created: AccountabilityOwnerSummary = {
      ownerLabel,
      ownerType,
      openItems: [],
      overdueItems: [],
      missingStatusItems: [],
      activeRisks: [],
    };
    accountabilityOwnersMap.set(key, created);
    return created;
  };

  for (const item of openItems) {
    const ownerLabel = item.assignee ?? item.accountableTeam ?? null;
    if (!ownerLabel) continue;

    const ownerType = item.accountabilityType ?? inferAccountabilityType(ownerLabel);
    const ownerSummary = ensureOwnerSummary(ownerLabel, ownerType);
    ownerSummary.openItems.push(`${titleCaseItemType(item.itemType)}: ${item.title}`);

    if (
      ['risk', 'blocker', 'dependency'].includes(item.itemType) ||
      priorityWeight(item.priority) >= priorityWeight('high')
    ) {
      ownerSummary.activeRisks.push(item.title);
    }
  }

  for (const alert of dedupedAlerts) {
    const ownerLabel = alert.assignee ?? undefined;
    if (!ownerLabel) continue;

    const ownerType = inferAccountabilityType(
      ownerLabel,
      alert.accountabilityType ??
        (alert.metadata &&
        typeof alert.metadata === 'object' &&
        alert.metadata.accountability &&
        typeof alert.metadata.accountability === 'object'
          ? (alert.metadata.accountability as Record<string, unknown>).accountabilityType
          : undefined)
    );
    const ownerSummary = ensureOwnerSummary(ownerLabel, ownerType);
    const alertType =
      alert.metadata &&
      typeof alert.metadata === 'object' &&
      typeof alert.metadata.alertType === 'string'
        ? alert.metadata.alertType
        : undefined;

    if (alertType === 'overdue_without_status') {
      ownerSummary.overdueItems.push(alert.title);
      ownerSummary.missingStatusItems.push(alert.title);
    } else if (alertType === 'deadline_needs_status' || alertType === 'stale_item_without_status') {
      ownerSummary.missingStatusItems.push(alert.title);
    } else {
      ownerSummary.activeRisks.push(alert.title);
    }
  }

  const accountabilityOwners = Array.from(accountabilityOwnersMap.values())
    .map((entry) => ({
      ...entry,
      openItems: uniqueStrings(entry.openItems).slice(0, 6),
      overdueItems: uniqueStrings(entry.overdueItems).slice(0, 4),
      missingStatusItems: uniqueStrings(entry.missingStatusItems).slice(0, 4),
      activeRisks: uniqueStrings(entry.activeRisks).slice(0, 4),
    }))
    .sort((left, right) => {
      const leftScore =
        left.overdueItems.length * 4 +
        left.missingStatusItems.length * 3 +
        left.activeRisks.length * 2 +
        left.openItems.length;
      const rightScore =
        right.overdueItems.length * 4 +
        right.missingStatusItems.length * 3 +
        right.activeRisks.length * 2 +
        right.openItems.length;
      return rightScore - leftScore;
    })
    .slice(0, 10);

  const readinessSignals = uniqueStrings(
    [
      ...openItems
        .filter(
          (item) =>
            item.itemType === 'blocker' ||
            item.itemType === 'dependency' ||
            item.itemType === 'risk' ||
            priorityWeight(item.priority) >= priorityWeight('high')
        )
        .slice(0, 6)
        .map((item) => `Open ${item.itemType.replace(/_/g, ' ')}: ${item.title}`),
      ...dedupedAlerts
        .filter((item) => priorityWeight(item.priority) >= priorityWeight('high'))
        .slice(0, 6)
        .map((item) => item.title),
    ].slice(0, 8)
  );

  const projectPriority = [
    ...openItems.map((item) => item.priority),
    ...dedupedAlerts.map((item) => item.priority),
  ].reduce<ActionItem['priority']>(
    (current, value) =>
      priorityWeight(value) > priorityWeight(current) ? (value ?? current) : current,
    'low'
  );

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
    accountabilityOwners.length > 0
      ? `Individual and team accountability:\n- ${accountabilityOwners
          .map((owner) => {
            const details = [
              owner.openItems.length > 0 ? `open: ${owner.openItems.join('; ')}` : '',
              owner.overdueItems.length > 0 ? `overdue: ${owner.overdueItems.join('; ')}` : '',
              owner.missingStatusItems.length > 0
                ? `missing status: ${owner.missingStatusItems.join('; ')}`
                : '',
              owner.activeRisks.length > 0 ? `risks: ${owner.activeRisks.join('; ')}` : '',
            ]
              .filter(Boolean)
              .join(' | ');
            return `${owner.ownerLabel} [${owner.ownerType}]${details ? ` -> ${details}` : ''}`;
          })
          .join('\n- ')}`
      : 'Individual and team accountability:\n- No owner-level accountability summary available.',
    readinessSignals.length > 0
      ? `Readiness signals:\n- ${readinessSignals.join('\n- ')}`
      : 'Readiness signals:\n- No active readiness blockers detected from deterministic checks.',
  ];

  return {
    openItems,
    recentMeetingSummaries,
    openItemsSummary,
    accountabilityAlerts: dedupedAlerts,
    accountabilityOwners,
    readinessSignals,
    projectPriority,
    contextSummary: contextSummaryLines.join('\n\n'),
  };
}

export function reconcileMeetingItems(args: {
  currentItems: ContextualActionItem[];
  openItems: ProjectContextItem[];
  transcriptText: string;
  referenceDate?: Date;
}): ReconciledMeetingState {
  const { currentItems, openItems, transcriptText, referenceDate = new Date() } = args;

  const priorItemUpdates = new Map<string, ProjectItemStatusUpdate>();
  const resolvedItemIds = new Set<string>();
  const matchedPriorItemIds = new Set<string>();
  const openItemsById = new Map(openItems.map((item) => [item.id, item] as const));
  const contextualItems = currentItems
    .map((item) => {
      const sourceItemId =
        typeof item.metadata?.sourceItemId === 'string' ? item.metadata.sourceItemId : null;
      const alertType =
        typeof item.metadata?.alertType === 'string' ? item.metadata.alertType : null;

      if (sourceItemId && resolvedItemIds.has(sourceItemId) && alertType) {
        return null;
      }

      const matchedPriorItem = findBestMatchingPriorItem(item, openItems);
      if (!matchedPriorItem) return item;
      matchedPriorItemIds.add(matchedPriorItem.id);

      const evidenceLines = findRelevantTranscriptLines(matchedPriorItem, transcriptText);
      const inferredStatus = inferStatusFromEvidence(matchedPriorItem, evidenceLines, [item]);
      const relationType = inferRelationType({
        priorItem: matchedPriorItem,
        currentItem: item,
        inferredStatus,
        evidenceLines,
      });

      if (inferredStatus) {
        const nextUpdate = {
          itemId: matchedPriorItem.id,
          sourceMeetingId: matchedPriorItem.meetingId,
          newStatus: inferredStatus,
          updateDescription:
            evidenceLines[0] ??
            `${titleCaseItemType(matchedPriorItem.itemType)} revisited in this meeting via ${item.itemType.replace(
              /_/g,
              ' '
            )}.`,
          evidence: evidenceLines,
        };
        const existingUpdate = priorItemUpdates.get(matchedPriorItem.id);

        if (
          !existingUpdate ||
          statusStrength(nextUpdate.newStatus) >= statusStrength(existingUpdate.newStatus)
        ) {
          priorItemUpdates.set(matchedPriorItem.id, nextUpdate);
        }

        if (inferredStatus === 'completed') {
          resolvedItemIds.add(matchedPriorItem.id);
        }
      }

      return mergeContextualItem(item, {
        ...item,
        priority: maxPriority(item.priority, matchedPriorItem.priority),
        metadata: {
          ...(item.metadata ?? {}),
          relationType,
          relatedPriorItemId: matchedPriorItem.id,
          relatedPriorMeetingId: matchedPriorItem.meetingId,
          relatedPriorItemType: matchedPriorItem.itemType,
          projectPrioritySignal: maxPriority(item.priority, matchedPriorItem.priority),
        },
      });
    })
    .filter((item): item is ContextualActionItem => item !== null);

  for (const priorItem of openItems) {
    if (matchedPriorItemIds.has(priorItem.id) || resolvedItemIds.has(priorItem.id)) {
      continue;
    }

    const evidenceLines = findRelevantTranscriptLines(priorItem, transcriptText);
    if (!hasDirectStatusSignal(priorItem, evidenceLines)) {
      continue;
    }

    const inferredStatus = inferStatusFromEvidence(priorItem, evidenceLines, []);
    if (!inferredStatus) {
      continue;
    }

    const nextUpdate = {
      itemId: priorItem.id,
      sourceMeetingId: priorItem.meetingId,
      newStatus: inferredStatus,
      updateDescription:
        evidenceLines[0] ??
        `${titleCaseItemType(priorItem.itemType)} revisited directly in this meeting transcript.`,
      evidence: evidenceLines,
    };
    const existingUpdate = priorItemUpdates.get(priorItem.id);

    if (
      !existingUpdate ||
      statusStrength(nextUpdate.newStatus) >= statusStrength(existingUpdate.newStatus)
    ) {
      priorItemUpdates.set(priorItem.id, nextUpdate);
    }

    if (inferredStatus === 'completed') {
      resolvedItemIds.add(priorItem.id);
    }
  }

  let cascadedResolution = true;
  while (cascadedResolution) {
    cascadedResolution = false;

    for (const openItem of openItems) {
      if (resolvedItemIds.has(openItem.id)) continue;

      const relatedResolvedSource = readRelatedItemIds(openItem.metadata).find((relatedId) =>
        resolvedItemIds.has(relatedId)
      );
      if (!relatedResolvedSource) continue;

      const resolvedSourceItem = openItemsById.get(relatedResolvedSource);
      if (!shouldCascadeCompletion(openItem, resolvedSourceItem)) continue;

      const nextUpdate = {
        itemId: openItem.id,
        sourceMeetingId: openItem.meetingId,
        newStatus: 'completed' as const,
        updateDescription: resolvedSourceItem
          ? `${titleCaseItemType(openItem.itemType)} closed because related prior ${resolvedSourceItem.itemType.replace(
              /_/g,
              ' '
            )} was resolved in this meeting.`
          : `${titleCaseItemType(openItem.itemType)} closed because its related prior item was resolved in this meeting.`,
        evidence: [],
      };
      const existingUpdate = priorItemUpdates.get(openItem.id);

      if (
        !existingUpdate ||
        statusStrength(nextUpdate.newStatus) >= statusStrength(existingUpdate.newStatus)
      ) {
        priorItemUpdates.set(openItem.id, nextUpdate);
      }

      resolvedItemIds.add(openItem.id);
      cascadedResolution = true;
    }
  }

  const unresolvedHighPriorityItems = openItems.filter((item) => {
    if (resolvedItemIds.has(item.id)) return false;
    if (priorityWeight(item.priority) >= priorityWeight('high')) return true;
    return ['blocker', 'dependency', 'risk', 'question'].includes(item.itemType);
  });

  const readinessSignals = uniqueStrings(
    [
      ...unresolvedHighPriorityItems.slice(0, 6).map((item) => {
        const dueDate = parseISODate(item.dueDate);
        const dueNote =
          dueDate && daysBetween(referenceDate, dueDate) >= 0 ? ` due ${item.dueDate}` : '';
        return `Open ${item.itemType.replace(/_/g, ' ')} remains active: ${item.title}${dueNote}`;
      }),
      ...Array.from(priorItemUpdates.values())
        .filter((update) => update.newStatus === 'blocked')
        .map((update) => `Blocked carry-over item needs escalation: ${update.updateDescription}`),
    ].slice(0, 8)
  );

  const resolvedItemsSummary = Array.from(priorItemUpdates.values())
    .filter((update) => update.newStatus === 'completed')
    .map((update) => {
      const item = openItems.find((entry) => entry.id === update.itemId);
      return item
        ? `Resolved carry-over ${item.itemType.replace(/_/g, ' ')}: ${item.title}`
        : `Resolved carry-over item: ${update.itemId}`;
    });

  const projectPriority = [
    ...contextualItems.map((item) => item.priority),
    ...readinessSignals.map(() => 'high' as const),
  ].reduce<ActionItem['priority']>(
    (current, value) =>
      priorityWeight(value) > priorityWeight(current) ? (value ?? current) : current,
    'low'
  );

  return {
    contextualItems: dedupeContextualItems(contextualItems),
    priorItemUpdates: Array.from(priorItemUpdates.values()),
    resolvedItemsSummary,
    readinessSignals,
    projectPriority,
  };
}
