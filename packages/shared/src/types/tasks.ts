/**
 * @fileoverview Task and progress tracking type definitions
 * @description Types for action items and longitudinal progress tracking
 */

/**
 * Progress update for an action item
 */
export interface ProgressUpdate {
    /** Unique identifier */
    id: string;

    /** ID of the action item this update belongs to */
    actionItemId: string;

    /** ID of the meeting where this update was discussed */
    meetingId: string;

    /** Description of the progress */
    description: string;

    /** New status after this update */
    status: ActionItemStatus;

    /** ISO 8601 timestamp of the update */
    timestamp: string;

    /** Who provided this update */
    updatedBy: string;

    /** Percentage complete (0-100) */
    percentComplete?: number;
}

/**
 * Status of an action item
 */
export type ActionItemStatus =
    | 'pending'
    | 'in-progress'
    | 'completed'
    | 'blocked'
    | 'deferred'
    | 'cancelled';

/**
 * Full action item with tracking history
 */
export interface ActionItem {
    /** Unique identifier */
    id: string;

    /** Description of the action item */
    description: string;

    /** Person assigned to this action */
    assignee: string;

    /** Due date if specified */
    dueDate?: string;

    /** Current status */
    status: ActionItemStatus;

    /** Priority level */
    priority: 'low' | 'medium' | 'high' | 'critical';

    /** ID of the meeting where this was created */
    sourceMeetingId: string;

    /** ID of the recurring series if applicable */
    recurringSeriesId?: string;

    /** All progress updates across meetings */
    progressHistory: ProgressUpdate[];

    /** ISO 8601 timestamp when created */
    createdAt: string;

    /** ISO 8601 timestamp when last updated */
    updatedAt: string;

    /** Tags for categorization */
    tags: string[];

    /** Dependencies on other action items */
    dependsOn: string[];

    /** Action items that depend on this one */
    blockedBy: string[];
}

/**
 * Aggregated progress report for longitudinal analysis
 */
export interface ProgressReport {
    /** ID of the recurring series */
    recurringSeriesId: string;

    /** Series title */
    seriesTitle: string;

    /** Date range of the report */
    dateRange: {
        start: string;
        end: string;
    };

    /** Number of meetings analyzed */
    meetingsAnalyzed: number;

    /** Summary statistics */
    statistics: {
        totalActionItems: number;
        completedItems: number;
        pendingItems: number;
        blockedItems: number;
        averageCompletionTimedays: number;
        onTimeCompletionRate: number;
    };

    /** Action items with their full history */
    actionItems: ActionItem[];

    /** Trends identified across meetings */
    trends: Trend[];

    /** Generated insights */
    insights: string[];
}

/**
 * A trend identified across meetings
 */
export interface Trend {
    /** Type of trend */
    type: 'improvement' | 'decline' | 'stable' | 'new-pattern';

    /** Area this trend relates to */
    area: string;

    /** Description of the trend */
    description: string;

    /** Confidence score (0-1) */
    confidence: number;
}
