/**
 * @fileoverview Transcript Buffer
 * @description Buffers caption events and creates batches for streaming to backend
 */

import { v4 as uuidv4 } from 'uuid';
import { TranscriptEvent, TranscriptBatch } from '@meeting-ai/shared';
import pino from 'pino';
import { RawCaption } from './parser.js';
import { SpeakerTracker } from './attribution.js';

const logger = pino({ name: 'caption-buffer' });

export interface BufferConfig {
    /** Maximum events per batch */
    maxEventsPerBatch?: number | undefined;
    /** Maximum time between flushes in ms */
    flushIntervalMs?: number | undefined;
    /** Meeting ID for events */
    meetingId: string;
}

export type BatchHandler = (batch: TranscriptBatch) => void;

/**
 * TranscriptBuffer accumulates caption events and batches them for sending
 */
export class TranscriptBuffer {
    private config: Required<Omit<BufferConfig, 'meetingId'>> & { meetingId: string };
    private events: TranscriptEvent[] = [];
    private batchNumber: number = 0;
    private sequenceNumber: number = 0;
    private flushTimer: ReturnType<typeof setInterval> | null = null;
    private handlers: BatchHandler[] = [];
    private speakerTracker: SpeakerTracker;
    private lastEventText: string = '';

    constructor(config: BufferConfig) {
        this.config = {
            maxEventsPerBatch: config.maxEventsPerBatch ?? 50,
            flushIntervalMs: config.flushIntervalMs ?? 5000,
            meetingId: config.meetingId,
        };
        this.speakerTracker = new SpeakerTracker();
    }

    /**
     * Start the buffer (begins flush timer)
     */
    start(): void {
        if (this.flushTimer) {
            return;
        }

        logger.info(
            {
                maxEvents: this.config.maxEventsPerBatch,
                flushIntervalMs: this.config.flushIntervalMs
            },
            'Starting transcript buffer'
        );

        this.flushTimer = setInterval(() => {
            this.flush();
        }, this.config.flushIntervalMs);
    }

    /**
     * Stop the buffer
     */
    stop(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }

        // Flush any remaining events
        this.flush();

        logger.info('Transcript buffer stopped');
    }

    /**
     * Add a raw caption to the buffer
     */
    addCaption(caption: RawCaption): TranscriptEvent {
        // Get or create speaker
        const speaker = this.speakerTracker.getOrCreateSpeaker(caption.speaker);

        // Determine the text to store
        let eventText = caption.text;
        let isFinal = true;

        // If this is a continuation, only store the new part
        if (caption.isContinuation && this.lastEventText && caption.text.startsWith(this.lastEventText)) {
            // This is a partial update, mark as not final
            isFinal = false;
        }

        this.lastEventText = caption.text;

        // Create the transcript event
        const event: TranscriptEvent = {
            id: uuidv4(),
            meetingId: this.config.meetingId,
            speaker: speaker.displayName,
            speakerId: speaker.id,
            text: eventText,
            timestamp: caption.capturedAt.toISOString(),
            sequenceNumber: this.sequenceNumber++,
            isFinal,
        };

        this.events.push(event);

        logger.debug(
            {
                eventId: event.id,
                speaker: event.speaker,
                textLength: event.text.length,
                isFinal: event.isFinal,
                bufferSize: this.events.length
            },
            'Caption added to buffer'
        );

        // Check if we need to flush
        if (this.events.length >= (this.config.maxEventsPerBatch ?? 50)) {
            logger.debug('Buffer full, flushing');
            this.flush();
        }

        return event;
    }

    /**
     * Flush the buffer and emit a batch
     */
    flush(): TranscriptBatch | null {
        if (this.events.length === 0) {
            return null;
        }

        const batch: TranscriptBatch = {
            meetingId: this.config.meetingId,
            events: [...this.events],
            batchNumber: this.batchNumber++,
            batchTimestamp: new Date().toISOString(),
        };

        // Clear the buffer
        this.events = [];

        logger.info(
            {
                batchNumber: batch.batchNumber,
                eventCount: batch.events.length
            },
            'Flushing batch'
        );

        // Emit to handlers
        for (const handler of this.handlers) {
            try {
                handler(batch);
            } catch (error) {
                logger.error({ error }, 'Error in batch handler');
            }
        }

        return batch;
    }

    /**
     * Register a batch handler
     */
    onBatch(handler: BatchHandler): void {
        this.handlers.push(handler);
    }

    /**
     * Remove a batch handler
     */
    offBatch(handler: BatchHandler): void {
        const index = this.handlers.indexOf(handler);
        if (index > -1) {
            this.handlers.splice(index, 1);
        }
    }

    /**
     * Get current buffer size
     */
    getBufferSize(): number {
        return this.events.length;
    }

    /**
     * Get total events processed
     */
    getTotalEventsProcessed(): number {
        return this.sequenceNumber;
    }

    /**
     * Get number of batches created
     */
    getBatchCount(): number {
        return this.batchNumber;
    }

    /**
     * Get the speaker tracker
     */
    getSpeakerTracker(): SpeakerTracker {
        return this.speakerTracker;
    }

    /**
     * Get all speakers detected
     */
    getSpeakers(): ReturnType<SpeakerTracker['getAllSpeakers']> {
        return this.speakerTracker.getAllSpeakers();
    }

    /**
     * Get buffer statistics
     */
    getStats(): {
        bufferSize: number;
        totalEvents: number;
        batchCount: number;
        speakerCount: number;
    } {
        return {
            bufferSize: this.events.length,
            totalEvents: this.sequenceNumber,
            batchCount: this.batchNumber,
            speakerCount: this.speakerTracker.getSpeakerCount(),
        };
    }
}
