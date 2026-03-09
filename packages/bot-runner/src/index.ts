/**
 * @fileoverview Bot Runner Entry Point
 * @description Playwright-based bot for joining Google Meet and streaming captions
 *
 * This package is owned by: Gottipati
 * Responsibilities:
 * - Join Google Meet when invited/allowed
 * - Enable and capture live captions
 * - Stream speaker-attributed transcript events to AI Backend
 * - Handle meeting lifecycle (join, leave, reconnect)
 */

import 'dotenv/config';
import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';
import { BOT_CONFIG } from '@meeting-ai/shared';
import { BrowserLauncher, BrowserSession } from './browser/index.js';
import { MeetJoiner, CaptionsController, ParticipantTracker } from './meet/index.js';
import { CaptionParser, TranscriptBuffer } from './captions/index.js';
import { AuthManager } from './auth/index.js';

const logger = pino({
    name: 'bot-runner',
    level: process.env.LOG_LEVEL || 'info',
});

// Environment configuration
const config = {
    aiBackendUrl: process.env.AI_BACKEND_URL || 'http://localhost:3000',
    botDisplayName: process.env.BOT_DISPLAY_NAME || BOT_CONFIG.DEFAULT_BOT_NAME,
    headless: process.env.HEADLESS === 'true',
    meetLink: process.env.MEET_LINK,
    googleEmail: process.env.GOOGLE_EMAIL,
    googlePassword: process.env.GOOGLE_PASSWORD,
};

/**
 * Main entry point for the bot runner
 */
export async function main(): Promise<void> {
    logger.info({ config: { ...config, meetLink: config.meetLink ? '[SET]' : '[NOT SET]' } }, 'Bot Runner starting...');

    // Initialize browser
    const launcher = new BrowserLauncher({
        headless: config.headless,
    });

    let session: BrowserSession | null = null;
    let participantTracker: ParticipantTracker | null = null;
    let captionParser: CaptionParser | null = null;
    let transcriptBuffer: TranscriptBuffer | null = null;

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
        logger.info({ signal }, 'Received shutdown signal');

        if (captionParser) {
            await captionParser.stopObserving();
        }
        if (transcriptBuffer) {
            transcriptBuffer.stop();
            // Log final stats
            const stats = transcriptBuffer.getStats();
            logger.info({ stats }, 'Final transcript stats');
        }
        if (participantTracker) {
            participantTracker.stopTracking();
        }
        if (session) {
            await session.close();
        }
        await launcher.close();

        logger.info('Shutdown complete');
        process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    try {
        // Launch browser
        const context = await launcher.launch();
        session = new BrowserSession(context);

        logger.info(
            {
                sessionId: session.getSessionId(),
                botName: config.botDisplayName,
            },
            'Browser session ready'
        );

        // If a meet link is provided, process login and then join the meeting
        if (config.meetLink) {
            logger.info({ meetLink: config.meetLink }, 'Meet link provided, preparing to join meeting...');

            // Get the page from the session
            const page = await session.getPage();

            // Handle Authentication if credentials are provided
            if (config.googleEmail && config.googlePassword) {
                logger.info('Google credentials provided, starting authentication flow...');
                const authManager = new AuthManager(page);
                const authSuccess = await authManager.login(config.googleEmail, config.googlePassword);

                if (!authSuccess) {
                    logger.warn('Authentication failed or could not be verified. The bot will still attempt to join, but may be rejected by the meeting settings.');
                }
            } else {
                logger.info('No Google credentials provided (GOOGLE_EMAIL / GOOGLE_PASSWORD). Bot will attempt to join as an unauthenticated guest.');
            }

            // Create the joiner and attempt to join
            const joiner = new MeetJoiner(page, {
                botName: config.botDisplayName,
            });

            const joinResult = await joiner.join(config.meetLink);

            if (joinResult.success) {
                logger.info({ state: joinResult.state }, 'Successfully joined meeting!');

                // Generate a meeting ID
                const meetingId = `meet-${Date.now()}`;

                // Enable captions
                const captionsController = new CaptionsController(page);
                const captionsEnabled = await captionsController.enable();
                logger.info({ captionsEnabled }, 'Captions status');

                // Set up transcript buffer
                transcriptBuffer = new TranscriptBuffer({
                    meetingId,
                    maxEventsPerBatch: 50,
                    flushIntervalMs: 5000,
                });

                // Ensure transcripts directory exists
                const transcriptsDir = path.resolve(process.cwd(), 'transcripts');
                if (!fs.existsSync(transcriptsDir)) {
                    fs.mkdirSync(transcriptsDir, { recursive: true });
                }

                // Create a unique transcript file for this session
                const transcriptFile = path.resolve(transcriptsDir, `transcript-${meetingId}.txt`);
                const startTimeStr = new Date().toLocaleString();
                fs.writeFileSync(transcriptFile, `=== Transcript for Meeting ${meetingId} ===\nStarted at: ${startTimeStr}\n\n`, { encoding: 'utf-8' });
                logger.info({ file: transcriptFile }, 'Transcript will be saved locally');

                // Log batches when they're created
                transcriptBuffer.onBatch((batch) => {
                    logger.info(
                        {
                            batchNumber: batch.batchNumber,
                            eventCount: batch.events.length,
                            speakers: [...new Set(batch.events.map((e) => e.speaker))],
                        },
                        '📝 Transcript batch ready'
                    );

                    // Append individual events to the local log file
                    for (const event of batch.events) {
                        const timeStr = new Date(event.timestamp).toLocaleTimeString();
                        const logLine = `[${timeStr}] ${event.speaker}: ${event.text}\n`;

                        // Append to the file
                        fs.appendFileSync(transcriptFile, logLine, { encoding: 'utf-8' });

                        // Log to console for debugging
                        logger.info(
                            {
                                speaker: event.speaker,
                                text: event.text.substring(0, 100) + (event.text.length > 100 ? '...' : ''),
                            },
                            '💬 Caption'
                        );
                    }
                });

                transcriptBuffer.start();

                // Set up caption parser
                captionParser = new CaptionParser(page);

                // Connect parser to buffer
                captionParser.onCaption((rawCaption) => {
                    if (transcriptBuffer) {
                        transcriptBuffer.addCaption(rawCaption);
                    }
                });

                // Start observing captions
                const observing = await captionParser.startObserving();
                if (observing) {
                    logger.info('🎤 Caption observation started - speak to see transcripts!');
                } else {
                    logger.warn('Could not start caption observation. Try enabling captions manually (press C).');
                }

                // Start tracking participants
                participantTracker = new ParticipantTracker(page, config.botDisplayName);
                participantTracker.onParticipantEvent((event) => {
                    logger.info({ event: { type: event.type, participant: event.participant.displayName } }, 'Participant event');
                });
                await participantTracker.startTracking();

                logger.info('✅ Bot is now in the meeting with captions enabled. Speak to see transcripts!');
                logger.info('Press Ctrl+C to leave and see final stats.');
            } else {
                logger.warn({ state: joinResult.state, message: joinResult.message }, 'Could not join meeting');

                // Clean up and exit since we failed to join
                logger.info('Cleaning up browser after failed join...');
                if (session) {
                    await session.close();
                }
                await launcher.close();
                logger.info('Exiting due to failed join. Please check the meeting link and try again.');
                process.exit(1);
            }
        } else {
            logger.info('No MEET_LINK provided. Bot is ready and waiting for join commands.');
        }

        // Keep the process running
        logger.info('Bot running. Press Ctrl+C to stop.');
        await new Promise(() => { }); // Wait indefinitely
    } catch (error) {
        logger.error({ error }, 'Bot runner encountered an error');
        await launcher.close();
        process.exit(1);
    }
}

// Export modules for external use
export * from './browser/index.js';
export * from './meet/index.js';
export * from './captions/index.js';

// Run if this is the entry point
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
