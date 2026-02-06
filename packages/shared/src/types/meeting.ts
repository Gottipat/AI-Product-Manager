/**
 * @fileoverview Meeting-related type definitions
 * @description Types for meeting metadata and participant information
 */

/**
 * Meeting participant information
 */
export interface Participant {
    /** Unique identifier for the participant */
    id: string;

    /** Display name of the participant */
    displayName: string;

    /** Email address if available */
    email?: string;

    /** Time when participant joined */
    joinedAt: string;

    /** Time when participant left (null if still in meeting) */
    leftAt?: string;

    /** Whether this participant is the bot itself */
    isBot: boolean;
}

/**
 * Meeting attendance record
 */
export interface AttendanceRecord {
    /** Total number of unique participants */
    totalParticipants: number;

    /** List of participants with their attendance times */
    participants: Participant[];

    /** Meeting duration in minutes */
    durationMinutes: number;
}

/**
 * Meeting metadata
 */
export interface Meeting {
    /** Unique identifier for the meeting */
    id: string;

    /** Google Meet link */
    googleMeetLink: string;

    /** Meeting title/subject */
    title: string;

    /** ISO 8601 timestamp when meeting started */
    startTime: string;

    /** ISO 8601 timestamp when meeting ended (null if ongoing) */
    endTime?: string;

    /** List of participants */
    participants: Participant[];

    /** Whether this is part of a recurring series */
    isRecurring: boolean;

    /** ID of the recurring series if applicable */
    recurringSeriesId?: string;

    /** Current status of the meeting */
    status: MeetingStatus;

    /** Organization/team this meeting belongs to */
    organizationId?: string;
}

/**
 * Meeting status enum
 */
export type MeetingStatus =
    | 'scheduled'
    | 'bot-joining'
    | 'in-progress'
    | 'completed'
    | 'cancelled'
    | 'error';

/**
 * Recurring meeting series
 */
export interface RecurringSeries {
    /** Unique identifier for the series */
    id: string;

    /** Name/title of the recurring meeting */
    title: string;

    /** IDs of all meetings in this series */
    meetingIds: string[];

    /** Recurrence pattern (e.g., 'weekly', 'biweekly') */
    recurrencePattern: string;

    /** First meeting date */
    firstMeetingDate: string;

    /** Organization/team this series belongs to */
    organizationId?: string;
}
