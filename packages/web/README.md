# @meeting-ai/web

The web dashboard for the AI Product Manager system.

## Purpose

This package is the main reviewer-facing surface of the project. It provides:

- authentication and onboarding
- project creation and navigation
- transcript upload
- meeting detail views
- generated Minutes of Meeting
- project-level action-item workspace

## Main Screens

- `Projects`
  Create projects and manage recurring meeting work
- `Project workspace`
  Upload transcripts, review items, and navigate related meetings
- `Meeting detail`
  Review transcript, MoM, highlights, and extracted items

## Capture Method Guidance

The UI is intentionally explicit about capture maturity:

- `Transcript upload` is the recommended and most reliable path
- `Join with bot` is preview-stage
- `Chrome extension` is in progress

That messaging exists so reviewers understand what is stable versus
experimental.

## Run Locally

From the repo root:

```bash
pnpm --filter @meeting-ai/web dev
```

The web app expects the backend API to be available. For the easiest local run,
use Docker from the repo root:

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up --build -d
```

Then open:

- `http://localhost:3001`

## Useful Commands

```bash
pnpm --filter @meeting-ai/web dev
pnpm --filter @meeting-ai/web build
pnpm --filter @meeting-ai/web exec tsc --noEmit
```

## Notes

- This package is designed to surface the strongest parts of the system first.
- For the best professor/demo flow, use transcript upload and project-level item
  review rather than starting with bot or extension capture.
