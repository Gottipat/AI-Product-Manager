/**
 * @fileoverview OpenAI Service Tests
 * @description Unit tests for Zod schemas and token utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock OpenAI before importing the service to prevent API key check
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: vi.fn() } },
    embeddings: { create: vi.fn() },
  })),
}));

import {
  ExecutiveSummarySchema,
  HighlightSchema,
  ActionItemSchema,
  MoMResponseSchema,
  OpenAIService,
} from './openai.service.js';

// We test the schemas and utilities directly
// Full API mocking would require dependency injection refactor

describe('OpenAI Service', () => {
  describe('Zod Schemas', () => {
    describe('ExecutiveSummarySchema', () => {
      it('should validate a correct executive summary', () => {
        const validSummary = {
          summary: 'Team discussed Q1 priorities and budget allocation.',
          mainTopics: ['Q1 Planning', 'Budget', 'Hiring'],
          sentiment: 'positive',
          participantCount: 5,
        };

        expect(() => ExecutiveSummarySchema.parse(validSummary)).not.toThrow();
      });

      it('should reject invalid sentiment', () => {
        const invalidSummary = {
          summary: 'Test',
          mainTopics: [],
          sentiment: 'invalid',
        };

        expect(() => ExecutiveSummarySchema.parse(invalidSummary)).toThrow();
      });
    });

    describe('HighlightSchema', () => {
      it('should validate correct highlight types', () => {
        const validHighlights = ['executive_summary', 'key_point', 'notable_quote', 'outcome'];

        validHighlights.forEach((type) => {
          const highlight = {
            highlightType: type,
            content: 'Test content',
            importance: 5,
            keywords: ['test'],
          };
          expect(() => HighlightSchema.parse(highlight)).not.toThrow();
        });
      });

      it('should reject invalid highlight type', () => {
        const invalidHighlight = {
          highlightType: 'invalid_type',
          content: 'Test',
          importance: 5,
          keywords: [],
        };

        expect(() => HighlightSchema.parse(invalidHighlight)).toThrow();
      });

      it('should require importance between 1-10', () => {
        const tooLow = {
          highlightType: 'key_point',
          content: 'Test',
          importance: 0,
          keywords: [],
        };
        const tooHigh = {
          highlightType: 'key_point',
          content: 'Test',
          importance: 11,
          keywords: [],
        };

        expect(() => HighlightSchema.parse(tooLow)).toThrow();
        expect(() => HighlightSchema.parse(tooHigh)).toThrow();
      });
    });

    describe('ActionItemSchema', () => {
      it('should validate all 14 item types', () => {
        const validTypes = [
          'action_item',
          'decision',
          'announcement',
          'project_update',
          'blocker',
          'idea',
          'question',
          'risk',
          'commitment',
          'deadline',
          'dependency',
          'parking_lot',
          'key_takeaway',
          'reference',
        ];

        validTypes.forEach((type) => {
          const item = {
            itemType: type,
            title: 'Test item',
          };
          expect(() => ActionItemSchema.parse(item)).not.toThrow();
        });
      });

      it('should validate priority levels', () => {
        const priorities = ['low', 'medium', 'high', 'critical'];

        priorities.forEach((priority) => {
          const item = {
            itemType: 'action_item',
            title: 'Test',
            priority,
          };
          expect(() => ActionItemSchema.parse(item)).not.toThrow();
        });
      });

      it('should validate optional assignee email', () => {
        const validItem = {
          itemType: 'action_item',
          title: 'Test',
          assigneeEmail: 'test@example.com',
        };
        const invalidEmail = {
          itemType: 'action_item',
          title: 'Test',
          assigneeEmail: 'not-an-email',
        };

        expect(() => ActionItemSchema.parse(validItem)).not.toThrow();
        expect(() => ActionItemSchema.parse(invalidEmail)).toThrow();
      });

      it('should validate confidence and transcript ranges', () => {
        const validItem = {
          itemType: 'action_item',
          title: 'Follow up with finance',
          aiConfidence: 0.86,
          sourceTranscriptRange: {
            startSeq: 12,
            endSeq: 14,
          },
        };

        expect(() => ActionItemSchema.parse(validItem)).not.toThrow();
      });

      it('should enforce max title length of 200', () => {
        const tooLong = {
          itemType: 'action_item',
          title: 'x'.repeat(201),
        };

        expect(() => ActionItemSchema.parse(tooLong)).toThrow();
      });
    });

    describe('MoMResponseSchema', () => {
      it('should validate a complete MoM response', () => {
        const validMoM = {
          executiveSummary: 'Team met to discuss Q1 planning.',
          mainTopics: ['Budget', 'Hiring'],
          overallConfidence: 0.9,
          highlights: [
            {
              highlightType: 'key_point',
              content: 'Budget approved',
              importance: 9,
              keywords: ['budget'],
            },
          ],
          items: [
            {
              itemType: 'action_item',
              title: 'Submit report',
            },
          ],
        };

        expect(() => MoMResponseSchema.parse(validMoM)).not.toThrow();
      });
    });
  });

  describe('Token Utilities', () => {
    let service: OpenAIService;

    beforeEach(() => {
      service = new OpenAIService();
    });

    describe('estimateTokens', () => {
      it('should estimate token count (~4 chars per token)', () => {
        const text = 'This is a test sentence with some words.';
        const tokens = service.estimateTokens(text);

        // 41 chars / 4 = ~10 tokens
        expect(tokens).toBeGreaterThan(5);
        expect(tokens).toBeLessThan(20);
      });

      it('should handle empty string', () => {
        expect(service.estimateTokens('')).toBe(0);
      });
    });

    describe('fitsInContext', () => {
      it('should return true for short text', () => {
        expect(service.fitsInContext('Hello world')).toBe(true);
      });

      it('should return false for very long text', () => {
        const longText = 'x'.repeat(1000000);
        expect(service.fitsInContext(longText, 1000)).toBe(false);
      });

      it('should use default max tokens of 128000', () => {
        // 512000 chars / 4 = 128000 tokens (right at limit)
        const atLimit = 'x'.repeat(512000);
        expect(service.fitsInContext(atLimit)).toBe(false);

        const belowLimit = 'x'.repeat(400000);
        expect(service.fitsInContext(belowLimit)).toBe(true);
      });
    });
  });
});
