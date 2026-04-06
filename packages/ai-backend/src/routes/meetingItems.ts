/**
 * @fileoverview Meeting Items Routes
 * @description REST API endpoints for action items, decisions, blockers, etc.
 */

import { FastifyInstance } from 'fastify';

import {
  meetingItemsRepository,
  type NewMeetingItem,
} from '../db/repositories/meetingItems.repository.js';

// Request types
interface CreateItemBody {
  itemType:
    | 'action_item'
    | 'decision'
    | 'blocker'
    | 'risk'
    | 'announcement'
    | 'project_update'
    | 'idea'
    | 'question'
    | 'commitment'
    | 'deadline'
    | 'dependency'
    | 'parking_lot'
    | 'key_takeaway'
    | 'reference';
  title: string;
  description?: string;
  assigneeEmail?: string;
  assignee?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  projectId?: string;
}

interface CreateItemsBatchBody {
  items: CreateItemBody[];
}

interface UpdateStatusBody {
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'deferred' | 'cancelled';
  updatedBy?: string;
}

interface UpdateItemBody {
  title?: string;
  description?: string | null;
  assignee?: string | null;
  assigneeEmail?: string | null;
  dueDate?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'critical' | null;
}

export async function meetingItemsRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/meetings/:id/items
   * Create a meeting item
   */
  fastify.post<{ Params: { id: string }; Body: CreateItemBody }>(
    '/api/v1/meetings/:id/items',
    async (request, reply) => {
      const {
        itemType,
        title,
        description,
        assigneeEmail,
        assignee,
        dueDate,
        priority,
        projectId,
      } = request.body;

      if (!itemType || !title) {
        return reply.status(400).send({ error: 'itemType and title are required' });
      }

      const itemData: NewMeetingItem = {
        meetingId: request.params.id,
        itemType,
        title,
        description: description || null,
        assigneeEmail: assigneeEmail || null,
        assignee: assignee || null,
        dueDate: dueDate || null,
        priority: priority || null,
        projectId: projectId || null,
        status: 'pending',
      };

      const item = await meetingItemsRepository.create(itemData);
      return reply.status(201).send({ item });
    }
  );

  /**
   * POST /api/v1/meetings/:id/items/batch
   * Batch create meeting items
   */
  fastify.post<{ Params: { id: string }; Body: CreateItemsBatchBody }>(
    '/api/v1/meetings/:id/items/batch',
    async (request, reply) => {
      const { items } = request.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return reply.status(400).send({ error: 'items array is required' });
      }

      const itemData: NewMeetingItem[] = items.map((i) => ({
        meetingId: request.params.id,
        itemType: i.itemType,
        title: i.title,
        description: i.description || null,
        assigneeEmail: i.assigneeEmail || null,
        assignee: i.assignee || null,
        dueDate: i.dueDate || null,
        priority: i.priority || null,
        projectId: i.projectId || null,
        status: 'pending',
      }));

      const inserted = await meetingItemsRepository.createBatch(itemData);
      return reply.status(201).send({
        inserted: inserted.length,
        items: inserted,
      });
    }
  );

  /**
   * GET /api/v1/meetings/:id/items
   * Get all items for a meeting
   */
  fastify.get<{ Params: { id: string }; Querystring: { type?: string } }>(
    '/api/v1/meetings/:id/items',
    async (request) => {
      const { type } = request.query;

      if (type) {
        const items = await meetingItemsRepository.findByType(
          request.params.id,
          type as NewMeetingItem['itemType']
        );
        return { items };
      }

      const items = await meetingItemsRepository.findByMeetingId(request.params.id);
      return { items };
    }
  );

  /**
   * GET /api/v1/items/:id
   * Get item by ID
   */
  fastify.get<{ Params: { id: string } }>('/api/v1/items/:id', async (request, reply) => {
    const item = await meetingItemsRepository.findById(request.params.id);
    if (!item) {
      return reply.status(404).send({ error: 'Item not found' });
    }
    return { item };
  });

  /**
   * PATCH /api/v1/items/:id
   * Update editable item fields
   */
  fastify.patch<{ Params: { id: string }; Body: UpdateItemBody }>(
    '/api/v1/items/:id',
    async (request, reply) => {
      const { title, description, assignee, assigneeEmail, dueDate, priority } = request.body;

      if (
        title === undefined &&
        description === undefined &&
        assignee === undefined &&
        assigneeEmail === undefined &&
        dueDate === undefined &&
        priority === undefined
      ) {
        return reply.status(400).send({ error: 'At least one editable field is required' });
      }

      const updateData: UpdateItemBody = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (assignee !== undefined) updateData.assignee = assignee;
      if (assigneeEmail !== undefined) updateData.assigneeEmail = assigneeEmail;
      if (dueDate !== undefined) updateData.dueDate = dueDate;
      if (priority !== undefined) updateData.priority = priority;

      const item = await meetingItemsRepository.update(request.params.id, updateData);

      if (!item) {
        return reply.status(404).send({ error: 'Item not found' });
      }

      return { item };
    }
  );

  /**
   * PATCH /api/v1/items/:id/status
   * Update item status
   */
  fastify.patch<{ Params: { id: string }; Body: UpdateStatusBody }>(
    '/api/v1/items/:id/status',
    async (request, reply) => {
      const { status, updatedBy } = request.body;

      if (!status) {
        return reply.status(400).send({ error: 'status is required' });
      }

      const item = await meetingItemsRepository.updateStatus(request.params.id, status, updatedBy);
      if (!item) {
        return reply.status(404).send({ error: 'Item not found' });
      }
      return { item };
    }
  );

  /**
   * GET /api/v1/items/:id/progress
   * Get progress history for an item
   */
  fastify.get<{ Params: { id: string } }>('/api/v1/items/:id/progress', async (request) => {
    const updates = await meetingItemsRepository.getProgressHistory(request.params.id);
    return { updates };
  });

  /**
   * POST /api/v1/items/:id/tags
   * Add tag to item
   */
  fastify.post<{ Params: { id: string }; Body: { tag: string } }>(
    '/api/v1/items/:id/tags',
    async (request, reply) => {
      const { tag } = request.body;
      if (!tag) {
        return reply.status(400).send({ error: 'tag is required' });
      }

      const addedTag = await meetingItemsRepository.addTag(request.params.id, tag);
      return reply.status(201).send({ tag: addedTag });
    }
  );

  /**
   * GET /api/v1/users/:email/action-items
   * Get pending action items for a user
   */
  fastify.get<{ Params: { email: string } }>(
    '/api/v1/users/:email/action-items',
    async (request) => {
      const items = await meetingItemsRepository.findPendingByAssignee(request.params.email);
      return { items };
    }
  );

  /**
   * GET /api/v1/items/overdue
   * Get all overdue action items
   */
  fastify.get('/api/v1/items/overdue', async () => {
    const items = await meetingItemsRepository.findOverdue();
    return { items };
  });
}
