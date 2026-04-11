/**
 * @fileoverview Transcript-related type definitions
 * @description Types for real-time transcript events streamed from Bot Runner to AI Backend
 */

/**
 * A single transcript event captured from Google Meet captions
 */
export interface TranscriptEvent {
  /** Unique identifier for this transcript event */
  id: string;

  /** ID of the meeting this event belongs to */
  meetingId: string;

  /** Display name of the speaker */
  speaker: string;

  /** Optional unique identifier for the speaker (if available) */
  speakerId?: string;

  /** The transcribed text content */
  text: string;

  /** ISO 8601 timestamp when this was captured */
  timestamp: string;

  /** Confidence score of the transcription (0-1) */
  confidence?: number;

  /** Sequence number within the meeting */
  sequenceNumber: number;

  /** Whether this is a final or interim transcript */
  isFinal: boolean;

  /** Source of this transcript: 'captions' (DOM scraping) or 'audio' (Deepgram) */
  source?: 'captions' | 'audio';
}

/**
 * A batch of transcript events for streaming
 */
export interface TranscriptBatch {
  /** ID of the meeting */
  meetingId: string;

  /** Array of transcript events in this batch */
  events: TranscriptEvent[];

  /** Batch sequence number for ordering */
  batchNumber: number;

  /** ISO 8601 timestamp when batch was created */
  batchTimestamp: string;
}
