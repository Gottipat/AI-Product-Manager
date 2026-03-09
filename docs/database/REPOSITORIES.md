# Repository Layer

> Data access layer for the AI Backend database.

## Overview

The repository layer provides type-safe CRUD operations for all database tables using Drizzle ORM.

## Available Repositories

| Repository               | File                         | Purpose                                  |
| ------------------------ | ---------------------------- | ---------------------------------------- |
| `meetingRepository`      | `meeting.repository.ts`      | Meetings, participants, recurring series |
| `transcriptRepository`   | `transcript.repository.ts`   | Transcript events (captions)             |
| `momRepository`          | `mom.repository.ts`          | Minutes of Meeting, highlights           |
| `meetingItemsRepository` | `meetingItems.repository.ts` | Action items, decisions, blockers        |

---

## Usage Examples

### Meeting Operations

```typescript
import { meetingRepository } from './db/repositories';

// Create a meeting
const meeting = await meetingRepository.create({
  title: 'Sprint Planning',
  googleMeetLink: 'https://meet.google.com/abc-defg-hij',
  organizationId: 'org-123',
});

// Find by ID (with relations)
const fullMeeting = await meetingRepository.findById(meeting.id);

// Update status
await meetingRepository.updateStatus(meeting.id, 'in_progress');

// Complete meeting
await meetingRepository.complete(meeting.id, new Date());

// Add participant
await meetingRepository.addParticipant({
  meetingId: meeting.id,
  displayName: 'John Doe',
  email: 'john@example.com',
});
```

### Transcript Operations

```typescript
import { transcriptRepository } from './db/repositories';

// Batch insert (efficient for streaming)
await transcriptRepository.createBatch([
  {
    meetingId,
    speaker: 'Alice',
    content: 'Hello everyone',
    sequenceNumber: 1,
    capturedAt: new Date(),
  },
  { meetingId, speaker: 'Bob', content: 'Hi Alice!', sequenceNumber: 2, capturedAt: new Date() },
]);

// Get full transcript as text (for AI)
const text = await transcriptRepository.getTranscriptText(meetingId);
// "Alice: Hello everyone\nBob: Hi Alice!"

// Get grouped by speaker
const bySpeaker = await transcriptRepository.getTranscriptBySpeaker(meetingId);
// { "Alice": [...], "Bob": [...] }
```

### MoM Operations

```typescript
import { momRepository } from './db/repositories';

// Create or update MoM
await momRepository.upsert({
  meetingId,
  executiveSummary: 'Team discussed Q1 priorities...',
  detailedSummary: 'Full summary here...',
  aiModelVersion: 'gpt-4-turbo',
});

// Add highlights
await momRepository.addHighlights([
  { meetingId, highlightType: 'key_point', content: 'Decided to launch feature X' },
  { meetingId, highlightType: 'outcome', content: 'Release scheduled for March 1' },
]);
```

### Meeting Items Operations

```typescript
import { meetingItemsRepository } from './db/repositories';

// Batch create items
await meetingItemsRepository.createBatch([
  { meetingId, itemType: 'action_item', title: 'Update docs', assigneeEmail: 'john@example.com' },
  { meetingId, itemType: 'decision', title: 'Use PostgreSQL for storage' },
]);

// Find pending action items for a person
const pending = await meetingItemsRepository.findPendingByAssignee('john@example.com');

// Update status with progress tracking
await meetingItemsRepository.updateStatus(itemId, 'completed', 'john@example.com');
```

---

## API Reference

### MeetingRepository

| Method                        | Description                               |
| ----------------------------- | ----------------------------------------- |
| `create(data)`                | Create a new meeting                      |
| `findById(id)`                | Find meeting with participants and series |
| `findByMeetLink(link)`        | Find by Google Meet link                  |
| `updateStatus(id, status)`    | Update meeting status                     |
| `complete(id, endTime?)`      | Mark meeting complete, calculate duration |
| `findRecent(orgId, limit?)`   | Get recent meetings for organization      |
| `addParticipant(data)`        | Add participant to meeting                |
| `updateParticipant(id, data)` | Update participant details                |
| `delete(id)`                  | Delete a meeting                          |

### TranscriptRepository

| Method                       | Description                        |
| ---------------------------- | ---------------------------------- |
| `create(data)`               | Insert single transcript event     |
| `createBatch(events)`        | Batch insert (streaming)           |
| `findByMeetingId(id)`        | Get all events ordered by sequence |
| `findLatest(id, limit?)`     | Get latest N events                |
| `getTranscriptText(id)`      | Get full transcript as string      |
| `getTranscriptBySpeaker(id)` | Group events by speaker            |

### MomRepository

| Method                          | Description               |
| ------------------------------- | ------------------------- |
| `upsert(data)`                  | Create or update MoM      |
| `findByMeetingId(id)`           | Get MoM with highlights   |
| `addHighlight(data)`            | Add single highlight      |
| `addHighlights(data[])`         | Batch add highlights      |
| `getHighlightsByType(id, type)` | Filter highlights by type |

### MeetingItemsRepository

| Method                          | Description                   |
| ------------------------------- | ----------------------------- |
| `create(data)`                  | Create single item            |
| `createBatch(items)`            | Batch create items            |
| `findByType(meetingId, type)`   | Filter by item type           |
| `findPendingByAssignee(email)`  | Get pending action items      |
| `findOverdue()`                 | Get overdue action items      |
| `updateStatus(id, status, by?)` | Update with progress tracking |
| `addTag(itemId, tagName)`       | Tag an item                   |
