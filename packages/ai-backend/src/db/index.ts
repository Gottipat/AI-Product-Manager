/**
 * @fileoverview Database Client
 * @description Drizzle ORM client with connection pooling
 *
 * Usage:
 *   import { db } from './db';
 *   const meetings = await db.query.meetings.findMany();
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema/index.js';

// Get database URL from environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Create postgres client with connection pooling
const client = postgres(connectionString, {
  max: 10, // Maximum connections in pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout
});

// Create Drizzle ORM instance with schema for relational queries
export const db = drizzle(client, { schema });

// Export schema for type inference
export { schema };

// Export type utilities
export type Database = typeof db;
