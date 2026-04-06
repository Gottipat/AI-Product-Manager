/**
 * @fileoverview Database Schema - Collaboration
 * @description Project collaborator and invitation tables
 */

import { relations } from 'drizzle-orm';
import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { projects } from './organizations.js';
import { users } from './users.js';

export const projectCollaborators = pgTable(
  'project_collaborators',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    userId: uuid('user_id').references(() => users.id),
    email: text('email').notNull(),
    role: text('role').default('viewer').notNull(), // owner | editor | viewer
    status: text('status').default('pending').notNull(), // pending | active | revoked
    invitedBy: uuid('invited_by').references(() => users.id),
    invitedAt: timestamp('invited_at').defaultNow().notNull(),
    acceptedAt: timestamp('accepted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    projectEmailUnique: uniqueIndex('project_collaborators_project_email_unique').on(
      table.projectId,
      table.email
    ),
  })
);

export const projectCollaboratorsRelations = relations(projectCollaborators, ({ one }) => ({
  project: one(projects, {
    fields: [projectCollaborators.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectCollaborators.userId],
    references: [users.id],
  }),
  inviter: one(users, {
    fields: [projectCollaborators.invitedBy],
    references: [users.id],
  }),
}));

export type ProjectCollaborator = typeof projectCollaborators.$inferSelect;
export type NewProjectCollaborator = typeof projectCollaborators.$inferInsert;
