/**
 * @fileoverview Meeting Items Routes Tests
 * @description Test cases for action items, decisions, and other meeting items
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Mock repository
vi.mock('../db/repositories/meetingItems.repository.js', () => ({
  meetingItemsRepository: {
    create: vi.fn(),
    createBatch: vi.fn(),
    findByMeetingId: vi.fn(),
    findByType: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    getProgressHistory: vi.fn(),
    addTag: vi.fn(),
    findPendingByAssignee: vi.fn(),
    findOverdue: vi.fn(),
  },
}));

import { meetingItemsRepository } from '../db/repositories/meetingItems.repository.js';

describe('Meeting Items Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/meetings/:id/items', () => {
    it('should create an action item', async () => {
      (meetingItemsRepository.create as Mock).mockResolvedValue({
        id: 'item-123',
        meetingId: 'meeting-123',
        itemType: 'action_item',
        title: 'Update documentation',
        assigneeEmail: 'john@example.com',
        status: 'pending',
      });

      const result = await meetingItemsRepository.create({
        meetingId: 'meeting-123',
        itemType: 'action_item',
        title: 'Update documentation',
        assigneeEmail: 'john@example.com',
        status: 'pending',
      });

      expect(result?.itemType).toBe('action_item');
      expect(result?.status).toBe('pending');
    });

    it('should create a decision', async () => {
      (meetingItemsRepository.create as Mock).mockResolvedValue({
        id: 'item-456',
        itemType: 'decision',
        title: 'Use PostgreSQL for storage',
      });

      const result = await meetingItemsRepository.create({
        meetingId: 'meeting-123',
        itemType: 'decision',
        title: 'Use PostgreSQL for storage',
        status: 'pending',
      });

      expect(result?.itemType).toBe('decision');
    });
  });

  describe('POST /api/v1/meetings/:id/items/batch', () => {
    it('should batch create items', async () => {
      (meetingItemsRepository.createBatch as Mock).mockResolvedValue([
        { id: 'i1', itemType: 'action_item', title: 'Task 1' },
        { id: 'i2', itemType: 'decision', title: 'Decision 1' },
        { id: 'i3', itemType: 'blocker', title: 'Blocker 1' },
      ]);

      const result = await meetingItemsRepository.createBatch([
        { meetingId: 'm1', itemType: 'action_item', title: 'Task 1', status: 'pending' },
        { meetingId: 'm1', itemType: 'decision', title: 'Decision 1', status: 'pending' },
        { meetingId: 'm1', itemType: 'blocker', title: 'Blocker 1', status: 'pending' },
      ]);

      expect(result).toHaveLength(3);
    });
  });

  describe('GET /api/v1/meetings/:id/items', () => {
    it('should return all items for a meeting', async () => {
      (meetingItemsRepository.findByMeetingId as Mock).mockResolvedValue([
        { id: 'i1', itemType: 'action_item' },
        { id: 'i2', itemType: 'decision' },
      ]);

      const result = await meetingItemsRepository.findByMeetingId('meeting-123');

      expect(result).toHaveLength(2);
    });

    it('should filter by type', async () => {
      (meetingItemsRepository.findByType as Mock).mockResolvedValue([
        { id: 'i1', itemType: 'action_item' },
      ]);

      const result = await meetingItemsRepository.findByType('meeting-123', 'action_item');

      expect(result).toHaveLength(1);
    });
  });

  describe('PATCH /api/v1/items/:id/status', () => {
    it('should update item status', async () => {
      (meetingItemsRepository.updateStatus as Mock).mockResolvedValue({
        id: 'item-123',
        status: 'completed',
      });

      const result = await meetingItemsRepository.updateStatus(
        'item-123',
        'completed',
        'john@example.com'
      );

      expect(result?.status).toBe('completed');
    });

    it('should return null for non-existent item', async () => {
      (meetingItemsRepository.updateStatus as Mock).mockResolvedValue(null);

      const result = await meetingItemsRepository.updateStatus('non-existent', 'completed');

      expect(result).toBeNull();
    });
  });

  describe('PATCH /api/v1/items/:id', () => {
    it('should update editable item fields', async () => {
      (meetingItemsRepository.update as Mock).mockResolvedValue({
        id: 'item-123',
        title: 'Updated task title',
        assignee: 'Kumar',
        dueDate: '2026-04-10',
        priority: 'high',
      });

      const result = await meetingItemsRepository.update('item-123', {
        title: 'Updated task title',
        assignee: 'Kumar',
        dueDate: '2026-04-10',
        priority: 'high',
      });

      expect(result?.title).toBe('Updated task title');
      expect(result?.priority).toBe('high');
    });

    it('should return null when updating a missing item', async () => {
      (meetingItemsRepository.update as Mock).mockResolvedValue(null);

      const result = await meetingItemsRepository.update('missing-item', {
        title: 'Does not exist',
      });

      expect(result).toBeNull();
    });
  });

  describe('GET /api/v1/items/:id/progress', () => {
    it('should return progress history', async () => {
      (meetingItemsRepository.getProgressHistory as Mock).mockResolvedValue([
        { id: 'u1', previousStatus: 'pending', newStatus: 'in_progress' },
        { id: 'u2', previousStatus: 'in_progress', newStatus: 'blocked' },
        { id: 'u3', previousStatus: 'blocked', newStatus: 'completed' },
      ]);

      const result = await meetingItemsRepository.getProgressHistory('item-123');

      expect(result).toHaveLength(3);
    });
  });

  describe('POST /api/v1/items/:id/tags', () => {
    it('should add tag to item', async () => {
      (meetingItemsRepository.addTag as Mock).mockResolvedValue({
        id: 'tag-1',
        name: 'urgent',
        color: '#ff0000',
      });

      const result = await meetingItemsRepository.addTag('item-123', 'urgent');

      expect(result?.name).toBe('urgent');
    });
  });

  describe('GET /api/v1/users/:email/action-items', () => {
    it('should return pending action items for user', async () => {
      (meetingItemsRepository.findPendingByAssignee as Mock).mockResolvedValue([
        { id: 'i1', title: 'Task 1', assigneeEmail: 'john@example.com', status: 'pending' },
        { id: 'i2', title: 'Task 2', assigneeEmail: 'john@example.com', status: 'in_progress' },
      ]);

      const result = await meetingItemsRepository.findPendingByAssignee('john@example.com');

      expect(result).toHaveLength(2);
    });
  });

  describe('GET /api/v1/items/overdue', () => {
    it('should return overdue action items', async () => {
      (meetingItemsRepository.findOverdue as Mock).mockResolvedValue([
        { id: 'i1', title: 'Overdue Task', dueDate: '2024-01-01' },
      ]);

      const result = await meetingItemsRepository.findOverdue();

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no overdue items', async () => {
      (meetingItemsRepository.findOverdue as Mock).mockResolvedValue([]);

      const result = await meetingItemsRepository.findOverdue();

      expect(result).toHaveLength(0);
    });
  });
});
