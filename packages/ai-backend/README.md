# @meeting-ai/ai-backend

The backend API and AI processing engine for the AI Product Manager system.

## Purpose

This package is responsible for:

- storing meetings, transcript events, generated MoM, and extracted items
- running contextual AI analysis over transcripts
- carrying project memory across recurring meetings
- tracking accountability, due dates, unresolved questions, and follow-up work
- serving the web app and capture clients through REST APIs

## What Makes This Backend Different

The goal is not only to summarize one meeting. The backend is designed to
support longitudinal project reasoning:

- what is still open from prior meetings
- who owns what
- which deadlines slipped
- which questions were resolved or remained open
- whether the project is becoming more ready over time

## Main Responsibilities

- Meeting lifecycle APIs
- Transcript ingestion and storage
- Context-aware Minutes of Meeting generation
- Structured item extraction
- Project-level accountability logic
- Benchmark-facing evaluation endpoints and support code

## Important Modules

```text
src/
├── db/             Database schema, repositories, bootstrap
├── routes/         Fastify routes for meetings, items, auth, uploads, bot
├── pipelines/      MoM generation and item extraction workflows
├── services/       OpenAI, auth, project-memory, transcription services
├── lib/            Transcript processing and product-manager logic
└── index.ts        Server entry point
```

## Run Locally

From the repo root:

```bash
pnpm --filter @meeting-ai/ai-backend dev
```

Or directly in this package:

```bash
pnpm dev
```

Build and run:

```bash
pnpm build
pnpm start
```

## Common Commands

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm test
pnpm db:push
pnpm db:bootstrap
```

## Required Environment

Minimum backend requirements:

```env
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
```

Optional depending on the flow:

```env
DEEPGRAM_API_KEY=
JWT_SECRET=
COOKIE_SECRET=
```

The easiest way to run this package is still through the repo Docker flow:

- [../../README.md](../../README.md)
- [../../docs/DOCKER_RUN.md](../../docs/DOCKER_RUN.md)

## API Surface

This backend serves:

- the web dashboard
- transcript upload flows
- bot-based meeting capture
- extension-based meeting capture
- benchmark evaluation flows

See:

- [../../docs/API_CONTRACTS.md](../../docs/API_CONTRACTS.md)
- [../../docs/AI_PIPELINE.md](../../docs/AI_PIPELINE.md)

## Current Status

Strongest areas:

- transcript upload
- contextual MoM generation
- item extraction and accountability carry-forward
- project-memory-aware benchmark behavior

Still evolving:

- audio transcription experimentation
- capture-path-specific reliability edge cases from bot and extension flows

## Testing

```bash
pnpm test
pnpm typecheck
```

From the repo root, these are also useful:

```bash
pnpm --filter @meeting-ai/ai-backend test
pnpm --filter @meeting-ai/ai-backend typecheck
```

## Related Docs

- [../../docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)
- [../../docs/AI_PIPELINE.md](../../docs/AI_PIPELINE.md)
- [../../docs/EVAL_RUBRIC.md](../../docs/EVAL_RUBRIC.md)
- [../../benchmark/README.md](../../benchmark/README.md)
