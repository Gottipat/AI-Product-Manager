/**
 * @fileoverview Bot Runner API Routes
 * @description Endpoints to control the bot runner (spawn, status, stop)
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import pino from 'pino';

const logger = pino({ name: 'bot-routes' });

// Track active bot sessions
interface BotSession {
  process: ChildProcess;
  meetingId: string;
  meetLink: string;
  startedAt: Date;
  status: 'starting' | 'joining' | 'in_meeting' | 'stopped' | 'error';
  logs: string[];
}

const activeSessions: Map<string, BotSession> = new Map();

export async function botRoutes(server: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/bot/join - Spawn bot runner to join a meeting
   */
  server.post('/api/v1/bot/join', async (request: FastifyRequest, reply: FastifyReply) => {
    const { meetLink, meetingTitle } = request.body as {
      meetLink: string;
      meetingTitle?: string;
    };

    if (!meetLink) {
      return reply.status(400).send({ error: 'meetLink is required' });
    }

    // Check if bot is already in this meeting
    for (const [, session] of activeSessions) {
      if (session.meetLink === meetLink && !['stopped', 'error'].includes(session.status)) {
        return reply.status(409).send({
          error: 'Bot is already in this meeting',
          sessionId: session.meetingId,
          status: session.status,
        });
      }
    }

    const sessionId = `bot-${Date.now()}`;

    try {
      // Resolve bot-runner path (sibling package)
      const botRunnerDir = path.resolve(__dirname, '../../../bot-runner');

      logger.info({ botRunnerDir, meetLink }, 'Spawning bot runner');

      // Spawn bot-runner as a child process
      const botProcess = spawn('npx', ['tsx', 'src/index.ts'], {
        cwd: botRunnerDir,
        env: {
          ...process.env,
          MEET_LINK: meetLink,
          AI_BACKEND_URL: `http://localhost:${process.env.PORT || 3002}`,
          BOT_DISPLAY_NAME: meetingTitle ? `AI Bot - ${meetingTitle}` : 'Meeting AI Bot',
          LOG_LEVEL: 'info',
          HEADLESS: 'false',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      const session: BotSession = {
        process: botProcess,
        meetingId: sessionId,
        meetLink,
        startedAt: new Date(),
        status: 'starting',
        logs: [],
      };

      activeSessions.set(sessionId, session);

      // Capture stdout
      botProcess.stdout?.on('data', (data: Buffer) => {
        const line = data.toString().trim();
        if (line) {
          session.logs.push(line);
          // Keep only last 100 lines
          if (session.logs.length > 100) session.logs.shift();

          // Parse status from logs
          if (line.includes('Joining meeting')) session.status = 'joining';
          if (line.includes('Joined meeting') || line.includes('Recording meeting'))
            session.status = 'in_meeting';
        }
      });

      // Capture stderr
      botProcess.stderr?.on('data', (data: Buffer) => {
        const line = data.toString().trim();
        if (line) {
          session.logs.push(`[stderr] ${line}`);
          if (session.logs.length > 100) session.logs.shift();
        }
      });

      // Handle exit
      botProcess.on('exit', (code) => {
        logger.info({ sessionId, code }, 'Bot process exited');
        session.status = code === 0 ? 'stopped' : 'error';
      });

      botProcess.on('error', (err) => {
        logger.error({ sessionId, err }, 'Bot process error');
        session.status = 'error';
        session.logs.push(`[error] ${err.message}`);
      });

      logger.info({ sessionId, pid: botProcess.pid }, 'Bot runner spawned');

      return reply.status(201).send({
        sessionId,
        status: 'starting',
        pid: botProcess.pid,
        message: 'Bot is starting up and will join the meeting shortly',
      });
    } catch (error) {
      logger.error({ error }, 'Failed to spawn bot');
      return reply.status(500).send({ error: 'Failed to start bot' });
    }
  });

  /**
   * GET /api/v1/bot/status/:sessionId - Get bot session status
   */
  server.get(
    '/api/v1/bot/status/:sessionId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sessionId } = request.params as { sessionId: string };
      const session = activeSessions.get(sessionId);

      if (!session) {
        return reply.status(404).send({ error: 'Bot session not found' });
      }

      return reply.send({
        sessionId,
        status: session.status,
        meetLink: session.meetLink,
        startedAt: session.startedAt,
        recentLogs: session.logs.slice(-20),
        pid: session.process.pid,
      });
    }
  );

  /**
   * POST /api/v1/bot/stop/:sessionId - Stop a bot session
   */
  server.post(
    '/api/v1/bot/stop/:sessionId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sessionId } = request.params as { sessionId: string };
      const session = activeSessions.get(sessionId);

      if (!session) {
        return reply.status(404).send({ error: 'Bot session not found' });
      }

      if (['stopped', 'error'].includes(session.status)) {
        return reply.send({ message: 'Bot already stopped', status: session.status });
      }

      try {
        session.process.kill('SIGTERM');
        session.status = 'stopped';
        logger.info({ sessionId }, 'Bot stopped');
        return reply.send({ message: 'Bot stopped', status: 'stopped' });
      } catch (error) {
        return reply.status(500).send({ error: 'Failed to stop bot' });
      }
    }
  );

  /**
   * GET /api/v1/bot/sessions - List all bot sessions
   */
  server.get('/api/v1/bot/sessions', async (_request: FastifyRequest, reply: FastifyReply) => {
    const sessions = Array.from(activeSessions.entries()).map(([id, s]) => ({
      sessionId: id,
      status: s.status,
      meetLink: s.meetLink,
      startedAt: s.startedAt,
    }));

    return reply.send({ sessions });
  });
}
