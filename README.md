# AI Product Manager for Recurring Meetings

An end-to-end system for turning recurring product meetings into structured
project memory, accountable action items, and context-aware Minutes of Meeting
(MoM).

This project is not just an AI note taker. The goal is to build an
`AI Product Manager` that remembers what happened in previous meetings, tracks
open questions and deadlines, and helps teams review delivery continuity over
time.

## Start Here

If you want the fastest path through the project, use this order:

1. [README.md](README.md)
2. [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)
3. [docs/REVIEW_GUIDE.md](docs/REVIEW_GUIDE.md)
4. [docs/SUBMISSION_GUIDE.md](docs/SUBMISSION_GUIDE.md)
5. [`benchmark/scenarios/onboarding_growth_initiative/transcripts/README.md`](benchmark/scenarios/onboarding_growth_initiative/transcripts/README.md)

If you only need the essentials:

- `What the project is and how to run it`
  [README.md](README.md)
- `What is working and what is still in progress`
  [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)
- `Where the code and dataset links are`
  [docs/SUBMISSION_GUIDE.md](docs/SUBMISSION_GUIDE.md)
- `How to use the benchmark dataset and read the score`
  [`benchmark/scenarios/onboarding_growth_initiative/transcripts/README.md`](benchmark/scenarios/onboarding_growth_initiative/transcripts/README.md)

## All-In-One Guide

If you want to share just one link, this README is intended to be enough on its
own.

### 1. Code Access

- Repository:
  `https://github.com/KumarSashank/AI-Product-Manager`
- ZIP download:
  `https://github.com/KumarSashank/AI-Product-Manager/archive/refs/heads/main.zip`

### 2. Minimum Setup

Prerequisites:

- `Node.js 20+`
- `pnpm 8+`
- `Docker Desktop` or Docker Engine with Compose
- `OPENAI_API_KEY`

Minimal Docker env:

```env
OPENAI_API_KEY=sk-your-openai-key
```

Run the application:

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up --build -d
```

Open:

- Web app: `http://localhost:3001`
- API health: `http://localhost:3002/api/v1/health`

### 3. Recommended Product Flow

Use this path for the most reliable walkthrough:

1. Start the app with Docker.
2. Create a project.
3. Upload a transcript.
4. Generate the Minutes of Meeting.
5. Review extracted items and accountability.
6. Upload the next transcript into the same project to show continuity.

### 4. Dataset Access

Direct dataset links:

- Scenario folder:
  `https://github.com/KumarSashank/AI-Product-Manager/tree/main/benchmark/scenarios/onboarding_growth_initiative`
- Transcripts folder:
  `https://github.com/KumarSashank/AI-Product-Manager/tree/main/benchmark/scenarios/onboarding_growth_initiative/transcripts`
- Scenario JSON:
  `https://github.com/KumarSashank/AI-Product-Manager/blob/main/benchmark/scenarios/onboarding_growth_initiative/scenario.json`

The benchmark transcript files are:

1. `001_week1_kickoff.txt`
2. `002_week2_status.txt`
3. `003_week3_scope_risk.txt`
4. `004_week4_replan.txt`
5. `005_week5_launch_readiness.txt`

### 5. How To Use The Dataset

Benchmark typecheck:

```bash
pnpm benchmark:typecheck
```

Run our stateful method:

```bash
pnpm benchmark:longitudinal -- benchmark/scenarios/onboarding_growth_initiative/scenario.json
```

Run the normal baseline:

```bash
pnpm benchmark:longitudinal -- --system transcript_only benchmark/scenarios/onboarding_growth_initiative/scenario.json
```

Compare both methods:

```bash
pnpm benchmark:compare
```

### 6. Where To Find The Score

Benchmark reports are written to:

- Host runs:
  `benchmark/reports/`
- Docker backend container runs:
  `/app/benchmark/reports/`

### 7. How To Read The Result

The benchmark compares:

- `current_system`
  Our method with project memory and accountability carry-forward
- `transcript_only`
  The normal baseline without prior project memory

Expected result for the built-in scenario:

- `current_system`: `38 passed / 0 failed`
- `transcript_only`: `32 passed / 6 failed`

Interpretation:

- higher `passed` is better
- lower `failed` is better
- if `transcript_only` matches or beats `current_system`, that means the
  longitudinal reasoning has regressed

### 8. Current Product Maturity

Most reliable:

- transcript upload
- contextual MoM generation
- project-level action items
- benchmark evaluation

Still in progress:

- bot-based meeting joining reliability
- Chrome extension multi-speaker transcript attribution
- audio transcription experimentation

## What This Project Does

The system supports three capture paths:

- `Transcript upload`
  The most reliable path today. Upload an existing transcript and generate
  contextual MoM, extracted items, and longitudinal accountability.
- `Join with bot`
  A Playwright-based Google Meet bot that can join meetings and capture live
  captions. Useful for demos and experimentation, but still reliability-limited
  by meeting permissions, waiting rooms, and Google auth flows.
- `Chrome extension`
  A browser-based Meet capture path that is under active development. Audio
  capture is supported. Speaker-attributed multi-person transcript extraction is
  still being improved.

## Why This Matters

Typical AI meeting assistants summarize a single meeting well, but they often
lose continuity across weeks. This system is designed to answer harder project
questions:

- What was promised last week, and is it still open?
- Which owner missed a deadline without giving a status update?
- Which product question is still unresolved?
- Did the team actually close the launch blocker they discussed earlier?
- Is the project becoming more ready, or just generating more meeting notes?

## Core Outcomes

- Persistent meeting memory across a project
- Context-aware MoM generation
- Structured extraction of action items, decisions, blockers, and open questions
- Accountability tracking by owner, team, priority, and due date
- A benchmark harness that compares the stateful system against a
  transcript-only baseline

## Current Product Status

What is strongest today:

- Transcript upload workflow
- Context-aware MoM generation
- Project-level item tracking and accountability
- Benchmark and research evaluation scaffolding
- Dockerized local setup

What is still in progress:

- Bot-based meeting joining reliability
- Chrome extension multi-speaker speaker attribution
- Audio-transcription experimentation beyond transcript/caption capture

Usage note:

- For the most reliable flow, use `transcript upload`.
- Treat `bot join` and `extension capture` as experimental/preview features.

See [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) for a fuller summary of
what has been achieved and what is still being improved.

## Monorepo Structure

```text
AI-Product-Manager/
├── packages/
│   ├── ai-backend/        Fastify API, AI pipelines, database access
│   ├── web/               Next.js dashboard and project workspace
│   ├── bot-runner/        Playwright-based Google Meet bot
│   ├── chrome-extension/  Browser-based Meet capture
│   └── shared/            Shared schemas, contracts, and types
├── benchmark/             Longitudinal benchmark harness
├── docs/                  Project, research, and operational docs
├── docker/                Dockerfiles and runtime setup
└── scripts/               Utility scripts
```

## Tech Stack

- `Next.js` and `React` for the dashboard
- `Fastify` and `TypeScript` for the backend
- `PostgreSQL` and `Drizzle` for persistence
- `OpenAI` for MoM generation and structured extraction
- `Playwright` for the bot-based Meet capture path
- `Chrome Extension APIs` for in-browser Meet capture

## Quick Start

### Prerequisites

- `Node.js 20+`
- `pnpm 8+`
- `Docker Desktop` or Docker Engine with Compose support
- `OPENAI_API_KEY`

### Recommended Setup: Docker

This is the easiest path for local setup and evaluation.

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up --build -d
```

Then open:

- Web app: `http://localhost:3001`
- API: `http://localhost:3002`
- Health check: `http://localhost:3002/api/v1/health`

Useful commands:

```bash
pnpm docker:up
pnpm docker:down
docker compose --env-file .env.docker logs -f
docker compose --env-file .env.docker up -d --build ai-backend
docker compose --env-file .env.docker up -d --build web
```

Full guide:

- [docs/DOCKER_RUN.md](docs/DOCKER_RUN.md)

### Local Development

```bash
pnpm install
pnpm dev
```

Common package-level commands:

```bash
pnpm --filter @meeting-ai/ai-backend dev
pnpm --filter @meeting-ai/web dev
pnpm --filter @meeting-ai/bot-runner dev
```

Local environment details:

- [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md)
- [docs/README.md](docs/README.md)

## Environment Variables

### Required For The Normal Demo Flow

| Variable         | Required | Purpose                                            |
| ---------------- | -------- | -------------------------------------------------- |
| `OPENAI_API_KEY` | Yes      | Generates contextual MoM and structured extraction |

### Included With Safe Local Docker Defaults

| Variable        | Required            | Purpose               |
| --------------- | ------------------- | --------------------- |
| `JWT_SECRET`    | No for local Docker | JWT signing secret    |
| `COOKIE_SECRET` | No for local Docker | Cookie signing secret |

### Optional, Depending On The Capture Method

| Variable           | Required | Purpose                                             |
| ------------------ | -------- | --------------------------------------------------- |
| `GOOGLE_EMAIL`     | Optional | Used by the bot-runner for Google auth              |
| `GOOGLE_PASSWORD`  | Optional | Used by the bot-runner for Google auth              |
| `DEEPGRAM_API_KEY` | Optional | Only needed for audio transcription experimentation |

### Minimal `.env.docker`

```env
OPENAI_API_KEY=sk-your-openai-key
```

You can leave the dev-only `JWT_SECRET` and `COOKIE_SECRET` defaults as-is for
local Docker runs.

## Code And Dataset Access

### Code Access

Repository:

- `GitHub`: `https://github.com/KumarSashank/AI-Product-Manager`

Download options:

- Clone:

```bash
git clone https://github.com/KumarSashank/AI-Product-Manager.git
```

- Download ZIP:
  `https://github.com/KumarSashank/AI-Product-Manager/archive/refs/heads/main.zip`

### Dataset Access

The evaluation dataset used by this project is included in the repository under
`benchmark/scenarios/`.

Primary benchmark dataset:

- Scenario definition:
  `benchmark/scenarios/onboarding_growth_initiative/scenario.json`
- Transcript files:
  `benchmark/scenarios/onboarding_growth_initiative/transcripts/`

GitHub paths:

- Scenario folder:
  `https://github.com/KumarSashank/AI-Product-Manager/tree/main/benchmark/scenarios/onboarding_growth_initiative`
- Transcripts folder:
  `https://github.com/KumarSashank/AI-Product-Manager/tree/main/benchmark/scenarios/onboarding_growth_initiative/transcripts`
- Scenario JSON:
  `https://github.com/KumarSashank/AI-Product-Manager/blob/main/benchmark/scenarios/onboarding_growth_initiative/scenario.json`

See [docs/SUBMISSION_GUIDE.md](docs/SUBMISSION_GUIDE.md) for a submission-ready
mapping of code, dataset, and benchmark assets, and
[`benchmark/scenarios/onboarding_growth_initiative/transcripts/README.md`](benchmark/scenarios/onboarding_growth_initiative/transcripts/README.md)
for a short dataset walkthrough.

## How To Use The App

Recommended walkthrough:

1. Start the app with Docker.
2. Sign in to the web app.
3. Create a project.
4. Upload a transcript through the project workspace.
5. Review the generated MoM, extracted items, and project item board.
6. Open the next meeting in the same project to show continuity across meetings.

Stable demo path:

- `Projects -> Upload transcript -> Generate MoM -> Review action items`

Preview/experimental paths:

- `Join with bot`
- `Chrome extension capture`

See [docs/REVIEW_GUIDE.md](docs/REVIEW_GUIDE.md) for a guided walkthrough.

## Testing

### Core Commands

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm pre-push
```

### Focused Commands

```bash
pnpm --filter @meeting-ai/ai-backend test
pnpm --filter @meeting-ai/ai-backend typecheck
pnpm --filter @meeting-ai/web exec tsc --noEmit
pnpm benchmark:typecheck
```

Expected outcome:

- `pnpm test` should pass
- `pnpm typecheck` should pass
- `pnpm format:check` should pass
- `pnpm pre-push` should pass
- `pnpm lint` may still show warnings in some areas, but should not fail

More detail:

- [docs/TESTING.md](docs/TESTING.md)
- [docs/TOOLING.md](docs/TOOLING.md)

## Benchmark Evaluation

This repo includes a longitudinal benchmark harness that compares:

- `current_system`
  The full stateful AI Product Manager workflow with project memory
- `transcript_only`
  A baseline that only uses the current meeting transcript

### Benchmark Commands

```bash
pnpm benchmark:typecheck
pnpm benchmark:longitudinal
pnpm benchmark:compare
pnpm benchmark:longitudinal -- benchmark/scenarios/onboarding_growth_initiative/scenario.json
pnpm benchmark:longitudinal -- --system transcript_only benchmark/scenarios/onboarding_growth_initiative/scenario.json
```

### Reports

- Host output: [benchmark/reports](benchmark/reports)
- Docker backend container output: `/app/benchmark/reports`

Expected result for the built-in comparison scenario:

- `current_system`: `38 passed / 0 failed`
- `transcript_only`: `32 passed / 6 failed`

This benchmark is important because it demonstrates that persistent project
memory outperforms raw transcript-only summarization on continuity,
accountability, and final project-state checks.

More detail:

- [benchmark/README.md](benchmark/README.md)
- [docs/BENCHMARK_SLIDE_SUMMARY.md](docs/BENCHMARK_SLIDE_SUMMARY.md)
- [docs/EVAL_RUBRIC.md](docs/EVAL_RUBRIC.md)

## What We Achieved

- Built a multi-package product around recurring-meeting intelligence
- Added contextual MoM generation grounded in prior project state
- Added action-item continuity, accountability, and due-date awareness
- Added a Notion-like item workspace for reviewing and updating work
- Dockerized the stack for easier local setup
- Added a benchmark harness for longitudinal evaluation
- Framed the system as a researchable `AI Product Manager` problem, not just a
  meeting-summary tool

## What Still Needs Work

- Improve bot reliability under Google auth and waiting-room edge cases
- Improve extension-based multi-speaker caption separation
- Improve audio-to-transcript experimentation beyond raw capture
- Expand the benchmark dataset beyond the initial scenario pack
- Add stronger evidence trails and inspection tooling for why the system marked an
  item as open, resolved, blocked, or overdue

## Documentation Map

Start here:

- [docs/README.md](docs/README.md)

Most useful docs:

| Document                                                                                                                                         | Purpose                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)                                                                                                 | Achievements, limitations, and roadmap |
| [docs/REVIEW_GUIDE.md](docs/REVIEW_GUIDE.md)                                                                                                     | Guided walkthrough of the product      |
| [docs/SUBMISSION_GUIDE.md](docs/SUBMISSION_GUIDE.md)                                                                                             | Code and dataset access for submission |
| [benchmark/scenarios/onboarding_growth_initiative/transcripts/README.md](benchmark/scenarios/onboarding_growth_initiative/transcripts/README.md) | How to use the benchmark dataset       |
| [docs/DOCKER_RUN.md](docs/DOCKER_RUN.md)                                                                                                         | How to run the full app locally        |
| [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md)                                                                                                       | Environment variable setup             |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                                                                                                     | System design and data flow            |
| [docs/TESTING.md](docs/TESTING.md)                                                                                                               | Test strategy and commands             |
| [benchmark/README.md](benchmark/README.md)                                                                                                       | Longitudinal benchmark harness         |
| [docs/AI_PRODUCT_MANAGER_RESEARCH_PLAN.md](docs/AI_PRODUCT_MANAGER_RESEARCH_PLAN.md)                                                             | Product and research thesis            |
| [docs/PAPER_OUTLINE.md](docs/PAPER_OUTLINE.md)                                                                                                   | Research paper outline                 |

## Packages

| Package                                                                    | Description                         |
| -------------------------------------------------------------------------- | ----------------------------------- |
| [packages/ai-backend/README.md](packages/ai-backend/README.md)             | Backend API and AI pipeline         |
| [packages/web/README.md](packages/web/README.md)                           | Web dashboard and project workspace |
| [packages/bot-runner/README.md](packages/bot-runner/README.md)             | Bot capture path                    |
| [packages/chrome-extension/README.md](packages/chrome-extension/README.md) | Browser capture path                |
| [packages/shared/README.md](packages/shared/README.md)                     | Shared contracts and schemas        |

## Final Note

If you are reviewing this project academically, the strongest way to evaluate it
is not only by “does it summarize one meeting well?” but by “does it preserve
continuity across a series of meetings and improve project accountability over
time?”
