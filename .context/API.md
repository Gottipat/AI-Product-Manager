# API Reference

## Endpoints

### Bot Runner → AI Backend

#### Stream Transcript

```
POST /api/v1/stream/transcript
```

Send batched transcript events.

#### Meeting Lifecycle

```
POST /api/v1/meetings/start      # Bot joined
POST /api/v1/meetings/:id/end    # Meeting ended
POST /api/v1/meetings/:id/participant  # Join/leave
```

### AI Backend → Bot Runner

```
POST /api/v1/bot/join            # Request bot to join
POST /api/v1/bot/:sessionId/leave  # Request bot to leave
```

## Shared Constants

```typescript
import {
  API_CONFIG, // Timeouts, batch sizes
  BOT_CONFIG, // Bot settings
  AI_CONFIG, // LLM parameters
  ERROR_CODES, // Error handling
  EVENT_TYPES, // Event names
} from '@meeting-ai/shared';
```

## Validation

Always validate incoming data:

```typescript
import { TranscriptBatchSchema } from '@meeting-ai/shared/schemas';

const result = TranscriptBatchSchema.safeParse(data);
if (!result.success) {
  // Handle validation error
}
```
