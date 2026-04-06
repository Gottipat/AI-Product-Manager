/**
 * @fileoverview Route Index
 * @description Register all API routes with Fastify
 */

import cookie from '@fastify/cookie';
import { FastifyInstance } from 'fastify';

import { aiRoutes } from './ai.js';
import { authRoutes } from './auth.js';
import { benchmarkRoutes } from './benchmark.js';
import { botRoutes } from './bot.js';
import { collaborationRoutes } from './collaboration.js';
import { extensionRoutes } from './extension.js';
import { meetingItemsRoutes } from './meetingItems.js';
import { meetingRoutes } from './meetings.js';
import { momRoutes } from './mom.js';
import { projectRoutes } from './projects.js';
import { transcriptRoutes } from './transcripts.js';
import { uploadRoutes } from './upload.js';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // Register cookie plugin for auth
  await fastify.register(cookie, {
    secret: process.env.COOKIE_SECRET || 'change-this-cookie-secret',
  });

  // Register all route modules
  await authRoutes(fastify);
  await projectRoutes(fastify);
  await collaborationRoutes(fastify);
  await aiRoutes(fastify);
  await benchmarkRoutes(fastify);
  await meetingRoutes(fastify);
  await transcriptRoutes(fastify);
  await momRoutes(fastify);
  await meetingItemsRoutes(fastify);
  await botRoutes(fastify);
  await extensionRoutes(fastify);
  await uploadRoutes(fastify);
}
