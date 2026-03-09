# Meeting AI System - Antigravity Context

You are assisting with the **Context-Aware AI Meeting System** - a monorepo for capturing Google Meet transcripts and generating AI-powered meeting insights.

## Team Structure

| Package                  | Owner       | Focus                                      |
| ------------------------ | ----------- | ------------------------------------------ |
| `@meeting-ai/shared`     | **Both**    | Types, schemas, API contracts - SYNC POINT |
| `@meeting-ai/bot-runner` | **Friend**  | Playwright bot, caption capture            |
| `@meeting-ai/ai-backend` | **Sashank** | AI extraction, MoM, RAG                    |

## Key Principles

1. **No covert recording** - Bot joins as visible participant
2. **Shared source of truth** - All types from `@meeting-ai/shared`
3. **Conventional commits** - `feat(scope): description`

## Tech Stack

- Node.js 20+, TypeScript (strict)
- pnpm workspaces
- Playwright (bot), Fastify (backend), OpenAI, PostgreSQL, Zod

## Commands

```bash
pnpm install && pnpm build    # Setup
pnpm dev                       # All packages
pnpm --filter @meeting-ai/ai-backend dev  # Specific
```

## Context Files

- `.context/DOMAIN.md` - Domain knowledge
- `.context/API.md` - API reference
- `.context/SPRINT.md` - Current work (keep updated!)
