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
  console.warn('Bot Runner starting...');
  console.warn(`Bot name: ${BOT_CONFIG.DEFAULT_BOT_NAME}`);
  console.warn('TODO: Implement Playwright bot logic');
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
