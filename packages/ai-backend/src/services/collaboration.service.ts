/**
 * @fileoverview Collaboration Service
 * @description Project access control and collaborator synchronization helpers
 */

import { and, eq, inArray, isNull, or } from 'drizzle-orm';

import { db } from '../db/index.js';
import { meetings, projectCollaborators, projects, users } from '../db/schema/index.js';

export interface AuthenticatedUserContext {
  userId: string;
  email: string;
  organizationId?: string;
  role: string;
}

export type ProjectAccessRole = 'owner' | 'editor' | 'viewer' | null;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function activatePendingCollaborationsForUser(args: {
  userId: string;
  email: string;
}): Promise<void> {
  const normalizedEmail = normalizeEmail(args.email);

  await db
    .update(projectCollaborators)
    .set({
      userId: args.userId,
      status: 'active',
      acceptedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(projectCollaborators.email, normalizedEmail),
        or(eq(projectCollaborators.status, 'pending'), eq(projectCollaborators.status, 'active'))
      )
    );
}

export async function getAccessibleProjectIds(user: AuthenticatedUserContext): Promise<string[]> {
  const normalizedEmail = normalizeEmail(user.email);

  const directProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.createdBy, user.userId));

  const collaboratorProjects = await db
    .select({ id: projectCollaborators.projectId })
    .from(projectCollaborators)
    .where(
      and(
        eq(projectCollaborators.status, 'active'),
        or(
          eq(projectCollaborators.userId, user.userId),
          eq(projectCollaborators.email, normalizedEmail)
        )
      )
    );

  if (user.organizationId) {
    const legacyProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.organizationId, user.organizationId), isNull(projects.createdBy)));

    return Array.from(
      new Set([
        ...directProjects.map((project) => project.id),
        ...collaboratorProjects.map((project) => project.id),
        ...legacyProjects.map((project) => project.id),
      ])
    );
  }

  return Array.from(
    new Set([
      ...directProjects.map((project) => project.id),
      ...collaboratorProjects.map((project) => project.id),
    ])
  );
}

export async function getProjectAccess(
  projectId: string,
  user: AuthenticatedUserContext
): Promise<ProjectAccessRole> {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

  if (!project) {
    return null;
  }

  if (project.createdBy === user.userId) {
    return 'owner';
  }

  if (
    user.role === 'admin' &&
    user.organizationId &&
    project.organizationId === user.organizationId
  ) {
    return 'owner';
  }

  const normalizedEmail = normalizeEmail(user.email);
  const [collaborator] = await db
    .select({
      role: projectCollaborators.role,
      status: projectCollaborators.status,
    })
    .from(projectCollaborators)
    .where(
      and(
        eq(projectCollaborators.projectId, projectId),
        eq(projectCollaborators.status, 'active'),
        or(
          eq(projectCollaborators.userId, user.userId),
          eq(projectCollaborators.email, normalizedEmail)
        )
      )
    )
    .limit(1);

  if (
    collaborator?.role === 'owner' ||
    collaborator?.role === 'editor' ||
    collaborator?.role === 'viewer'
  ) {
    return collaborator.role;
  }

  if (
    project.createdBy == null &&
    user.organizationId &&
    project.organizationId === user.organizationId
  ) {
    return 'editor';
  }

  return null;
}

export async function canViewProject(
  projectId: string,
  user: AuthenticatedUserContext
): Promise<boolean> {
  const access = await getProjectAccess(projectId, user);
  return access !== null;
}

export async function canEditProject(
  projectId: string,
  user: AuthenticatedUserContext
): Promise<boolean> {
  const access = await getProjectAccess(projectId, user);
  return access === 'owner' || access === 'editor';
}

export async function canManageProjectCollaborators(
  projectId: string,
  user: AuthenticatedUserContext
): Promise<boolean> {
  const access = await getProjectAccess(projectId, user);
  return access === 'owner';
}

export async function canViewMeeting(
  meetingId: string,
  user: AuthenticatedUserContext
): Promise<boolean> {
  const [meeting] = await db
    .select({
      id: meetings.id,
      projectId: meetings.projectId,
      organizationId: meetings.organizationId,
    })
    .from(meetings)
    .where(eq(meetings.id, meetingId))
    .limit(1);

  if (!meeting) {
    return false;
  }

  if (meeting.projectId) {
    return canViewProject(meeting.projectId, user);
  }

  return Boolean(user.organizationId && meeting.organizationId === user.organizationId);
}

export async function canEditMeeting(
  meetingId: string,
  user: AuthenticatedUserContext
): Promise<boolean> {
  const [meeting] = await db
    .select({
      id: meetings.id,
      projectId: meetings.projectId,
      organizationId: meetings.organizationId,
    })
    .from(meetings)
    .where(eq(meetings.id, meetingId))
    .limit(1);

  if (!meeting) {
    return false;
  }

  if (meeting.projectId) {
    return canEditProject(meeting.projectId, user);
  }

  return Boolean(user.organizationId && meeting.organizationId === user.organizationId);
}

export async function listProjectCollaborators(projectId: string) {
  return db
    .select({
      id: projectCollaborators.id,
      projectId: projectCollaborators.projectId,
      userId: projectCollaborators.userId,
      email: projectCollaborators.email,
      role: projectCollaborators.role,
      status: projectCollaborators.status,
      invitedBy: projectCollaborators.invitedBy,
      invitedAt: projectCollaborators.invitedAt,
      acceptedAt: projectCollaborators.acceptedAt,
      createdAt: projectCollaborators.createdAt,
      updatedAt: projectCollaborators.updatedAt,
      displayName: users.displayName,
    })
    .from(projectCollaborators)
    .leftJoin(users, eq(projectCollaborators.userId, users.id))
    .where(eq(projectCollaborators.projectId, projectId));
}

export async function listAccessibleProjectsWithAccess(user: AuthenticatedUserContext) {
  const projectIds = await getAccessibleProjectIds(user);
  if (projectIds.length === 0) {
    return [];
  }

  const accessibleProjects = await db
    .select()
    .from(projects)
    .where(inArray(projects.id, projectIds));

  const accessByProject = new Map<string, ProjectAccessRole>();
  await Promise.all(
    accessibleProjects.map(async (project) => {
      accessByProject.set(project.id, await getProjectAccess(project.id, user));
    })
  );

  return accessibleProjects.map((project) => ({
    ...project,
    accessRole: accessByProject.get(project.id) ?? 'viewer',
  }));
}
