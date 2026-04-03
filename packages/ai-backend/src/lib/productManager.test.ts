/**
 * @fileoverview Product Manager context utility tests
 */

import { describe, expect, it } from 'vitest';

import {
  buildProjectContextSnapshot,
  dedupeContextualItems,
  isItemReferencedInTranscript,
  reconcileMeetingItems,
} from './productManager.js';

describe('productManager utilities', () => {
  it('detects when an item is clearly referenced in the transcript', () => {
    expect(
      isItemReferencedInTranscript(
        {
          title: 'Finalize onboarding metrics dashboard',
          description: 'Need the dashboard ready for leadership review',
          assignee: 'Kumar',
        },
        'Kumar shared that the onboarding metrics dashboard is now ready for leadership review.'
      )
    ).toBe(true);
  });

  it('builds deterministic accountability alerts for overdue and unresolved work', () => {
    const snapshot = buildProjectContextSnapshot({
      transcriptText: 'The team discussed the new pricing experiment and release scope.',
      referenceDate: new Date('2026-04-03T00:00:00.000Z'),
      recentMeetings: [
        {
          id: 'm-1',
          title: 'Sprint Review',
          startTime: new Date('2026-03-27T00:00:00.000Z'),
          executiveSummary: 'Reviewed onboarding funnel issues.',
          mainHighlights: ['Dashboard follow-up stayed open'],
        },
      ],
      openItems: [
        {
          id: 'i-1',
          meetingId: 'm-1',
          itemType: 'action_item',
          title: 'Finalize onboarding metrics dashboard',
          assignee: 'Kumar',
          dueDate: '2026-04-01',
          status: 'pending',
          createdAt: new Date('2026-03-20T00:00:00.000Z'),
          updatedAt: new Date('2026-03-20T00:00:00.000Z'),
        },
        {
          id: 'i-2',
          meetingId: 'm-1',
          itemType: 'question',
          title: 'Should we ship guest checkout in phase one?',
          status: 'pending',
          createdAt: new Date('2026-03-21T00:00:00.000Z'),
          updatedAt: new Date('2026-03-21T00:00:00.000Z'),
        },
      ],
    });

    expect(snapshot.accountabilityAlerts.map((item) => item.title)).toContain(
      'Overdue follow-up without status update: Finalize onboarding metrics dashboard'
    );
    expect(snapshot.accountabilityAlerts.map((item) => item.title)).toContain(
      'Open question still unresolved: Should we ship guest checkout in phase one?'
    );
    expect(snapshot.contextSummary).toContain('Accountability alerts');
    expect(snapshot.projectPriority).toBe('high');
    expect(snapshot.readinessSignals.length).toBeGreaterThan(0);
  });

  it('deduplicates contextual items by type and title', () => {
    const deduped = dedupeContextualItems([
      { itemType: 'risk', title: 'Overdue follow-up without status update: Finalize API spec' },
      { itemType: 'risk', title: 'Overdue follow-up without status update: Finalize API spec' },
      { itemType: 'question', title: 'Open question still unresolved: API scope' },
    ]);

    expect(deduped).toHaveLength(2);
  });

  it('reconciles current items with prior context and resolves matched open questions', () => {
    const reconciliation = reconcileMeetingItems({
      transcriptText:
        'The original question on guest checkout is now effectively answered. We are shipping it in beta behind guardrails.',
      openItems: [
        {
          id: 'i-2',
          meetingId: 'm-1',
          itemType: 'question',
          title: 'Should we ship guest checkout in phase one?',
          status: 'pending',
          createdAt: new Date('2026-03-21T00:00:00.000Z'),
          updatedAt: new Date('2026-03-21T00:00:00.000Z'),
        },
      ],
      currentItems: [
        {
          itemType: 'decision',
          title: 'Guest checkout will ship in beta behind guardrails',
          description: 'The original question is now effectively answered.',
          priority: 'high',
        },
        {
          itemType: 'question',
          title: 'Open question still unresolved: Should we ship guest checkout in phase one?',
          metadata: {
            generatedBy: 'product_manager_context',
            alertType: 'unresolved_question',
            sourceItemId: 'i-2',
          },
        },
      ],
    });

    expect(reconciliation.priorItemUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemId: 'i-2',
          newStatus: 'completed',
        }),
      ])
    );
    expect(reconciliation.contextualItems).toHaveLength(1);
    expect(reconciliation.resolvedItemsSummary[0]).toContain('Resolved carry-over question');
  });
});
