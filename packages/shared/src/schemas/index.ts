/**
 * @fileoverview Zod schemas for runtime validation
 * @description Validation schemas that mirror TypeScript types for runtime safety
 */

import { z } from 'zod';

// ============================================
// Transcript Schemas
// ============================================

export const TranscriptEventSchema = z.object({
    id: z.string().uuid(),
    meetingId: z.string().uuid(),
    speaker: z.string().min(1),
    speakerId: z.string().optional(),
    text: z.string(),
    timestamp: z.string().datetime(),
    confidence: z.number().min(0).max(1).optional(),
    sequenceNumber: z.number().int().nonnegative(),
    isFinal: z.boolean(),
});

export const TranscriptBatchSchema = z.object({
    meetingId: z.string().uuid(),
    events: z.array(TranscriptEventSchema),
    batchNumber: z.number().int().nonnegative(),
    batchTimestamp: z.string().datetime(),
});

// ============================================
// Meeting Schemas
// ============================================

export const ParticipantSchema = z.object({
    id: z.string(),
    displayName: z.string().min(1),
    email: z.string().email().optional(),
    joinedAt: z.string().datetime(),
    leftAt: z.string().datetime().optional(),
    isBot: z.boolean(),
});

export const MeetingStatusSchema = z.enum([
    'scheduled',
    'bot-joining',
    'in-progress',
    'completed',
    'cancelled',
    'error',
]);

export const MeetingSchema = z.object({
    id: z.string().uuid(),
    googleMeetLink: z.string().url(),
    title: z.string().min(1),
    startTime: z.string().datetime(),
    endTime: z.string().datetime().optional(),
    participants: z.array(ParticipantSchema),
    isRecurring: z.boolean(),
    recurringSeriesId: z.string().uuid().optional(),
    status: MeetingStatusSchema,
    organizationId: z.string().optional(),
});

// ============================================
// Action Item Schemas
// ============================================

export const ActionItemStatusSchema = z.enum([
    'pending',
    'in-progress',
    'completed',
    'blocked',
    'deferred',
    'cancelled',
]);

export const PrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const ProgressUpdateSchema = z.object({
    id: z.string().uuid(),
    actionItemId: z.string().uuid(),
    meetingId: z.string().uuid(),
    description: z.string(),
    status: ActionItemStatusSchema,
    timestamp: z.string().datetime(),
    updatedBy: z.string(),
    percentComplete: z.number().min(0).max(100).optional(),
});

export const ActionItemSchema = z.object({
    id: z.string().uuid(),
    description: z.string().min(1),
    assignee: z.string().min(1),
    dueDate: z.string().datetime().optional(),
    status: ActionItemStatusSchema,
    priority: PrioritySchema,
    sourceMeetingId: z.string().uuid(),
    recurringSeriesId: z.string().uuid().optional(),
    progressHistory: z.array(ProgressUpdateSchema),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    tags: z.array(z.string()),
    dependsOn: z.array(z.string().uuid()),
    blockedBy: z.array(z.string().uuid()),
});

// ============================================
// Type exports from schemas
// ============================================

export type TranscriptEventInput = z.infer<typeof TranscriptEventSchema>;
export type TranscriptBatchInput = z.infer<typeof TranscriptBatchSchema>;
export type ParticipantInput = z.infer<typeof ParticipantSchema>;
export type MeetingInput = z.infer<typeof MeetingSchema>;
export type ActionItemInput = z.infer<typeof ActionItemSchema>;
