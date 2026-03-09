# @meeting-ai/bot-runner

> 🤖 **Owner**: Friend
>
> Playwright-based bot for joining Google Meet and capturing transcripts

## Overview

This package handles:

- Joining Google Meet sessions via Playwright/Chromium
- Enabling and capturing live captions
- Parsing speaker-attributed transcript events
- Streaming transcripts in real-time to AI Backend

## Architecture

```
src/
├── browser/            # Playwright browser management
│   ├── launcher.ts         # Browser launch + stealth config
│   └── session.ts          # Browser session handling
├── meet/               # Google Meet interaction
│   ├── joiner.ts           # Meeting join logic (human-like)
│   ├── captions.ts         # Caption enable/disable
│   └── participants.ts     # Participant tracking
├── captions/           # Caption processing
│   ├── parser.ts           # Caption DOM parsing
│   ├── attribution.ts      # Speaker attribution
│   └── buffer.ts           # Caption batching
├── utils/              # Utility modules
│   └── human.ts            # Human behavior simulation
└── index.ts            # Entry point
```

## Human-like Behavior

The bot simulates human behavior to avoid detection:

| Feature | Description |
|---------|-------------|
| **Human Typing** | Types each character with 50-150ms delays, occasional typos |
| **Mouse Movements** | Bezier curve movements (not straight lines) |
| **Random Delays** | Pauses between actions (0.5-3s) |
| **Page Reading** | Simulates reading before interacting |
| **Click Behavior** | Moves to element, pauses, then clicks |

### Usage

```typescript
import { humanType, humanClick, randomDelay } from './utils/human';

// Type like a human
await humanType(page, inputLocator, 'Hello World');

// Click with mouse movement
await humanClick(page, buttonLocator);

// Random pause
await randomDelay(1000, 3000);
```

## Stealth Configuration

The browser is configured to bypass Google's bot detection:

- ✅ Hides `navigator.webdriver` property
- ✅ Spoofs `navigator.plugins` and `navigator.languages`
- ✅ Mocks `window.chrome.runtime`
- ✅ Spoofs WebGL vendor/renderer
- ✅ Custom user agent (Mac Chrome)
- ✅ Disabled automation indicators

## Quick Start

```bash
# Install dependencies
pnpm install

# Development mode (opens browser)
pnpm dev

# Build
pnpm build

# Type checking
pnpm typecheck
```

## Environment Variables

```env
# Required
AI_BACKEND_URL=http://localhost:3000
MEET_LINK=https://meet.google.com/xxx-xxxx-xxx

# Optional
BOT_DISPLAY_NAME=Meeting AI Bot
LOG_LEVEL=info
```

## Known Issues

### "Can't join" Error
- First load often shows "can't join" - bot auto-reloads
- Sometimes requires 2-3 reload attempts
- Consider using authenticated Google profile for reliability

### Transcript Capture
- DOM-based caption parsing may have outdated selectors
- Audio transcription (Whisper API) is planned future work

## Scaling Architecture

For 1000+ users, see the recommended architecture:

```
                    Job Queue (Redis/BullMQ)
                           ↓
              Bot Workers (K8s auto-scaling)
                           ↓
              Browser Pool (Browserless.io)
                           ↓
            Google Meet → Transcription → AI Backend
```

## Important Notes

⚠️ **Visible participant**: Bot joins as a visible participant  
⚠️ **User consent**: Host must admit the bot from waiting room  
⚠️ **Transparency**: Bot display name clearly indicates it's AI  
