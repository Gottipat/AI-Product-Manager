/**
 * @fileoverview Collaboration Routes
 * @description Project collaborator management and invite endpoints
 */

import { and, eq } from 'drizzle-orm';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { db } from '../db/index.js';
import { projectCollaborators } from '../db/schema/collaboration.js';
import { users } from '../db/schema/users.js';
import {
  canManageProjectCollaborators,
  canViewProject,
  listProjectCollaborators,
} from '../services/collaboration.service.js';

const inviteCollaboratorSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: z.enum(['viewer', 'editor']).default('viewer'),
});

const updateCollaboratorSchema = z.object({
  role: z.enum(['viewer', 'editor']).optional(),
  status: z.enum(['pending', 'active', 'revoked']).optional(),
});

export async function collaborationRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Params: { id: string } }>(
    '/api/v1/projects/:id/collaborators',
    async (request, reply) => {
      if (!request.user || !(await canViewProject(request.params.id, request.user))) {
        return reply.status(403).send({ error: 'You do not have access to this project' });
      }

      const collaborators = await listProjectCollaborators(request.params.id);
      return reply.send({ collaborators });
    }
  );

  fastify.post<{ Params: { id: string } }>(
    '/api/v1/projects/:id/collaborators',
    async (request, reply) => {
      if (
        !request.user ||
        !(await canManageProjectCollaborators(request.params.id, request.user))
      ) {
        return reply.status(403).send({ error: 'Only project owners can invite collaborators' });
      }

      const body = inviteCollaboratorSchema.parse(request.body);
      const normalizedEmail = body.email.trim().toLowerCase();

      if (normalizedEmail === request.user.email.trim().toLowerCase()) {
        return reply.status(400).send({ error: 'You are already the owner of this project' });
      }

      const [existingUser] = await db
        .select({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
        })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      const [existingCollaborator] = await db
        .select()
        .from(projectCollaborators)
        .where(
          and(
            eq(projectCollaborators.projectId, request.params.id),
            eq(projectCollaborators.email, normalizedEmail)
          )
        )
        .limit(1);

      const collaboratorPayload = {
        projectId: request.params.id,
        email: normalizedEmail,
        role: body.role,
        status: existingUser ? 'active' : 'pending',
        userId: existingUser?.id ?? null,
        invitedBy: request.user.userId,
        acceptedAt: existingUser ? new Date() : null,
        updatedAt: new Date(),
      } as const;

      let collaborator;

      if (existingCollaborator) {
        [collaborator] = await db
          .update(projectCollaborators)
          .set(collaboratorPayload)
          .where(eq(projectCollaborators.id, existingCollaborator.id))
          .returning();
      } else {
        [collaborator] = await db
          .insert(projectCollaborators)
          .values({
            ...collaboratorPayload,
            invitedAt: new Date(),
          })
          .returning();
      }

      return reply.status(201).send({
        collaborator,
        activatedImmediately: Boolean(existingUser),
      });
    }
  );

  fastify.patch<{ Params: { collaboratorId: string } }>(
    '/api/v1/collaborators/:collaboratorId',
    async (request, reply) => {
      const body = updateCollaboratorSchema.parse(request.body);

      const [existing] = await db
        .select()
        .from(projectCollaborators)
        .where(eq(projectCollaborators.id, request.params.collaboratorId))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: 'Collaborator not found' });
      }

      if (
        !request.user ||
        !(await canManageProjectCollaborators(existing.projectId, request.user))
      ) {
        return reply.status(403).send({ error: 'Only project owners can update collaborators' });
      }

      if (!body.role && !body.status) {
        return reply.status(400).send({ error: 'At least one field is required' });
      }

      const [collaborator] = await db
        .update(projectCollaborators)
        .set({
          ...(body.role ? { role: body.role } : {}),
          ...(body.status ? { status: body.status } : {}),
          updatedAt: new Date(),
        })
        .where(eq(projectCollaborators.id, request.params.collaboratorId))
        .returning();

      return reply.send({ collaborator });
    }
  );

  fastify.delete<{ Params: { collaboratorId: string } }>(
    '/api/v1/collaborators/:collaboratorId',
    async (request, reply) => {
      const [existing] = await db
        .select()
        .from(projectCollaborators)
        .where(eq(projectCollaborators.id, request.params.collaboratorId))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: 'Collaborator not found' });
      }

      if (
        !request.user ||
        !(await canManageProjectCollaborators(existing.projectId, request.user))
      ) {
        return reply.status(403).send({ error: 'Only project owners can remove collaborators' });
      }

      if (existing.role === 'owner') {
        return reply.status(400).send({ error: 'Project owner cannot be removed' });
      }

      await db.delete(projectCollaborators).where(eq(projectCollaborators.id, existing.id));
      return reply.send({ success: true });
    }
  );
}
