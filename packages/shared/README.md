# @meeting-ai/shared

Shared contracts, schemas, and types for the AI Product Manager monorepo.

## Purpose

This package is the single source of truth for data structures used across:

- the backend
- the web app
- the bot-runner
- the Chrome extension

## What Lives Here

- TypeScript types for meetings, transcripts, MoM, and items
- Zod schemas for validation
- API contracts and shared request/response shapes
- shared constants used across packages

## Why It Matters

The project depends on consistent data flow between multiple capture paths and a
stateful backend. This package keeps the system aligned so that:

- transcript data is shaped consistently
- generated MoM data is validated
- item and meeting contracts stay compatible across packages

## Development

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm test
```

From the repo root:

```bash
pnpm --filter @meeting-ai/shared build
pnpm --filter @meeting-ai/shared typecheck
pnpm --filter @meeting-ai/shared test
```

## Common Usage

```ts
import type { Meeting, TranscriptEvent } from '@meeting-ai/shared';
import { TranscriptEventSchema } from '@meeting-ai/shared/schemas';
```

## Related Docs

- [../../README.md](../../README.md)
- [../../docs/API_CONTRACTS.md](../../docs/API_CONTRACTS.md)
- [../../docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)
