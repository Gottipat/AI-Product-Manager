# @meeting-ai/bot-runner

> 🤖 **Owner**: Friend
>
> Playwright-based bot for joining Google Meet and capturing captions

## Overview

This package handles:
- Joining Google Meet sessions via Playwright/Chromium
- Enabling and capturing live captions
- Parsing speaker-attributed transcript events
- Streaming transcripts in real-time to AI Backend

## Architecture

```
src/
├── browser/        # Playwright browser management
│   ├── launcher.ts     # Browser instance management
│   └── session.ts      # Browser session handling
├── meet/           # Google Meet interaction
│   ├── joiner.ts       # Meeting join logic
│   ├── captions.ts     # Caption enable/disable
│   └── participants.ts # Participant tracking
├── captions/       # Caption processing
│   ├── parser.ts       # Caption DOM parsing
│   ├── attribution.ts  # Speaker attribution
│   └── buffer.ts       # Caption batching
├── streaming/      # Backend communication
│   ├── client.ts       # WebSocket/HTTP client
│   └── retry.ts        # Retry logic
└── index.ts        # Entry point
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Development mode
pnpm dev

# Build
pnpm build

# Run tests
pnpm test
```

## Environment Variables

```env
# Required
AI_BACKEND_URL=http://localhost:3000

# Optional
BOT_DISPLAY_NAME=Meeting AI Bot
LOG_LEVEL=info
```

## API Contract

This package sends data to AI Backend using contracts defined in `@meeting-ai/shared`:

```typescript
import { API_ENDPOINTS, StreamTranscriptRequest } from '@meeting-ai/shared/contracts';

// POST to AI Backend
const response = await fetch(`${AI_BACKEND_URL}${API_ENDPOINTS.STREAM_TRANSCRIPT}`, {
  method: 'POST',
  body: JSON.stringify(payload satisfies StreamTranscriptRequest),
});
```

## Important Notes

⚠️ **No covert recording**: This bot only captures captions when explicitly enabled
⚠️ **User consent**: Bot joins as a visible participant that users must admit
⚠️ **Transparency**: Bot display name clearly indicates it's an AI assistant
