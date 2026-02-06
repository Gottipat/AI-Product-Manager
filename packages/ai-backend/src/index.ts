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

import { API_CONFIG } from '@meeting-ai/shared';
import Fastify from 'fastify';

const server = Fastify({
  logger: true,
});

// Health check endpoint
server.get('/api/v1/health', async () => {
  return {
    status: 'healthy',
    version: '0.0.1',
    timestamp: new Date().toISOString(),
    services: [],
  };
});

// Placeholder routes - You will implement
server.post('/api/v1/stream/transcript', async (_request, reply) => {
  // TODO: Implement transcript streaming endpoint
  return reply.status(501).send({ error: 'Not implemented' });
});

server.post('/api/v1/meetings/start', async (_request, reply) => {
  // TODO: Implement meeting start endpoint
  return reply.status(501).send({ error: 'Not implemented' });
});

async function start(): Promise<void> {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
    console.warn(`AI Backend listening on http://localhost:3000`);
    console.warn(`Timeout config: ${API_CONFIG.DEFAULT_TIMEOUT_MS}ms`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
