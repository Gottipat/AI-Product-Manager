/**
 * @fileoverview Route Index
 * @description Register all API routes with Fastify
 */

import { FastifyInstance } from 'fastify';

import { aiRoutes } from './ai.js';
import { meetingItemsRoutes } from './meetingItems.js';
import { meetingRoutes } from './meetings.js';
import { momRoutes } from './mom.js';
import { transcriptRoutes } from './transcripts.js';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // Register all route modules
  await aiRoutes(fastify);
  await meetingRoutes(fastify);
  await transcriptRoutes(fastify);
  await momRoutes(fastify);
  await meetingItemsRoutes(fastify);
}
