# API Endpoints Reference

> REST API documentation for the AI Backend.

## Base URL

```
http://localhost:3000/api/v1
```

## Authentication

> **TODO**: Authentication will be added in a future sprint.

---

## Health Check

### GET /health

Check service status.

**Response:**

```json
{
  "status": "healthy",
  "version": "0.0.1",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": ["database", "meetings", "transcripts", "mom", "items"]
}
```

---

## Meetings

### POST /meetings

Create a new meeting.

**Request:**

```json
{
  "title": "Sprint Planning",
  "googleMeetLink": "https://meet.google.com/abc-defg-hij",
  "organizationId": "uuid",
  "meetingType": "standup",
  "startTime": "2024-01-15T14:00:00Z"
}
```

**Response:** `201 Created`

```json
{
  "meeting": {
    "id": "uuid",
    "title": "Sprint Planning",
    "googleMeetLink": "https://meet.google.com/abc-defg-hij",
    "status": "scheduled",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### GET /meetings/:id

Get meeting details with participants.

**Response:**

```json
{
  "meeting": {
    "id": "uuid",
    "title": "Sprint Planning",
    "status": "in_progress",
    "participants": [{ "id": "uuid", "displayName": "John Doe", "email": "john@example.com" }]
  }
}
```

---

### POST /meetings/:id/start

Start a meeting (transition to `in_progress`).

**Response:**

```json
{ "meeting": { "id": "uuid", "status": "in_progress" } }
```

---

### PATCH /meetings/:id/status

Update meeting status.

**Request:**

```json
{ "status": "in_progress" }
```

**Valid statuses:** `scheduled`, `bot_joining`, `in_progress`, `completed`, `cancelled`, `error`

---

### POST /meetings/:id/complete

Mark meeting as complete (calculates duration).

**Response:**

```json
{
  "meeting": {
    "id": "uuid",
    "status": "completed",
    "durationMinutes": 45
  }
}
```

---

### POST /meetings/:id/participants

Add participant to meeting.

**Request:**

```json
{
  "displayName": "John Doe",
  "email": "john@example.com",
  "isBot": false
}
```

---

### GET /meetings/:id/participants

Get all participants for a meeting.

---

### GET /organizations/:orgId/meetings

Get recent meetings for an organization.

**Query params:** `?limit=20`

---

## Transcripts

### POST /meetings/:id/transcripts

Add single transcript event.

**Request:**

```json
{
  "speaker": "John Doe",
  "content": "Welcome everyone to the meeting",
  "sequenceNumber": 1,
  "speakerId": "speaker-123",
  "isFinal": true,
  "confidence": 0.95,
  "capturedAt": "2024-01-15T14:00:05Z"
}
```

---

### POST /meetings/:id/transcripts/batch

Batch insert transcript events (streaming).

**Request:**

```json
{
  "events": [
    { "speaker": "Alice", "content": "Hello", "sequenceNumber": 1 },
    { "speaker": "Bob", "content": "Hi there", "sequenceNumber": 2 }
  ]
}
```

**Response:** `201 Created`

```json
{ "inserted": 2, "events": [...] }
```

---

### GET /meetings/:id/transcripts

Get all transcripts for a meeting (ordered by sequence).

---

### GET /meetings/:id/transcripts/text

Get full transcript as text (for AI processing).

**Response:**

```json
{
  "text": "John Doe: Welcome everyone\nAlice: Thanks for having us"
}
```

---

### GET /meetings/:id/transcripts/by-speaker

Get transcript grouped by speaker.

**Response:**

```json
{
  "bySpeaker": {
    "John Doe": [...events],
    "Alice": [...events]
  }
}
```

---

### GET /meetings/:id/transcripts/latest

Get latest N transcript events.

**Query params:** `?limit=50`

---

## Minutes of Meeting (MoM)

### POST /meetings/:id/mom

Create or update MoM.

**Request:**

```json
{
  "executiveSummary": "Team discussed Q1 priorities...",
  "detailedSummary": "Full summary here...",
  "aiModelVersion": "gpt-4-turbo",
  "overallConfidence": 0.92,
  "processingTimeMs": 1500
}
```

---

### GET /meetings/:id/mom

Get MoM for a meeting (includes highlights).

---

### POST /meetings/:id/highlights

Add a highlight.

**Request:**

```json
{
  "highlightType": "key_point",
  "content": "Decided to launch feature X by March 1",
  "importance": 8,
  "keywords": ["launch", "feature X", "deadline"]
}
```

**Valid types:** `executive_summary`, `key_point`, `notable_quote`, `outcome`

---

### POST /meetings/:id/highlights/batch

Batch add highlights.

---

### GET /meetings/:id/highlights

Get highlights (optionally filter by type).

**Query params:** `?type=key_point`

---

### GET /mom/recent

Get recent MoMs across all meetings.

**Query params:** `?limit=20`

---

## Meeting Items

### POST /meetings/:id/items

Create a meeting item.

**Request:**

```json
{
  "itemType": "action_item",
  "title": "Update documentation",
  "description": "Add API docs for new endpoints",
  "assigneeEmail": "john@example.com",
  "assignee": "John Doe",
  "dueDate": "2024-01-20",
  "priority": "high"
}
```

**Valid item types:** `action_item`, `decision`, `blocker`, `risk`, `announcement`, `project_update`, `idea`, `question`, `commitment`, `deadline`, `dependency`, `parking_lot`, `key_takeaway`, `reference`

---

### POST /meetings/:id/items/batch

Batch create items.

---

### GET /meetings/:id/items

Get all items for a meeting.

**Query params:** `?type=action_item`

---

### GET /items/:id

Get item by ID (with progress history).

---

### PATCH /items/:id/status

Update item status.

**Request:**

```json
{
  "status": "completed",
  "updatedBy": "john@example.com"
}
```

**Valid statuses:** `pending`, `in_progress`, `completed`, `blocked`, `deferred`, `cancelled`

---

### GET /items/:id/progress

Get progress history for an item.

---

### POST /items/:id/tags

Add tag to item.

**Request:**

```json
{ "tag": "urgent" }
```

---

### GET /users/:email/action-items

Get pending action items for a user.

---

### GET /items/overdue

Get all overdue action items.

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Description of what went wrong"
}
```

| Status | Meaning                               |
| ------ | ------------------------------------- |
| 400    | Bad Request - Missing required fields |
| 404    | Not Found - Resource doesn't exist    |
| 500    | Internal Server Error                 |
