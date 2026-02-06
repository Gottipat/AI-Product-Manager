# @meeting-ai/shared

Shared types, schemas, contracts, and constants for the Meeting AI system.

## Overview

This package serves as the **single source of truth** for data structures and API contracts between the Bot Runner and AI Backend services.

> ⚠️ **IMPORTANT**: Changes to this package affect both teams. All PRs must be reviewed by both @your-username and @friend-username.

## Installation

This package is private and used within the monorepo:

```typescript
import { TranscriptEvent, Meeting, ActionItem } from '@meeting-ai/shared';
import { TranscriptEventSchema } from '@meeting-ai/shared/schemas';
import { API_ENDPOINTS } from '@meeting-ai/shared/contracts';
import { BOT_CONFIG, AI_CONFIG } from '@meeting-ai/shared/constants';
```

## Structure

```
src/
├── types/          # TypeScript interfaces
│   ├── transcript.ts   # Transcript event types
│   ├── meeting.ts      # Meeting & participant types
│   ├── mom.ts          # Minutes of Meeting types
│   └── tasks.ts        # Action item & progress types
├── schemas/        # Zod validation schemas
├── contracts/      # API endpoint contracts
└── constants/      # Shared configuration values
```

## Usage

### Types

```typescript
import type { TranscriptEvent, Meeting, ActionItem } from '@meeting-ai/shared';

const event: TranscriptEvent = {
  id: '...',
  meetingId: '...',
  speaker: 'John Doe',
  text: 'Hello everyone',
  timestamp: new Date().toISOString(),
  sequenceNumber: 1,
  isFinal: true,
};
```

### Validation

```typescript
import { TranscriptEventSchema } from '@meeting-ai/shared/schemas';

const result = TranscriptEventSchema.safeParse(incomingData);
if (result.success) {
  // Use result.data safely
}
```

### API Contracts

```typescript
import { API_ENDPOINTS, StreamTranscriptRequest } from '@meeting-ai/shared/contracts';

const url = `${baseUrl}${API_ENDPOINTS.STREAM_TRANSCRIPT}`;
const payload: StreamTranscriptRequest = { batch: transcriptBatch };
```

## Development

```bash
# Build the package
pnpm build

# Watch mode
pnpm dev

# Type check
pnpm typecheck

# Run tests
pnpm test
```
