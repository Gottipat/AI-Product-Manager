# Bot Runner → AI Backend Integration Guide

## Quick Start

The AI Backend is ready for integration. Follow these steps to connect Bot Runner.

## 1. Send Transcripts

As the bot captures captions, batch and send them:

```typescript
const response = await fetch(`${AI_BACKEND_URL}/api/v1/meetings/${meetingId}/transcripts/batch`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    events: transcriptBuffer.map((t, i) => ({
      speaker: t.speakerName,
      content: t.text,
      startTime: t.timestamp,
      sequence: sequenceCounter + i,
      confidence: t.confidence ?? 0.9,
    })),
  }),
});
```

**Recommended:** Batch every 5-10 transcript events or every 3-5 seconds.

## 2. Trigger AI Processing

When the meeting ends, trigger MoM generation:

```typescript
const response = await fetch(`${AI_BACKEND_URL}/api/v1/meetings/${meetingId}/generate-mom`, {
  method: 'POST',
});

const result = await response.json();
// { success: true, momId: "...", highlightsCreated: 6, itemsCreated: 12 }
```

## 3. Poll for Status (Optional)

For long transcripts, poll the status:

```typescript
const status = await fetch(`${AI_BACKEND_URL}/api/v1/meetings/${meetingId}/ai-status`).then((r) =>
  r.json()
);

// { status: "generating" | "completed" | "failed", progress: 75 }
```

## 4. Retrieve Results

Get the generated MoM and action items:

```typescript
// Full MoM with highlights
const mom = await fetch(`${AI_BACKEND_URL}/api/v1/meetings/${meetingId}/mom`).then((r) => r.json());

// Action items only
const items = await fetch(`${AI_BACKEND_URL}/api/v1/meetings/${meetingId}/items`).then((r) =>
  r.json()
);
```

---

## Meeting Lifecycle Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        BOT RUNNER                               │
├─────────────────────────────────────────────────────────────────┤
│  1. Join Meeting                                                │
│     └── POST /api/v1/meetings                                   │
│         Body: { googleMeetLink, title, scheduledStart }         │
│                                                                 │
│  2. Stream Transcripts (every 3-5 seconds)                      │
│     └── POST /api/v1/meetings/:id/transcripts/batch             │
│                                                                 │
│  3. Track Participants                                          │
│     └── POST /api/v1/meetings/:id/participants                  │
│                                                                 │
│  4. End Meeting                                                 │
│     └── POST /api/v1/meetings/:id/generate-mom  ← Triggers AI   │
│                                                                 │
│  5. Poll Status (optional)                                      │
│     └── GET /api/v1/meetings/:id/ai-status                      │
│                                                                 │
│  6. Retrieve Results                                            │
│     └── GET /api/v1/meetings/:id/mom                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Extractable Item Types

The AI extracts these 14 meeting item types:

| Type             | Description           |
| ---------------- | --------------------- |
| `action_item`    | Tasks to complete     |
| `decision`       | Decisions made        |
| `blocker`        | Blocking issues       |
| `risk`           | Identified risks      |
| `question`       | Unanswered questions  |
| `idea`           | Suggestions           |
| `commitment`     | Promises made         |
| `deadline`       | Mentioned dates       |
| `dependency`     | External dependencies |
| `project_update` | Status updates        |
| `announcement`   | Information shared    |
| `parking_lot`    | Deferred topics       |
| `key_takeaway`   | Important insights    |
| `reference`      | Resources mentioned   |

---

## Environment Variables

Bot Runner needs this to connect:

```env
AI_BACKEND_URL=http://localhost:3000  # Development
# AI_BACKEND_URL=https://api.meeting-ai.com  # Production
```

---

## Testing the Connection

```bash
# Create a test meeting
curl -X POST http://localhost:3000/api/v1/meetings \
  -H "Content-Type: application/json" \
  -d '{"googleMeetLink":"https://meet.google.com/abc-defg-hij","title":"Test Meeting"}'

# Send test transcripts
curl -X POST http://localhost:3000/api/v1/meetings/{id}/transcripts/batch \
  -H "Content-Type: application/json" \
  -d '{"events":[{"speaker":"John","content":"Hello team","sequence":1}]}'

# Trigger AI processing
curl -X POST http://localhost:3000/api/v1/meetings/{id}/generate-mom
```

---

## Questions?

Contact @KumarSashank for AI Backend support.
