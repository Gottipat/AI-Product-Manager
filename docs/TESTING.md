# Testing Guide

> Comprehensive testing documentation for the AI Backend package.

## Overview

The AI Backend uses **Vitest** as the test framework, providing fast execution with ESM support and excellent TypeScript integration. Tests are organized by module (schema tests) and feature (route tests).

## Running Tests

```bash
# Run all tests
pnpm --filter @meeting-ai/ai-backend test

# Run tests in watch mode
pnpm --filter @meeting-ai/ai-backend test:watch

# Run with coverage
pnpm --filter @meeting-ai/ai-backend test:coverage
```

---

## Test Summary

| Category   | File                    | Tests   | Coverage              |
| ---------- | ----------------------- | ------- | --------------------- |
| **Schema** | `enums.test.ts`         | 9       | Enum validation       |
| **Schema** | `meetings.test.ts`      | 12      | Meeting tables        |
| **Schema** | `transcripts.test.ts`   | 8       | Transcript events     |
| **Schema** | `mom.test.ts`           | 11      | MoM and highlights    |
| **Schema** | `meetingItems.test.ts`  | 16      | Action items, tags    |
| **Schema** | `organizations.test.ts` | 8       | Orgs, teams, projects |
| **Routes** | `meetings.test.ts`      | 10      | Meeting CRUD          |
| **Routes** | `transcripts.test.ts`   | 7       | Transcript streaming  |
| **Routes** | `mom.test.ts`           | 9       | MoM operations        |
| **Routes** | `meetingItems.test.ts`  | 12      | Items lifecycle       |
| **Total**  | **10 files**            | **102** |                       |

---

## Schema Tests

Schema tests validate the Drizzle ORM table definitions without requiring a database connection.

### enums.test.ts (9 tests)

Validates all PostgreSQL enums used across the schema:

| Test                                    | Description                                                      |
| --------------------------------------- | ---------------------------------------------------------------- |
| `meetingStatusEnum` has all statuses    | scheduled, bot_joining, in_progress, completed, cancelled, error |
| `meetingStatusEnum` has exactly 6       | Guard against missing statuses                                   |
| `meetingTypeEnum` includes common types | standup, sprint_planning, retro, etc.                            |
| `meetingTypeEnum` has 12 types          | All 12 meeting types present                                     |
| `meetingItemTypeEnum` has 14 types      | action_item, decision, blocker, risk, etc.                       |
| `priorityEnum` has 4 levels             | low, medium, high, critical                                      |
| `itemStatusEnum` has all statuses       | pending, in_progress, completed, blocked, deferred, cancelled    |
| `highlightTypeEnum` has all types       | executive_summary, key_point, notable_quote, outcome             |

### meetings.test.ts (12 tests)

Validates the meetings, participants, and recurring series tables:

| Test                                 | Description                                  |
| ------------------------------------ | -------------------------------------------- |
| `meetings` has all columns           | id, title, status, googleMeetLink, etc.      |
| `meetings` has foreign keys          | organization, project, recurring series refs |
| `meetings` requires google meet link | Not null constraint                          |
| `meetings` requires title            | Not null constraint                          |
| `meetings` tracks bot session        | botSessionId column                          |
| `meetings` tracks duration           | durationMinutes, startTime, endTime          |
| `participants` has columns           | meetingId, displayName, email, isBot         |
| `participants` requires meetingId    | Foreign key constraint                       |
| `participants` requires displayName  | Not null constraint                          |
| `participants` tracks bot status     | isBot boolean field                          |
| `recurringSeries` has columns        | title, recurrencePattern                     |
| `recurringSeries` refs organization  | Foreign key to organizations                 |

### transcripts.test.ts (8 tests)

Validates the transcript events table:

| Test                               | Description                           |
| ---------------------------------- | ------------------------------------- |
| `transcriptEvents` has all columns | id, meetingId, speaker, content, etc. |
| Requires meeting reference         | meetingId foreign key                 |
| Requires speaker name              | speaker not null                      |
| Requires content                   | content not null                      |
| Requires sequence number           | For ordering events                   |
| Requires captured timestamp        | capturedAt not null                   |
| Optional speaker ID                | speakerId nullable                    |
| Optional confidence score          | confidence nullable                   |

### mom.test.ts (11 tests)

Validates the Minutes of Meeting and highlights tables:

| Test                            | Description                                        |
| ------------------------------- | -------------------------------------------------- |
| `moms` has all columns          | meetingId, executiveSummary, detailedSummary, etc. |
| Requires meeting reference      | meetingId foreign key                              |
| Unique meeting reference        | One MoM per meeting                                |
| Tracks AI model version         | aiModelVersion column                              |
| Tracks processing performance   | processingTimeMs column                            |
| `meetingHighlights` has columns | highlightType, content, importance                 |
| Requires meeting reference      | meetingId foreign key                              |
| Requires highlight type         | highlightType enum                                 |
| Requires content                | content not null                                   |
| Supports keywords array         | keywords text[] for search                         |
| Optional MoM reference          | momId nullable                                     |

### meetingItems.test.ts (16 tests)

Validates action items, progress tracking, and tagging:

| Test                           | Description                                |
| ------------------------------ | ------------------------------------------ |
| `meetingItems` has all columns | itemType, title, assignee, dueDate, etc.   |
| Requires meeting reference     | meetingId foreign key                      |
| Requires item type             | itemType enum                              |
| Requires title                 | title not null                             |
| Optional project reference     | projectId nullable                         |
| Supports JSONB metadata        | metadata column for type-specific data     |
| Tracks transcript source       | sourceTranscriptRange jsonb                |
| `progressUpdates` has columns  | previousStatus, newStatus, percentComplete |
| Requires meeting item ref      | meetingItemId foreign key                  |
| Requires meeting ref           | meetingId foreign key                      |
| Requires new status            | newStatus enum                             |
| `tags` has columns             | name, color                                |
| Unique tag name                | name unique constraint                     |
| Requires tag name              | name not null                              |
| `meetingItemTags` has item ref | Junction table meetingItemId               |
| `meetingItemTags` has tag ref  | Junction table tagId                       |

### organizations.test.ts (8 tests)

Validates organizations, teams, and projects:

| Test                        | Description                  |
| --------------------------- | ---------------------------- |
| `organizations` has columns | id, name, slug               |
| id is primary key           | UUID primary key             |
| slug is unique              | For URL-friendly identifiers |
| `teams` has columns         | name, organizationId         |
| `teams` refs organizations  | Foreign key constraint       |
| `teamMembers` has columns   | teamId, email, role          |
| `projects` has columns      | name, organizationId, teamId |
| `projects` optional teamId  | teamId nullable              |

---

## Route Tests

Route tests validate API endpoint behavior by mocking repository methods.

### meetings.test.ts (10 tests)

| Endpoint                          | Test                               | Description                            |
| --------------------------------- | ---------------------------------- | -------------------------------------- |
| `POST /meetings`                  | Creates with required fields       | title + googleMeetLink creates meeting |
| `POST /meetings`                  | Fails without required fields      | Validation error                       |
| `GET /meetings/:id`               | Returns meeting by ID              | Includes meeting data                  |
| `GET /meetings/:id`               | Returns undefined for non-existent | 404 case                               |
| `POST /meetings/:id/start`        | Updates to in_progress             | Starts meeting                         |
| `POST /meetings/:id/complete`     | Completes with duration            | Calculates durationMinutes             |
| `POST /meetings/:id/complete`     | Returns null if not found          | Error case                             |
| `POST /meetings/:id/participants` | Adds participant                   | Creates participant record             |
| `GET /meetings/:id/participants`  | Returns all participants           | List of participants                   |
| `GET /orgs/:orgId/meetings`       | Returns recent for org             | Paginated meetings                     |

### transcripts.test.ts (7 tests)

| Endpoint                                   | Test                          | Description                  |
| ------------------------------------------ | ----------------------------- | ---------------------------- |
| `POST /meetings/:id/transcripts`           | Creates single event          | Single transcript insert     |
| `POST /meetings/:id/transcripts/batch`     | Batch inserts events          | Multiple events at once      |
| `POST /meetings/:id/transcripts/batch`     | Returns empty for empty input | Edge case                    |
| `GET /meetings/:id/transcripts`            | Returns ordered by sequence   | Chronological order          |
| `GET /meetings/:id/transcripts/text`       | Returns formatted text        | "Speaker: content" format    |
| `GET /meetings/:id/transcripts/by-speaker` | Groups by speaker             | Object keyed by speaker name |
| `GET /meetings/:id/transcripts/latest`     | Returns latest N events       | Reverse chronological        |

### mom.test.ts (9 tests)

| Endpoint                              | Test                      | Description               |
| ------------------------------------- | ------------------------- | ------------------------- |
| `POST /meetings/:id/mom`              | Creates new MoM           | Insert new record         |
| `POST /meetings/:id/mom`              | Updates existing MoM      | Upsert behavior           |
| `GET /meetings/:id/mom`               | Returns with highlights   | Includes highlights array |
| `GET /meetings/:id/mom`               | Returns undefined if none | 404 case                  |
| `POST /meetings/:id/highlights`       | Adds highlight            | Single highlight insert   |
| `POST /meetings/:id/highlights/batch` | Batch adds highlights     | Multiple highlights       |
| `GET /meetings/:id/highlights`        | Returns all highlights    | Unfiltered list           |
| `GET /meetings/:id/highlights`        | Filters by type           | Query param filtering     |
| `GET /mom/recent`                     | Returns recent MoMs       | Paginated list            |

### meetingItems.test.ts (12 tests)

| Endpoint                         | Test                      | Description            |
| -------------------------------- | ------------------------- | ---------------------- |
| `POST /meetings/:id/items`       | Creates action item       | itemType=action_item   |
| `POST /meetings/:id/items`       | Creates decision          | itemType=decision      |
| `POST /meetings/:id/items/batch` | Batch creates items       | Multiple items at once |
| `GET /meetings/:id/items`        | Returns all items         | Full list              |
| `GET /meetings/:id/items`        | Filters by type           | Query param filtering  |
| `PATCH /items/:id/status`        | Updates status            | Status transition      |
| `PATCH /items/:id/status`        | Returns null if not found | Error case             |
| `GET /items/:id/progress`        | Returns progress history  | Status transition log  |
| `POST /items/:id/tags`           | Adds tag to item          | Creates or links tag   |
| `GET /users/:email/action-items` | Returns pending for user  | User's assigned items  |
| `GET /items/overdue`             | Returns overdue items     | Past due date          |
| `GET /items/overdue`             | Returns empty array       | No overdue items case  |

---

## Test Patterns

### Mocking Repositories

Route tests use Vitest's `vi.mock()` to mock repository methods:

```typescript
import { vi, type Mock } from 'vitest';

vi.mock('../db/repositories/meeting.repository.js', () => ({
  meetingRepository: {
    create: vi.fn(),
    findById: vi.fn(),
  },
}));

// In tests:
(meetingRepository.create as Mock).mockResolvedValue({ id: '123' });
```

### Testing Schema Columns

Schema tests validate Drizzle table definitions:

```typescript
import { meetings } from '../schema/meetings.js';

it('should have required columns', () => {
  expect(meetings.id).toBeDefined();
  expect(meetings.title).toBeDefined();
  expect(meetings.googleMeetLink).toBeDefined();
});
```

---

## CI/CD Integration

Tests run automatically via the pre-push hook:

```bash
pnpm run pre-push
# Runs: lint → format:check → build (includes tsc type checking)
```

Tests are also run separately:

```bash
pnpm --filter @meeting-ai/ai-backend test
```
