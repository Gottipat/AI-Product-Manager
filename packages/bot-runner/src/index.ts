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
import { BOT_CONFIG } from '@meeting-ai/shared';
import { BrowserLauncher, BrowserSession } from './browser/index.js';
import { MeetJoiner, CaptionsController, ParticipantTracker } from './meet/index.js';

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

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
        logger.info({ signal }, 'Received shutdown signal');

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

        // If a meet link is provided, join the meeting
        if (config.meetLink) {
            logger.info({ meetLink: config.meetLink }, 'Meet link provided, joining meeting...');

            // Get the page from the session
            const page = await session.getPage();

            // Create the joiner and attempt to join
            const joiner = new MeetJoiner(page, {
                botName: config.botDisplayName,
            });

            const joinResult = await joiner.join(config.meetLink);

            if (joinResult.success) {
                logger.info({ state: joinResult.state }, 'Successfully joined meeting!');

                // Enable captions
                const captionsController = new CaptionsController(page);
                const captionsEnabled = await captionsController.enable();
                logger.info({ captionsEnabled }, 'Captions status');

                // Start tracking participants
                participantTracker = new ParticipantTracker(page, config.botDisplayName);
                participantTracker.onParticipantEvent((event) => {
                    logger.info({ event: { type: event.type, participant: event.participant.displayName } }, 'Participant event');
                });
                await participantTracker.startTracking();

                logger.info('Bot is now in the meeting with captions enabled. Press Ctrl+C to leave.');
            } else {
                logger.warn({ state: joinResult.state, message: joinResult.message }, 'Could not join meeting');
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

// Export browser module for external use
export * from './browser/index.js';
export * from './meet/index.js';

// Run if this is the entry point
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});

