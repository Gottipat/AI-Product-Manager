/**
 * @fileoverview Extension API Routes
 * @description Endpoints for the Chrome extension to interact with projects and meetings.
 *   These are lightweight, extension-specific routes that complement the existing meeting routes.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { meetingRepository, type NewMeeting } from '../db/repositories/meeting.repository.js';

export async function extensionRoutes(server: FastifyInstance): Promise<void> {
    /**
     * GET /api/v1/extension/projects
     * List all projects for extension dropdown (lightweight — id, name, meetLink only)
     */
    server.get('/api/v1/extension/projects', async (_request: FastifyRequest, reply: FastifyReply) => {
        try {
            // Import db directly for a lightweight query
            const { db } = await import('../db/index.js');
            const { projects } = await import('../db/schema/index.js');

            const result = await db
                .select({
                    id: projects.id,
                    name: projects.name,
                    googleMeetLink: projects.googleMeetLink,
                })
                .from(projects);

            return reply.send({ projects: result });
        } catch (error) {
            return reply.status(500).send({ error: 'Failed to fetch projects' });
        }
    });

    /**
     * POST /api/v1/extension/meetings
     * Create a meeting from the extension, linked to a project
     */
    server.post('/api/v1/extension/meetings', async (request: FastifyRequest, reply: FastifyReply) => {
        const { title, googleMeetLink, projectId } = request.body as {
            title: string;
            googleMeetLink: string;
            projectId?: string;
        };

        if (!title || !googleMeetLink) {
            return reply.status(400).send({ error: 'title and googleMeetLink are required' });
        }

        const meetingData: NewMeeting = {
            title,
            googleMeetLink,
            projectId: projectId || null,
            captureSource: 'extension',
            meetingType: 'other',
            status: 'scheduled',
        };

        const meeting = await meetingRepository.create(meetingData);
        return reply.status(201).send({ meeting });
    });

    /**
     * GET /api/v1/extension/status
     * Quick health + extension-specific meta for the popup
     */
    server.get('/api/v1/extension/status', async (_request: FastifyRequest, reply: FastifyReply) => {
        return reply.send({
            status: 'healthy',
            version: '1.0.0',
            captureSourceSupported: true,
        });
    });
}
