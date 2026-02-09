/**
 * @fileoverview Route Index
 * @description Register all API routes with Fastify
 */

import { FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';

import { authRoutes } from './auth.js';
import { projectRoutes } from './projects.js';
import { aiRoutes } from './ai.js';
import { meetingItemsRoutes } from './meetingItems.js';
import { meetingRoutes } from './meetings.js';
import { momRoutes } from './mom.js';
import { transcriptRoutes } from './transcripts.js';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // Register cookie plugin for auth
  await fastify.register(cookie, {
    secret: process.env.COOKIE_SECRET || 'change-this-cookie-secret',
  });

  // Register all route modules
  await authRoutes(fastify);
  await projectRoutes(fastify);
  await aiRoutes(fastify);
  await meetingRoutes(fastify);
  await transcriptRoutes(fastify);
  await momRoutes(fastify);
  await meetingItemsRoutes(fastify);
}

