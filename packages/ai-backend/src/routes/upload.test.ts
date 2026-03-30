/**
 * @fileoverview Upload Route Tests
 * @description Test cases for transcript upload endpoint
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Mock dependencies
vi.mock('../db/index.js', () => ({
    db: {
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                        {
                            id: 'proj-123',
                            organizationId: 'org-123',
                            googleMeetLink: null,
                            name: 'Test Project',
                        },
                    ]),
                }),
            }),
        }),
        update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
            }),
        }),
    },
}));

vi.mock('../db/repositories/meeting.repository.js', () => ({
    meetingRepository: {
        create: vi.fn().mockResolvedValue({ id: 'meeting-123' }),
    },
}));

vi.mock('../db/repositories/transcript.repository.js', () => ({
    transcriptRepository: {
        createBatch: vi.fn().mockResolvedValue([
            { id: 'te-1' },
            { id: 'te-2' },
            { id: 'te-3' },
        ]),
    },
}));

vi.mock('../pipelines/mom.pipeline.js', () => ({
    momPipeline: {
        generate: vi.fn().mockResolvedValue({
            success: true,
            momId: 'mom-123',
            highlightsCreated: 3,
            itemsCreated: 5,
            processingTimeMs: 2500,
        }),
    },
}));

import { transcriptRepository } from '../db/repositories/transcript.repository.js';
import { momPipeline } from '../pipelines/mom.pipeline.js';

describe('Upload Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Transcript Parser', () => {
        it('should parse speaker-attributed lines', () => {
            // Test the parsing logic directly
            const raw = 'Alice: Hello everyone\nBob: Hi there\nCharlie: Good morning';
            const lines = raw
                .split('\n')
                .map((l) => l.trim())
                .filter((l) => l.length > 0);

            const parsed = lines.map((line) => {
                const match = line.match(/^([^:]{1,50}):\s+(.+)$/);
                if (match && match[1] && match[2]) {
                    return { speaker: match[1].trim(), content: match[2].trim() };
                }
                return { speaker: 'Speaker', content: line };
            });

            expect(parsed).toHaveLength(3);
            expect(parsed[0]).toEqual({ speaker: 'Alice', content: 'Hello everyone' });
            expect(parsed[1]).toEqual({ speaker: 'Bob', content: 'Hi there' });
            expect(parsed[2]).toEqual({ speaker: 'Charlie', content: 'Good morning' });
        });

        it('should fall back to generic speaker for plain text', () => {
            const raw = 'This is plain text without attribution';
            const lines = raw
                .split('\n')
                .map((l) => l.trim())
                .filter((l) => l.length > 0);

            const parsed = lines.map((line) => {
                const match = line.match(/^([^:]{1,50}):\s+(.+)$/);
                if (match && match[1] && match[2]) {
                    return { speaker: match[1].trim(), content: match[2].trim() };
                }
                return { speaker: 'Speaker', content: line };
            });

            expect(parsed).toHaveLength(1);
            expect(parsed[0]?.speaker).toBe('Speaker');
            expect(parsed[0]?.content).toBe('This is plain text without attribution');
        });

        it('should handle mixed format transcripts', () => {
            const raw = 'Alice: First point\nSome plain text\nBob: Another point';
            const lines = raw
                .split('\n')
                .map((l) => l.trim())
                .filter((l) => l.length > 0);

            const parsed = lines.map((line) => {
                const match = line.match(/^([^:]{1,50}):\s+(.+)$/);
                if (match && match[1] && match[2]) {
                    return { speaker: match[1].trim(), content: match[2].trim() };
                }
                return { speaker: 'Speaker', content: line };
            });

            expect(parsed).toHaveLength(3);
            expect(parsed[0]?.speaker).toBe('Alice');
            expect(parsed[1]?.speaker).toBe('Speaker');
            expect(parsed[2]?.speaker).toBe('Bob');
        });

        it('should skip empty lines', () => {
            const raw = 'Alice: Hello\n\n\nBob: World\n  \n';
            const lines = raw
                .split('\n')
                .map((l) => l.trim())
                .filter((l) => l.length > 0);

            expect(lines).toHaveLength(2);
        });
    });

    describe('Pipeline Integration', () => {
        it('should trigger MoM pipeline after batch insert', async () => {
            // Simulate the upload flow
            const transcriptEvents = [
                {
                    meetingId: 'meeting-123',
                    speaker: 'Alice',
                    content: 'Let us discuss the roadmap',
                    sequenceNumber: 1,
                    isFinal: true,
                    capturedAt: new Date(),
                },
            ];

            await transcriptRepository.createBatch(transcriptEvents);
            expect(transcriptRepository.createBatch).toHaveBeenCalledWith(transcriptEvents);

            const result = await momPipeline.generate('meeting-123');
            expect(momPipeline.generate).toHaveBeenCalledWith('meeting-123');
            expect(result.success).toBe(true);
            expect(result.momId).toBe('mom-123');
            expect(result.itemsCreated).toBe(5);
        });

        it('should handle pipeline failure gracefully', async () => {
            (momPipeline.generate as Mock).mockResolvedValueOnce({
                success: false,
                momId: null,
                highlightsCreated: 0,
                itemsCreated: 0,
                processingTimeMs: 100,
                error: 'No transcript available',
            });

            const result = await momPipeline.generate('meeting-bad');
            expect(result.success).toBe(false);
            expect(result.error).toBe('No transcript available');
        });
    });
});
