/**
 * @fileoverview Project Routes
 * @description CRUD operations for projects with meeting link support
 */

import { eq, desc, or } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

import { db } from '../db/index.js';
import { meetingItems } from '../db/schema/meetingItems.js';
import { meetings } from '../db/schema/meetings.js';
import { moms } from '../db/schema/mom.js';
import { projects } from '../db/schema/organizations.js';

// Validation schemas
const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  googleMeetLink: z.string().url().optional(),
  isRecurring: z.boolean().optional().default(false),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  googleMeetLink: z.string().url().optional().nullable(),
  isRecurring: z.boolean().optional(),
  status: z.enum(['active', 'completed', 'archived']).optional(),
});

export async function projectRoutes(server: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/projects - List all projects
   */
  server.get('/api/v1/projects', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const allProjects = await db
        .select()
        .from(projects)
        .orderBy(desc(projects.updatedAt));

      // Get meeting/task counts
      const projectsWithCounts = await Promise.all(
        allProjects.map(async (project) => {
          // Build conditions: always check projectId, optionally check googleMeetLink
          const conditions = [eq(meetings.projectId, project.id)];
          if (project.googleMeetLink) {
            conditions.push(eq(meetings.googleMeetLink, project.googleMeetLink));
          }

          const meetingResult = await db
            .select()
            .from(meetings)
            .where(conditions.length > 1 ? or(...conditions) : conditions[0]!);
          const meetingCount = meetingResult.length;

          let taskCount = 0;
          for (const meeting of meetingResult) {
            const items = await db
              .select()
              .from(meetingItems)
              .where(eq(meetingItems.meetingId, meeting.id));
            taskCount += items.length;
          }

          return { ...project, meetingCount, taskCount };
        })
      );

      return reply.send({ projects: projectsWithCounts });
    } catch (error) {
      console.error('List projects error:', error);
      return reply.status(500).send({ error: 'Failed to list projects' });
    }
  });

  /**
   * POST /api/v1/projects - Create a new project
   */
  server.post('/api/v1/projects', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = createProjectSchema.parse(request.body);

      const DEV_ORG_ID = '00000000-0000-0000-0000-000000000001';

      const [project] = await db
        .insert(projects)
        .values({
          organizationId: DEV_ORG_ID,
          name: body.name,
          description: body.description ?? null,
          googleMeetLink: body.googleMeetLink ?? null,
          isRecurring: body.isRecurring ?? false,
        })
        .returning();

      return reply.status(201).send({ project });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: error.errors });
      }
      console.error('Create project error:', error);
      return reply.status(500).send({ error: 'Failed to create project' });
    }
  });

  /**
   * GET /api/v1/projects/:id - Get project with meetings and tasks
   */
  server.get('/api/v1/projects/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);

      if (!project) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      // Get meetings associated with this project (by projectId OR googleMeetLink)
      const conditions = [eq(meetings.projectId, project.id)];
      if (project.googleMeetLink) {
        conditions.push(eq(meetings.googleMeetLink, project.googleMeetLink));
      }

      const projectMeetings = await db
        .select()
        .from(meetings)
        .where(conditions.length > 1 ? or(...conditions) : conditions[0]!)
        .orderBy(desc(meetings.startTime));

      const projectItems: (typeof meetingItems.$inferSelect)[] = [];
      const projectMoms: Record<string, typeof moms.$inferSelect> = {};

      for (const meeting of projectMeetings) {
        const items = await db
          .select()
          .from(meetingItems)
          .where(eq(meetingItems.meetingId, meeting.id));
        projectItems.push(...items);

        // Fetch MoM for this meeting
        const [mom] = await db
          .select()
          .from(moms)
          .where(eq(moms.meetingId, meeting.id))
          .limit(1);
        if (mom) {
          projectMoms[meeting.id] = mom;
        }
      }

      return reply.send({
        project,
        meetings: projectMeetings,
        items: projectItems,
        moms: projectMoms,
        stats: {
          totalMeetings: projectMeetings.length,
          totalItems: projectItems.length,
          pendingItems: projectItems.filter((i) => i.status === 'pending').length,
          completedItems: projectItems.filter((i) => i.status === 'completed').length,
        },
      });
    } catch (error) {
      console.error('Get project error:', error);
      return reply.status(500).send({ error: 'Failed to get project' });
    }
  });

  /**
   * PATCH /api/v1/projects/:id - Update a project
   */
  server.patch('/api/v1/projects/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = updateProjectSchema.parse(request.body);

      const [existing] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      const [updated] = await db
        .update(projects)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(projects.id, id))
        .returning();

      return reply.send({ project: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: error.errors });
      }
      console.error('Update project error:', error);
      return reply.status(500).send({ error: 'Failed to update project' });
    }
  });

  /**
   * POST /api/v1/projects/:id/link - Add or update meeting link
   */
  server.post('/api/v1/projects/:id/link', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { googleMeetLink } = z
        .object({ googleMeetLink: z.string().url() })
        .parse(request.body);

      const [existing] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      const [updated] = await db
        .update(projects)
        .set({ googleMeetLink, updatedAt: new Date() })
        .where(eq(projects.id, id))
        .returning();

      return reply.send({ project: updated, message: 'Meeting link updated' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid meeting link' });
      }
      console.error('Update link error:', error);
      return reply.status(500).send({ error: 'Failed to update meeting link' });
    }
  });

  /**
   * DELETE /api/v1/projects/:id - Delete a project
   */
  server.delete('/api/v1/projects/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      const [existing] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      await db.delete(projects).where(eq(projects.id, id));
      return reply.send({ success: true, message: 'Project deleted' });
    } catch (error) {
      console.error('Delete project error:', error);
      return reply.status(500).send({ error: 'Failed to delete project' });
    }
  });
}
