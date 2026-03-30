/**
 * @fileoverview AI Backend Entry Point
 * @description Fastify server for AI extraction, MoM generation, and RAG
 *
 * This package is owned by: You (Kumar Sashank)
 * Responsibilities:
 * - Receive and store transcript streams from Bot Runner
 * - AI extraction of key information
 * - Minutes of Meeting (MoM) generation
 * - Task/progress tracking across recurring meetings
 * - RAG system for context retrieval
 */

import 'dotenv/config';
import cors from '@fastify/cors';
import { API_CONFIG } from '@meeting-ai/shared';
import Fastify from 'fastify';

import { registerRoutes } from './routes/index.js';

const server = Fastify({
  logger: true,
});

// Health check endpoint
server.get('/api/v1/health', async () => {
  return {
    status: 'healthy',
    version: '0.0.1',
    timestamp: new Date().toISOString(),
    services: ['database', 'meetings', 'transcripts', 'mom', 'items'],
  };
});

async function start(): Promise<void> {
  try {
    // Register CORS
    await server.register(cors, {
      origin: (origin, callback) => {
        const allowedOrigins = ['http://localhost:3000', 'http://localhost:3001'];
        // Allow Chrome extension origins
        if (
          !origin ||
          allowedOrigins.includes(origin) ||
          origin.startsWith('chrome-extension://')
        ) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    });

    // Register all routes (routes already include /api/v1 prefix)
    await registerRoutes(server);

    const port = Number(process.env.PORT) || 3000;
    await server.listen({ port, host: '0.0.0.0' });
    console.warn(`AI Backend listening on http://localhost:${port}`);
    console.warn(`Timeout config: ${API_CONFIG.DEFAULT_TIMEOUT_MS}ms`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
