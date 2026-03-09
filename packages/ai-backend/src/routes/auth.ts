/**
 * @fileoverview Authentication Routes
 * @description Signup, signin, and user profile endpoints
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

import * as authService from '../services/auth.service.js';

// Validation schemas
const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1, 'Display name is required'),
  organizationId: z.string().uuid().optional(),
});

const signinSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Cookie options for JWT token
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};

export async function authRoutes(server: FastifyInstance): Promise<void> {
  /**
   * POST /auth/signup - Create a new user account
   */
  server.post('/auth/signup', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = signupSchema.parse(request.body);

      const { user, token } = await authService.createUser(
        body.email,
        body.password,
        body.displayName,
        body.organizationId
      );

      reply.setCookie('auth_token', token, cookieOptions);

      return reply.status(201).send({
        success: true,
        user,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.errors,
        });
      }

      if (error instanceof Error && error.message.includes('already exists')) {
        return reply.status(409).send({ error: error.message });
      }

      console.error('Signup error:', error);
      return reply.status(500).send({ error: 'Failed to create account' });
    }
  });

  /**
   * POST /auth/signin - Login with email and password
   */
  server.post('/auth/signin', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = signinSchema.parse(request.body);

      const { user, token } = await authService.signIn(body.email, body.password);

      reply.setCookie('auth_token', token, cookieOptions);

      return reply.send({
        success: true,
        user,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.errors,
        });
      }

      if (error instanceof Error && error.message.includes('Invalid')) {
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      if (error instanceof Error && error.message.includes('deactivated')) {
        return reply.status(403).send({ error: 'Account is deactivated' });
      }

      console.error('Signin error:', error);
      return reply.status(500).send({ error: 'Failed to sign in' });
    }
  });

  /**
   * POST /auth/logout - Clear auth cookie
   */
  server.post('/auth/logout', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.clearCookie('auth_token', { path: '/' });
    return reply.send({ success: true });
  });

  /**
   * GET /auth/me - Get current user profile
   */
  server.get('/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token = request.cookies.auth_token;

      if (!token) {
        return reply.status(401).send({ error: 'Not authenticated' });
      }

      const payload = authService.verifyToken(token);

      if (!payload) {
        reply.clearCookie('auth_token', { path: '/' });
        return reply.status(401).send({ error: 'Invalid or expired token' });
      }

      const user = await authService.getUserById(payload.userId);

      if (!user) {
        reply.clearCookie('auth_token', { path: '/' });
        return reply.status(401).send({ error: 'User not found' });
      }

      return reply.send({ user });
    } catch (error) {
      console.error('Get me error:', error);
      return reply.status(500).send({ error: 'Failed to get user' });
    }
  });
}
