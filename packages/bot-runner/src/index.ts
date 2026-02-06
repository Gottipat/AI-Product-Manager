/**
 * @fileoverview Bot Runner Entry Point
 * @description Playwright-based bot for joining Google Meet and streaming captions
 *
 * This package is owned by: Friend
 * Responsibilities:
 * - Join Google Meet when invited/allowed
 * - Enable and capture live captions
 * - Stream speaker-attributed transcript events to AI Backend
 * - Handle meeting lifecycle (join, leave, reconnect)
 */

import { BOT_CONFIG } from '@meeting-ai/shared';

// Placeholder - Friend will implement
export async function main(): Promise<void> {
  console.warn('Bot Runner starting...');
  console.warn(`Bot name: ${BOT_CONFIG.DEFAULT_BOT_NAME}`);
  console.warn('TODO: Implement Playwright bot logic');
}

main().catch(console.error);
