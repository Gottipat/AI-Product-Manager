# API Contracts

This document defines the API contracts between Bot Runner and AI Backend.

## Endpoints

### Bot Runner → AI Backend

#### Stream Transcript
```http
POST /api/v1/stream/transcript
Content-Type: application/json
```

**Request:**
```json
{
  "batch": {
    "meetingId": "uuid",
    "events": [
      {
        "id": "uuid",
        "meetingId": "uuid",
        "speaker": "John Doe",
        "speakerId": "optional-id",
        "text": "Hello everyone",
        "timestamp": "2024-01-15T10:30:00Z",
        "confidence": 0.95,
        "sequenceNumber": 1,
        "isFinal": true
      }
    ],
    "batchNumber": 1,
    "batchTimestamp": "2024-01-15T10:30:05Z"
  }
}
```

**Response:**
```json
{
  "acknowledged": true,
  "processedCount": 5,
  "errors": []
}
```

#### Meeting Started
```http
POST /api/v1/meetings/start
```

#### Meeting Ended
```http
POST /api/v1/meetings/:meetingId/end
```

#### Participant Update
```http
POST /api/v1/meetings/:meetingId/participant
```

### AI Backend → Bot Runner

#### Join Meeting
```http
POST /api/v1/bot/join
```

#### Leave Meeting
```http
POST /api/v1/bot/:sessionId/leave
```

## Error Codes

| Code | Description |
|------|-------------|
| E1001 | Bot join failed |
| E1002 | Caption capture error |
| E2001 | Transcript processing failed |
| E2002 | MoM generation failed |
| E3001 | Stream connection failed |

See `@meeting-ai/shared/constants` for complete list.
