/**
 * @fileoverview Project Routes
 * @description CRUD operations for projects with meeting link support
 */

import { eq, and, desc } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

import { db } from '../db/index.js';
import { meetingItems } from '../db/schema/meetingItems.js';
import { meetings } from '../db/schema/meetings.js';
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
   * GET /projects - List user's projects
   */
  server.get('/projects', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const { organizationId } = request.user;

      if (!organizationId) {
        // Return empty for users without organization
        return reply.send({ projects: [] });
      }

      const userProjects = await db
        .select()
        .from(projects)
        .where(eq(projects.organizationId, organizationId))
        .orderBy(desc(projects.updatedAt));

      // Get meeting counts for each project
      const projectsWithCounts = await Promise.all(
        userProjects.map(async (project) => {
          let meetingCount = 0;
          let taskCount = 0;

          if (project.googleMeetLink) {
            // Count meetings with this link
            const meetingResult = await db
              .select()
              .from(meetings)
              .where(eq(meetings.googleMeetLink, project.googleMeetLink));
            meetingCount = meetingResult.length;

            // Count tasks from these meetings
            for (const meeting of meetingResult) {
              const items = await db
                .select()
                .from(meetingItems)
                .where(eq(meetingItems.meetingId, meeting.id));
              taskCount += items.length;
            }
          }

          return {
            ...project,
            meetingCount,
            taskCount,
          };
        })
      );

      return reply.send({ projects: projectsWithCounts });
    } catch (error) {
      console.error('List projects error:', error);
      return reply.status(500).send({ error: 'Failed to list projects' });
    }
  });

  /**
   * POST /projects - Create a new project
   */
  server.post('/projects', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const body = createProjectSchema.parse(request.body);
      const { organizationId, userId } = request.user;

      if (!organizationId) {
        return reply.status(400).send({ error: 'User must belong to an organization' });
      }

      // Check if project with same meeting link exists (for recurring meetings)
      if (body.googleMeetLink) {
        const existing = await db
          .select()
          .from(projects)
          .where(
            and(
              eq(projects.organizationId, organizationId),
              eq(projects.googleMeetLink, body.googleMeetLink)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          // Return existing project for recurring meeting
          return reply.send({
            project: existing[0],
            isExisting: true,
            message: 'Project with this meeting link already exists',
          });
        }
      }

      const [project] = await db
        .insert(projects)
        .values({
          organizationId,
          createdBy: userId,
          name: body.name,
          description: body.description,
          googleMeetLink: body.googleMeetLink,
          isRecurring: body.isRecurring,
        })
        .returning();

      return reply.status(201).send({ project });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.errors,
        });
      }
      console.error('Create project error:', error);
      return reply.status(500).send({ error: 'Failed to create project' });
    }
  });

  /**
   * GET /projects/:id - Get project with meetings and tasks
   */
  server.get('/projects/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const { id } = request.params as { id: string };
      const { organizationId } = request.user;

      const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId!)))
        .limit(1);

      if (!project) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      // Get meetings associated with this project's meeting link
      let projectMeetings: (typeof meetings.$inferSelect)[] = [];
      const projectItems: (typeof meetingItems.$inferSelect)[] = [];

      if (project.googleMeetLink) {
        projectMeetings = await db
          .select()
          .from(meetings)
          .where(eq(meetings.googleMeetLink, project.googleMeetLink))
          .orderBy(desc(meetings.startTime));

        // Get all items from these meetings
        for (const meeting of projectMeetings) {
          const items = await db
            .select()
            .from(meetingItems)
            .where(eq(meetingItems.meetingId, meeting.id));
          projectItems.push(...items);
        }
      }

      return reply.send({
        project,
        meetings: projectMeetings,
        items: projectItems,
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
   * PATCH /projects/:id - Update a project
   */
  server.patch('/projects/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const { id } = request.params as { id: string };
      const body = updateProjectSchema.parse(request.body);
      const { organizationId } = request.user;

      const [existing] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId!)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      const [updated] = await db
        .update(projects)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, id))
        .returning();

      return reply.send({ project: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.errors,
        });
      }
      console.error('Update project error:', error);
      return reply.status(500).send({ error: 'Failed to update project' });
    }
  });

  /**
   * POST /projects/:id/link - Add or update meeting link
   */
  server.post('/projects/:id/link', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const { id } = request.params as { id: string };
      const { googleMeetLink } = z.object({ googleMeetLink: z.string().url() }).parse(request.body);
      const { organizationId } = request.user;

      const [existing] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId!)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      const [updated] = await db
        .update(projects)
        .set({
          googleMeetLink,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, id))
        .returning();

      return reply.send({
        project: updated,
        message: 'Meeting link updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid meeting link' });
      }
      console.error('Update link error:', error);
      return reply.status(500).send({ error: 'Failed to update meeting link' });
    }
  });

  /**
   * DELETE /projects/:id - Delete a project
   */
  server.delete('/projects/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const { id } = request.params as { id: string };
      const { organizationId } = request.user;

      const [existing] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId!)))
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
