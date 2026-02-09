/**
 * @fileoverview Database Schema - Organizations & Teams
 * @description Organizational hierarchy tables
 */

import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core';

// Organizations table (top-level entity)
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logoUrl: text('logo_url'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Teams within organizations
export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Team members
export const teamMembers = pgTable('team_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teams.id),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  role: text('role'), // 'lead', 'member', etc.
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

// Projects
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  teamId: uuid('team_id').references(() => teams.id),
  createdBy: uuid('created_by'), // User who created the project
  name: text('name').notNull(),
  description: text('description'),
  googleMeetLink: text('google_meet_link'), // Associated meeting link
  isRecurring: boolean('is_recurring').default(false).notNull(), // Recurring meeting flag
  status: text('status').default('active'), // 'active', 'completed', 'archived'
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  teams: many(teams),
  projects: many(projects),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [teams.organizationId],
    references: [organizations.id],
  }),
  members: many(teamMembers),
  projects: many(projects),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  team: one(teams, {
    fields: [projects.teamId],
    references: [teams.id],
  }),
}));
