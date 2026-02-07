/**
 * @fileoverview Database Schema Index
 * @description Barrel export for all schema definitions
 */

// Enums
export * from './enums.js';

// Organization hierarchy
export * from './organizations.js';

// Meetings
export * from './meetings.js';

// Transcripts
export * from './transcripts.js';

// Minutes of Meeting
export * from './mom.js';

// Meeting items (action items, decisions, etc.)
export * from './meetingItems.js';

// Embeddings (for RAG/semantic search)
export * from './embeddings.js';
