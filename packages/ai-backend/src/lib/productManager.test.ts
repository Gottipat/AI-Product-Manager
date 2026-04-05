/**
 * @fileoverview Product Manager context utility tests
 */

import { describe, expect, it } from 'vitest';

import {
  buildProjectContextSnapshot,
  dedupeContextualItems,
  isItemReferencedInTranscript,
  isSyntheticAccountabilityItem,
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
    expect(snapshot.accountabilityOwners).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ownerLabel: 'Kumar',
          ownerType: 'individual',
        }),
      ])
    );
    expect(snapshot.contextSummary).toContain('Accountability alerts');
    expect(snapshot.contextSummary).toContain('Individual and team accountability');
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

  it('treats deterministic accountability alerts as synthetic project-memory items', () => {
    expect(
      isSyntheticAccountabilityItem({
        generatedBy: 'product_manager_context',
        alertType: 'unresolved_question',
      })
    ).toBe(true);

    expect(
      isSyntheticAccountabilityItem({
        generatedBy: 'mom_pipeline',
        relationType: 'carries_forward_prior_item',
      })
    ).toBe(false);
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
    expect(reconciliation.contextualItems[0]?.metadata?.relationType).toBe('resolves_prior_item');
  });

  it('keeps carry-over work open when the transcript says it is still unresolved', () => {
    const reconciliation = reconcileMeetingItems({
      transcriptText:
        'Kumar: Finance alignment is not done yet. I still need the final answer on pricing guardrails.',
      openItems: [
        {
          id: 'i-3',
          meetingId: 'm-2',
          itemType: 'action_item',
          title: 'Align with finance on pricing experiment guardrails',
          assignee: 'Kumar',
          status: 'pending',
          createdAt: new Date('2026-04-07T00:00:00.000Z'),
          updatedAt: new Date('2026-04-07T00:00:00.000Z'),
        },
      ],
      currentItems: [
        {
          itemType: 'action_item',
          title: 'Align with finance on pricing experiment guardrails',
          description: 'Still unresolved and needs a final answer.',
          assignee: 'Kumar',
          priority: 'high',
        },
      ],
    });

    expect(reconciliation.priorItemUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemId: 'i-3',
          newStatus: 'in_progress',
        }),
      ])
    );
    expect(reconciliation.contextualItems[0]?.metadata?.relationType).toBe(
      'carries_forward_prior_item'
    );
  });

  it('resolves prior questions directly from transcript evidence even without a matched current item', () => {
    const reconciliation = reconcileMeetingItems({
      transcriptText:
        'Arjun: Also, the original question on whether guest checkout is phase one is now effectively answered. We are shipping it in beta, but behind guardrails.',
      openItems: [
        {
          id: 'i-4',
          meetingId: 'm-3',
          itemType: 'question',
          title: 'Decision on guest checkout inclusion in phase one',
          status: 'pending',
          createdAt: new Date('2026-04-14T00:00:00.000Z'),
          updatedAt: new Date('2026-04-14T00:00:00.000Z'),
        },
      ],
      currentItems: [
        {
          itemType: 'risk',
          title: 'Duplicate account issue remains a beta blocker',
          priority: 'high',
        },
      ],
    });

    expect(reconciliation.priorItemUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemId: 'i-4',
          newStatus: 'completed',
        }),
      ])
    );
    expect(reconciliation.resolvedItemsSummary[0]).toContain('Resolved carry-over question');
  });

  it('cascades question resolution to related carry-forward question items', () => {
    const reconciliation = reconcileMeetingItems({
      transcriptText:
        'Arjun: Also, the original question on whether guest checkout is phase one is now effectively answered. We are shipping it in beta, but behind guardrails.',
      openItems: [
        {
          id: 'q-1',
          meetingId: 'm-1',
          itemType: 'question',
          title: 'Decision on guest checkout inclusion in phase one',
          status: 'pending',
          createdAt: new Date('2026-04-07T00:00:00.000Z'),
          updatedAt: new Date('2026-04-07T00:00:00.000Z'),
        },
        {
          id: 'q-2',
          meetingId: 'm-2',
          itemType: 'question',
          title: 'Guest checkout phase inclusion',
          status: 'pending',
          metadata: {
            relatedPriorItemId: 'q-1',
          },
          createdAt: new Date('2026-04-14T00:00:00.000Z'),
          updatedAt: new Date('2026-04-14T00:00:00.000Z'),
        },
      ],
      currentItems: [
        {
          itemType: 'decision',
          title: 'Guest checkout included in beta',
          description: 'The original question is now effectively answered.',
          priority: 'high',
        },
      ],
    });

    expect(reconciliation.priorItemUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ itemId: 'q-1', newStatus: 'completed' }),
        expect.objectContaining({ itemId: 'q-2', newStatus: 'completed' }),
      ])
    );
  });

  it('prefers explicit decision evidence over unrelated open cues when resolving carry-forward questions', () => {
    const reconciliation = reconcileMeetingItems({
      transcriptText: `Rahul: Compliance review is still open. Specifically, I need an answer on guest email retention.
Maya: We also need a support training session before launch if guest checkout goes public.
Arjun: Also, the original question on whether guest checkout is phase one is now effectively answered. We are shipping it in beta, but behind guardrails.`,
      openItems: [
        {
          id: 'q-1',
          meetingId: 'm-1',
          itemType: 'question',
          title: 'Determine if guest checkout should be in phase one',
          description:
            'A decision is needed on whether guest checkout should ship in phase one or stay behind a flag until after beta feedback.',
          status: 'in_progress',
          createdAt: new Date('2026-04-07T00:00:00.000Z'),
          updatedAt: new Date('2026-04-14T00:00:00.000Z'),
        },
        {
          id: 'q-2',
          meetingId: 'm-2',
          itemType: 'question',
          title: 'Determine if guest checkout is in phase one',
          description:
            'Support needs to know if guest checkout is included in phase one for macros and escalation paths.',
          assignee: 'Support team',
          status: 'in_progress',
          metadata: {
            relatedPriorItemId: 'q-1',
          },
          createdAt: new Date('2026-04-14T00:00:00.000Z'),
          updatedAt: new Date('2026-04-14T00:00:00.000Z'),
        },
      ],
      currentItems: [
        {
          itemType: 'decision',
          title: 'Guest checkout included in beta behind guardrails',
          description:
            'The decision was made to include guest checkout in the beta release, but it will be behind guardrails.',
          assignee: 'Arjun',
          priority: 'high',
        },
      ],
    });

    expect(reconciliation.priorItemUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ itemId: 'q-1', newStatus: 'completed' }),
        expect.objectContaining({ itemId: 'q-2', newStatus: 'completed' }),
      ])
    );
    expect(reconciliation.contextualItems[0]?.metadata?.relationType).toBe('resolves_prior_item');
  });
});
