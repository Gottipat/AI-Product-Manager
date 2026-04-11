/**
 * @fileoverview Product Manager context service
 * @description Retrieves historical project context and deterministic accountability
 *              alerts before AI-generated MoM synthesis.
 */

import { meetingRepository } from '../db/repositories/meeting.repository.js';
import { meetingItemsRepository } from '../db/repositories/meetingItems.repository.js';
import { momRepository } from '../db/repositories/mom.repository.js';
import {
  buildProjectContextSnapshot,
  readAccountabilityDetails,
  isSyntheticAccountabilityItem,
  type ProjectContextSnapshot,
  type ProjectContextItem,
  type RecentMeetingContext,
} from '../lib/productManager.js';

export class ProductManagerService {
  async buildProjectContext(args: {
    meetingId: string;
    projectId?: string | null;
    transcriptText: string;
    meetingStartTime?: Date | null;
  }): Promise<ProjectContextSnapshot> {
    const { meetingId, projectId, transcriptText, meetingStartTime } = args;

    if (!projectId) {
      return {
        openItems: [],
        recentMeetingSummaries: [],
        openItemsSummary: [],
        accountabilityAlerts: [],
        accountabilityOwners: [],
        readinessSignals: [],
        projectPriority: 'low',
        contextSummary:
          'Recent meeting continuity:\n- No project linked to this meeting.\n\nOpen project items:\n- No project linked to this meeting.\n\nAccountability alerts:\n- No deterministic alerts triggered.',
      };
    }

    const [recentMeetings, openItems] = await Promise.all([
      meetingRepository.findRecentByProject(projectId, 5, meetingId),
      meetingItemsRepository.findOpenByProjectId(projectId, { excludeMeetingId: meetingId }),
    ]);

    const recentMeetingContexts: RecentMeetingContext[] = [];

    for (const meeting of recentMeetings) {
      const mom = await momRepository.findByMeetingId(meeting.id);
      recentMeetingContexts.push({
        id: meeting.id,
        title: meeting.title,
        startTime: meeting.startTime,
        executiveSummary: mom?.executiveSummary ?? null,
        mainHighlights: (mom?.highlights ?? [])
          .sort((left, right) => (right.importance ?? 0) - (left.importance ?? 0))
          .slice(0, 3)
          .map((highlight) => highlight.content),
      });
    }

    const projectItems: ProjectContextItem[] = openItems
      .filter((item) => !isSyntheticAccountabilityItem(item.metadata))
      .map((item) => {
        const accountability = readAccountabilityDetails({
          assignee: item.assignee,
          metadata: item.metadata,
        });

        return {
          id: item.id,
          meetingId: item.meetingId,
          itemType: item.itemType,
          title: item.title,
          description: item.description,
          assignee: item.assignee,
          assigneeEmail: item.assigneeEmail,
          dueDate: item.dueDate,
          status: item.status,
          priority: item.priority,
          accountabilityType: accountability.accountabilityType,
          accountableTeam: accountability.accountableTeam ?? null,
          metadata:
            item.metadata && typeof item.metadata === 'object'
              ? (item.metadata as Record<string, unknown>)
              : null,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      });

    return buildProjectContextSnapshot({
      openItems: projectItems,
      recentMeetings: recentMeetingContexts,
      transcriptText,
      referenceDate: meetingStartTime ?? new Date(),
    });
  }
}

export const productManagerService = new ProductManagerService();
