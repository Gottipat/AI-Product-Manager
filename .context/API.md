# API Reference

## AI Backend Endpoints

### Bot Runner → AI Backend

#### Transcript Ingestion

```
POST /api/v1/meetings/:id/transcripts/batch
Content-Type: application/json

{
  "events": [
    {
      "speaker": "John Doe",
      "content": "Let's discuss the roadmap",
      "startTime": "2024-02-06T10:00:00Z",
      "endTime": "2024-02-06T10:00:05Z",
      "sequence": 1,
      "confidence": 0.95
    }
  ]
}
```

#### Meeting Lifecycle

```
POST /api/v1/meetings                    # Create meeting
POST /api/v1/meetings/:id/transcripts    # Single transcript
GET  /api/v1/meetings/:id/transcripts    # Get all transcripts
```

---

## AI Pipeline Endpoints (NEW)

### MoM Generation

```
POST /api/v1/meetings/:id/generate-mom   # Trigger AI processing
GET  /api/v1/meetings/:id/ai-status      # Check progress
GET  /api/v1/meetings/:id/mom            # Get generated MoM
```

### Action Item Extraction

```
POST /api/v1/meetings/:id/extract-items  # Extract 14 item types

Response:
{
  "success": true,
  "itemsCreated": 9,
  "items": [
    { "itemType": "action_item", "title": "...", "assignee": "..." },
    { "itemType": "blocker", "title": "...", "priority": "critical" }
  ]
}
```

### Semantic Search (RAG)

```
POST /api/v1/search
{
  "query": "What decisions were made about budget?",
  "limit": 10,
  "meetingId": "optional-filter"
}

POST /api/v1/context
{
  "query": "Summarize action items from last week",
  "maxTokens": 8000
}
```

---

## Shared Types

```typescript
import { API_CONFIG, BOT_CONFIG, AI_CONFIG, ERROR_CODES, EVENT_TYPES } from '@meeting-ai/shared';
```

## Validation

```typescript
import { TranscriptBatchSchema } from '@meeting-ai/shared/schemas';

const result = TranscriptBatchSchema.safeParse(data);
if (!result.success) {
  // Handle validation error
}
```

---

## Bot Runner Integration Flow

```
1. Bot joins meeting → POST /api/v1/meetings (create)
2. Transcripts streaming → POST /api/v1/meetings/:id/transcripts/batch
3. Meeting ends → POST /api/v1/meetings/:id/generate-mom (trigger AI)
4. Poll status → GET /api/v1/meetings/:id/ai-status
5. Retrieve results → GET /api/v1/meetings/:id/mom
```
