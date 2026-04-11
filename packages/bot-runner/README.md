# @meeting-ai/bot-runner

Playwright-based Google Meet bot for the AI Product Manager system.

## Purpose

This package is the automated meeting-join path. It attempts to join a Google
Meet session as a visible participant, enable captions, and send meeting data
into the backend.

## Current Status

This package is useful for experimentation and demos, but it should be treated
as `Preview`.

Why:

- meeting admission and waiting-room behavior vary
- Google auth and 2FA create reliability friction
- browser automation can break when Google changes UI or policies

This is why the main product recommends transcript upload first.

## What It Does

- launches a Playwright browser session
- joins Google Meet with a visible bot identity
- enables captions when possible
- captures caption text for backend ingestion

## Run Locally

From the repo root:

```bash
pnpm --filter @meeting-ai/bot-runner dev
```

Or directly in the package:

```bash
pnpm dev
```

## Common Commands

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm test
```

## Typical Environment

```env
AI_BACKEND_INTERNAL_URL=http://ai-backend:3002
MEET_LINK=https://meet.google.com/xxx-xxxx-xxx
BOT_DISPLAY_NAME=Meeting AI Bot
GOOGLE_EMAIL=
GOOGLE_PASSWORD=
```

## Best Use

Use this package when you want to explore:

- automated meeting joining
- live caption capture
- non-upload-based workflows

Do not treat it as the most reliable evaluator/demo path for academic review.

## Known Limitations

- may need manual admission into the meeting
- may be blocked by account verification or policy changes
- reliability depends on Google Meet UI and auth behavior

## Related Docs

- [../../README.md](../../README.md)
- [../../docs/PROJECT_STATUS.md](../../docs/PROJECT_STATUS.md)
- [../../docs/REVIEW_GUIDE.md](../../docs/REVIEW_GUIDE.md)
