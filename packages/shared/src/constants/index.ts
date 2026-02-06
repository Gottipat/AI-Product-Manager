/**
 * @fileoverview Shared constants and configuration
 * @description Constants used across Bot Runner and AI Backend
 */

// ============================================
// API Configuration
// ============================================

export const API_CONFIG = {
  /** Default timeout for API requests in milliseconds */
  DEFAULT_TIMEOUT_MS: 30000,

  /** Maximum retry attempts for failed requests */
  MAX_RETRIES: 3,

  /** Base delay for exponential backoff in milliseconds */
  RETRY_BASE_DELAY_MS: 1000,

  /** Maximum batch size for transcript streaming */
  MAX_BATCH_SIZE: 50,

  /** Interval for sending transcript batches in milliseconds */
  BATCH_INTERVAL_MS: 5000,
} as const;

// ============================================
// Meeting Configuration
// ============================================

export const MEETING_CONFIG = {
  /** Maximum meeting duration in hours */
  MAX_DURATION_HOURS: 8,

  /** Timeout for bot to join meeting in milliseconds */
  BOT_JOIN_TIMEOUT_MS: 60000,

  /** Interval for checking meeting status in milliseconds */
  STATUS_CHECK_INTERVAL_MS: 10000,

  /** Grace period after meeting ends before cleanup in milliseconds */
  CLEANUP_GRACE_PERIOD_MS: 30000,
} as const;

// ============================================
// Bot Configuration
// ============================================

export const BOT_CONFIG = {
  /** Default display name for the bot */
  DEFAULT_BOT_NAME: 'Meeting AI Bot',

  /** User agent string for the bot browser */
  USER_AGENT:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

  /** Viewport dimensions for the bot browser */
  VIEWPORT: {
    width: 1920,
    height: 1080,
  },
} as const;

// ============================================
// AI Processing Configuration
// ============================================

export const AI_CONFIG = {
  /** Minimum transcript length to trigger MoM generation */
  MIN_TRANSCRIPT_LENGTH: 100,

  /** Maximum tokens for summary generation */
  MAX_SUMMARY_TOKENS: 1000,

  /** Confidence threshold for accepting AI extractions */
  CONFIDENCE_THRESHOLD: 0.7,

  /** Model temperature for extraction tasks */
  EXTRACTION_TEMPERATURE: 0.3,

  /** Model temperature for summary tasks */
  SUMMARY_TEMPERATURE: 0.5,
} as const;

// ============================================
// Error Codes
// ============================================

export const ERROR_CODES = {
  // Bot Runner Errors (1xxx)
  BOT_JOIN_FAILED: 'E1001',
  BOT_CAPTION_ERROR: 'E1002',
  BOT_DISCONNECTED: 'E1003',
  BOT_TIMEOUT: 'E1004',

  // AI Backend Errors (2xxx)
  TRANSCRIPT_PROCESSING_FAILED: 'E2001',
  MOM_GENERATION_FAILED: 'E2002',
  STORAGE_ERROR: 'E2003',
  RAG_RETRIEVAL_FAILED: 'E2004',

  // Communication Errors (3xxx)
  STREAM_CONNECTION_FAILED: 'E3001',
  API_TIMEOUT: 'E3002',
  INVALID_PAYLOAD: 'E3003',

  // General Errors (9xxx)
  UNKNOWN_ERROR: 'E9999',
} as const;

// ============================================
// Event Types
// ============================================

export const EVENT_TYPES = {
  // Bot Events
  BOT_JOINING: 'bot.joining',
  BOT_JOINED: 'bot.joined',
  BOT_LEFT: 'bot.left',
  BOT_ERROR: 'bot.error',

  // Meeting Events
  MEETING_STARTED: 'meeting.started',
  MEETING_ENDED: 'meeting.ended',
  PARTICIPANT_JOINED: 'meeting.participant.joined',
  PARTICIPANT_LEFT: 'meeting.participant.left',

  // Transcript Events
  TRANSCRIPT_RECEIVED: 'transcript.received',
  TRANSCRIPT_BATCH_PROCESSED: 'transcript.batch.processed',

  // AI Events
  MOM_GENERATION_STARTED: 'ai.mom.started',
  MOM_GENERATION_COMPLETED: 'ai.mom.completed',
  TASK_EXTRACTED: 'ai.task.extracted',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];
