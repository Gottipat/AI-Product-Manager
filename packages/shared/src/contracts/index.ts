/**
 * @fileoverview API contracts between Bot Runner and AI Backend
 * @description Defines the interface for communication between services
 */

import type { TranscriptBatch, MeetingStatus } from '../types/index.js';

// ============================================
// Streaming API (Bot Runner → AI Backend)
// ============================================

/**
 * POST /api/v1/stream/transcript
 * Stream transcript events from Bot Runner to AI Backend
 */
export interface StreamTranscriptRequest {
    batch: TranscriptBatch;
}

export interface StreamTranscriptResponse {
    acknowledged: boolean;
    processedCount: number;
    errors?: string[];
}

// ============================================
// Meeting Lifecycle API (Bot Runner → AI Backend)
// ============================================

/**
 * POST /api/v1/meetings/start
 * Notify backend that bot has joined a meeting
 */
export interface MeetingStartRequest {
    meetingId: string;
    googleMeetLink: string;
    title: string;
    startTime: string;
    isRecurring: boolean;
    recurringSeriesId?: string;
}

export interface MeetingStartResponse {
    acknowledged: boolean;
    meetingId: string;
}

/**
 * POST /api/v1/meetings/:meetingId/participant
 * Notify backend of participant join/leave
 */
export interface ParticipantUpdateRequest {
    participantId: string;
    displayName: string;
    email?: string;
    action: 'joined' | 'left';
    timestamp: string;
}

export interface ParticipantUpdateResponse {
    acknowledged: boolean;
}

/**
 * POST /api/v1/meetings/:meetingId/end
 * Notify backend that meeting has ended
 */
export interface MeetingEndRequest {
    endTime: string;
    totalTranscriptEvents: number;
    finalStatus: MeetingStatus;
}

export interface MeetingEndResponse {
    acknowledged: boolean;
    processingJobId: string;
}

// ============================================
// Bot Control API (AI Backend → Bot Runner)
// ============================================

/**
 * POST /api/v1/bot/join
 * Request bot to join a meeting
 */
export interface BotJoinRequest {
    meetingId: string;
    googleMeetLink: string;
    scheduledStartTime?: string;
    botDisplayName?: string;
}

export interface BotJoinResponse {
    success: boolean;
    botSessionId: string;
    error?: string;
}

/**
 * POST /api/v1/bot/:sessionId/leave
 * Request bot to leave a meeting
 */
export interface BotLeaveRequest {
    reason: 'manual' | 'meeting-ended' | 'error';
}

export interface BotLeaveResponse {
    success: boolean;
}

// ============================================
// Health Check API
// ============================================

export interface HealthCheckResponse {
    status: 'healthy' | 'degraded' | 'unhealthy';
    version: string;
    timestamp: string;
    services: {
        name: string;
        status: 'up' | 'down';
        latencyMs?: number;
    }[];
}

// ============================================
// API Endpoint Definitions
// ============================================

export const API_ENDPOINTS = {
    // Bot Runner → AI Backend
    STREAM_TRANSCRIPT: '/api/v1/stream/transcript',
    MEETING_START: '/api/v1/meetings/start',
    MEETING_END: '/api/v1/meetings/:meetingId/end',
    PARTICIPANT_UPDATE: '/api/v1/meetings/:meetingId/participant',

    // AI Backend → Bot Runner
    BOT_JOIN: '/api/v1/bot/join',
    BOT_LEAVE: '/api/v1/bot/:sessionId/leave',
    BOT_STATUS: '/api/v1/bot/:sessionId/status',

    // Common
    HEALTH: '/api/v1/health',
} as const;
