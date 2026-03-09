/**
 * @fileoverview Minutes of Meeting (MoM) type definitions
 * @description Types for AI-generated meeting summaries and outputs
 */

import type { AttendanceRecord } from './meeting.js';

/**
 * A decision made during the meeting
 */
export interface Decision {
  /** Unique identifier */
  id: string;

  /** Description of the decision */
  description: string;

  /** Who made or announced the decision */
  decisionMaker?: string;

  /** Context or rationale for the decision */
  rationale?: string;

  /** ISO 8601 timestamp when this was discussed */
  timestamp: string;

  /** Related action items */
  relatedActionItemIds: string[];
}

/**
 * A topic discussed in the meeting
 */
export interface DiscussionTopic {
  /** Unique identifier */
  id: string;

  /** Topic title */
  title: string;

  /** Summary of the discussion */
  summary: string;

  /** Key points raised */
  keyPoints: string[];

  /** Participants who contributed to this topic */
  contributors: string[];

  /** Duration spent on this topic in minutes */
  durationMinutes: number;
}

/**
 * Complete Minutes of Meeting document
 */
export interface MinutesOfMeeting {
  /** Unique identifier */
  id: string;

  /** ID of the source meeting */
  meetingId: string;

  /** Meeting title */
  meetingTitle: string;

  /** Executive summary of the meeting */
  summary: string;

  /** Topics discussed */
  discussionTopics: DiscussionTopic[];

  /** Key decisions made */
  keyDecisions: Decision[];

  /** Action items assigned */
  actionItems: ActionItemSummary[];

  /** Attendance record */
  attendanceRecord: AttendanceRecord;

  /** ISO 8601 timestamp when MoM was generated */
  generatedAt: string;

  /** Version of the AI model used */
  aiModelVersion: string;

  /** Confidence score of the extraction (0-1) */
  overallConfidence: number;
}

/**
 * Summary view of an action item for MoM
 */
export interface ActionItemSummary {
  /** Unique identifier */
  id: string;

  /** Description of the action item */
  description: string;

  /** Person assigned to this action */
  assignee: string;

  /** Due date if specified */
  dueDate?: string;

  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'critical';
}
