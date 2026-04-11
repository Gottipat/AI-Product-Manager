/**
 * @fileoverview Authentication Middleware
 * @description JWT verification and user attachment to requests
 */

import type { FastifyRequest, FastifyReply } from 'fastify';

import * as authService from '../services/auth.service.js';

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/v1/health',
  '/api/v1/auth/signup',
  '/api/v1/auth/signin',
  '/api/v1/auth/logout',
];

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: string;
      email: string;
      organizationId?: string;
      role: string;
    };
  }
}

/**
 * Check if a route is public (doesn't require auth)
 */
function isPublicRoute(url: string): boolean {
  // Remove query params for matching
  const path = url.split('?')[0] ?? url;

  // Health check and auth routes are public
  if (path && PUBLIC_ROUTES.includes(path)) return true;

  // Also allow /health without /api/v1 prefix
  if (path === '/health') return true;

  return false;
}

/**
 * Auth middleware hook
 * Verifies JWT token and attaches user to request
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip auth for public routes
  if (isPublicRoute(request.url)) {
    return;
  }

  try {
    const token = request.cookies.auth_token;

    if (!token) {
      reply.status(401).send({ error: 'Authentication required' });
      return;
    }

    const payload = authService.verifyToken(token);

    if (!payload) {
      reply.clearCookie('auth_token', { path: '/' });
      reply.status(401).send({ error: 'Invalid or expired token' });
      return;
    }

    // Attach user to request
    request.user = payload;
  } catch (error) {
    console.error('Auth middleware error:', error);
    reply.status(500).send({ error: 'Authentication error' });
  }
}

/**
 * Require specific role middleware factory
 */
export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    if (!roles.includes(request.user.role)) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }
  };
}
