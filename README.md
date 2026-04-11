# Context-Aware AI Meeting System

> Longitudinal analysis of recurring meetings with AI-powered insights and AI
> Product Manager accountability

[![CI Pipeline](https://github.com/YOUR_ORG/AI-Product-Manager/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_ORG/AI-Product-Manager/actions/workflows/ci.yml)

## Overview

A system that joins Google Meet sessions as a bot participant, captures live
captions with speaker attribution, and streams transcripts to an AI backend for
extraction, MoM generation, and longitudinal task tracking.

### Key Features

- 🤖 **Bot Participant**: Joins meetings when invited (no covert recording)
- 📝 **Live Captions**: Captures speaker-attributed transcripts in real-time
- 🧠 **AI Extraction**: Identifies decisions, action items, and key points
- 💻 **Web Dashboard**: Project management and meeting insights interface
- 🔐 **Authentication**: Secure user access and role-based permissions
- 📋 **MoM Generation**: Produces structured Minutes of Meeting
- 📊 **Progress Tracking**: Tracks action items across recurring meetings
- 🔍 **RAG System**: Contextual retrieval for historical meeting data

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Meeting AI System                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐       ┌──────────────────┐                      │
│  │ Google Meet │       │  Web Dashboard   │                      │
│  │   Session   │       │ (Next.js/React)  │                      │
│  └──────┬──────┘       └────────┬─────────┘                      │
│         │ Join                  │ REST/Auth                      │
│         ▼                       ▼                                │
│  ┌─────────────┐       ┌──────────────────┐                      │
│  │ Bot Runner  │──────▶│    AI Backend    │                      │
│  └─────────────┘       └────────┬─────────┘                      │
│                                 │                                │
│                        ┌────────▼─────────┐                      │
│                        │    PostgreSQL    │                      │
│                        └──────────────────┘                      │
└──────────────────────────────────────────────────────────────────┘
```

## Team Ownership

| Package                  | Owner  | Description                        |
| ------------------------ | ------ | ---------------------------------- |
| `@meeting-ai/shared`     | Both   | Types, schemas, API contracts      |
| `@meeting-ai/web`        | You    | Next.js dashboard & auth interface |
| `@meeting-ai/bot-runner` | Friend | Playwright bot, caption capture    |
| `@meeting-ai/ai-backend` | You    | AI extraction, MoM, RAG            |

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker Desktop or Docker Engine with Compose support for the recommended local setup
- An `OPENAI_API_KEY`

### Setup

```bash
# Clone repository
git clone https://github.com/YOUR_ORG/AI-Product-Manager.git
cd AI-Product-Manager

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Recommended: Run The App With Docker

This is the easiest and most reliable way for teammates to run the full stack.
You do not need PostgreSQL installed locally.

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up --build -d
```

Set at least:

```env
OPENAI_API_KEY=sk-your-openai-key
```

Then open:

- Web app: `http://localhost:3001`
- API: `http://localhost:3002`
- API health: `http://localhost:3002/api/v1/health`

Useful Docker commands:

```bash
# Stop the stack
docker compose --env-file .env.docker down

# Follow logs
docker compose --env-file .env.docker logs -f

# Rebuild the backend only
docker compose --env-file .env.docker up -d --build ai-backend
```

Full Docker instructions: [docs/DOCKER_RUN.md](docs/DOCKER_RUN.md)

### Alternative: Local Development

```bash
# Start all packages in dev mode
pnpm dev

# Run specific packages
pnpm --filter @meeting-ai/web dev
pnpm --filter @meeting-ai/ai-backend dev
pnpm --filter @meeting-ai/bot-runner dev
```

For local dev without Docker, see [docs/README.md](docs/README.md) and
[docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

## Testing

### Core Commands

```bash
# Run all workspace tests
pnpm test

# Run all typechecks
pnpm typecheck

# Run lint
pnpm lint
```

### Focused Commands

```bash
# Backend tests
pnpm --filter @meeting-ai/ai-backend test

# Backend typecheck
pnpm --filter @meeting-ai/ai-backend typecheck

# Frontend typecheck
pnpm --filter web exec tsc --noEmit

# Shared package tests
pnpm --filter @meeting-ai/shared test
```

Expected results:

- `pnpm test` should complete without failures
- `pnpm typecheck` should complete without TypeScript errors
- `pnpm lint` may show existing warnings in some packages, but should not fail on new work

## Benchmark Evaluation

The repo includes a longitudinal benchmark harness that compares the current
stateful AI Product Manager system against a transcript-only baseline.

### Benchmark Commands

```bash
# Typecheck the benchmark harness
pnpm benchmark:typecheck

# Run the current stateful system only
pnpm benchmark:longitudinal

# Compare current system vs transcript-only baseline
pnpm benchmark:compare

# Run a specific scenario
pnpm benchmark:longitudinal -- benchmark/scenarios/onboarding_growth_initiative/scenario.json

# Run only the transcript-only baseline
pnpm benchmark:longitudinal -- --system transcript_only benchmark/scenarios/onboarding_growth_initiative/scenario.json
```

### When Running Against Docker

If host networking is awkward, run the benchmark inside the backend container:

```bash
docker exec meeting-ai-backend \
  pnpm --filter @meeting-ai/ai-backend exec tsx ../../benchmark/run-longitudinal-eval.ts --system all
```

### Benchmark Reports

Reports are written to:

- Host runs: [`benchmark/reports`](benchmark/reports)
- Runs inside the backend container: `/app/benchmark/reports`

Each report is a timestamped JSON file such as:

```text
benchmark/reports/2026-04-05T08-17-01-695Z-onboarding_growth_initiative_v1.json
```

### Expected Benchmark Result On This Branch

For the built-in `onboarding_growth_initiative` scenario, the expected
comparison result on `feat/accountability-ai-pm` is:

- `current_system`: `38 passed / 0 failed`
- `transcript_only`: `32 passed / 6 failed`

That result is important: it shows the stateful project-memory system
outperforming raw transcript-only summarization on continuity and
accountability checks.

## Project Structure

```
AI-Product-Manager/
├── packages/
│   ├── shared/           # Shared types & contracts
│   ├── web/              # Next.js Dashboard
│   ├── bot-runner/       # Playwright bot
│   └── ai-backend/       # AI processing server
├── docs/                 # Documentation (see docs/README.md)
├── .github/              # GitHub workflows
└── scripts/              # Utility scripts
```

## 📚 Documentation

**[📖 View Full Documentation →](docs/README.md)**

| Doc                                      | Purpose              |
| ---------------------------------------- | -------------------- |
| [Architecture](docs/ARCHITECTURE.md)     | System design        |
| [Database](docs/database/OVERVIEW.md)    | Schema & migrations  |
| [Testing](docs/TESTING.md)               | Test conventions     |
| [Tooling](docs/TOOLING.md)               | Git hooks, linting   |
| [Docker Run](docs/DOCKER_RUN.md)         | Run the app locally  |
| [Benchmark Harness](benchmark/README.md) | Longitudinal eval    |
| [Contributing](docs/CONTRIBUTING.md)     | Branch strategy, PRs |

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

### Branch Strategy

- `main`: Production-ready code
- `develop`: Integration branch
- `feature/*`: New features
- `hotfix/*`: Production fixes

### Commit Convention

```
feat(scope): description
fix(scope): description
docs(scope): description
```

Scopes: `shared`, `bot-runner`, `ai-backend`, `ci`, `docs`

## License

Private - All rights reserved
