/**
 * @fileoverview Database Schema - Users
 * @description User authentication and profile tables
 */

import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core';

import { organizations } from './organizations';

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  role: text('role').default('member').notNull(), // 'admin', 'member'
  isActive: boolean('is_active').default(true).notNull(),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
}));

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
