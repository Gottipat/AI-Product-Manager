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
import { API_CONFIG } from '@meeting-ai/shared';
import Fastify from 'fastify';

import { registerRoutes } from './routes/index.js';

import cors from '@fastify/cors';

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
      origin: ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    });

    // Register all routes
    await server.register(async (api) => {
      await registerRoutes(api);
    }, { prefix: '/api/v1' });

    await server.listen({ port: 3000, host: '0.0.0.0' });
    console.warn(`AI Backend listening on http://localhost:3000`);
    console.warn(`Timeout config: ${API_CONFIG.DEFAULT_TIMEOUT_MS}ms`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
