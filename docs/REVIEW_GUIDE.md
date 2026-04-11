# Review Guide

This guide is meant for professors, reviewers, and demo audiences who want the
clearest path through the application without getting tripped up by preview
features.

## Best Review Path

Use the application in this order:

1. Run the app with Docker.
2. Sign in.
3. Create a project.
4. Use `Transcript upload` instead of bot or extension capture.
5. Generate the Minutes of Meeting.
6. Inspect extracted items and project-level accountability.
7. Upload a second meeting transcript into the same project.
8. Show continuity across meetings.

## Why This Path Is Recommended

This path demonstrates the strongest parts of the system:

- contextual MoM generation
- longitudinal project memory
- accountability tracking
- structured extraction and item management

It also avoids over-indexing on the most experimental capture paths.

## Features To Treat As Stable

- transcript upload
- MoM generation
- item extraction
- project-level item workspace
- benchmark and documentation

## Features To Treat As Preview Or In Progress

### Join With Bot

Use with caution because:

- Google auth can require re-verification
- waiting-room behavior varies by meeting
- some meetings may block or delay the bot

### Chrome Extension

Use with caution because:

- audio capture is available
- multi-speaker transcript attribution is still being improved
- caption DOM structure can affect transcript quality

## Suggested Demo Narrative

### Step 1: Problem

Explain that most AI note takers summarize one meeting but lose project
continuity across weeks.

### Step 2: Core Thesis

Explain that this system is designed as an `AI Product Manager`:

- remembers prior meetings
- carries forward unresolved work
- reasons about owners, deadlines, and blockers

### Step 3: Live Product Demo

Show:

1. a project workspace
2. transcript upload
3. generated MoM
4. extracted action items
5. a second meeting in the same project
6. carry-forward accountability

### Step 4: Technical Validation

Show:

- [../benchmark/README.md](../benchmark/README.md)
- [BENCHMARK_SLIDE_SUMMARY.md](./BENCHMARK_SLIDE_SUMMARY.md)

Highlight:

- `current_system: 38 passed / 0 failed`
- `transcript_only: 32 passed / 6 failed`

## Questions A Reviewer Might Ask

### What is the main innovation?

The main innovation is persistent project memory across recurring meetings,
combined with PM-style accountability tracking.

### What is the most reliable feature today?

Transcript upload with contextual MoM generation.

### What is still experimental?

Bot-based joining and extension-based multi-speaker transcript attribution.

### How is the system validated?

With automated tests, build checks, and a longitudinal benchmark that compares
the stateful system against a transcript-only baseline.

## If Time Is Short

If the reviewer only has a few minutes, show these three things:

1. transcript upload and generated MoM
2. project item workspace with owners and statuses
3. benchmark comparison result

## Supporting Docs

- [../README.md](../README.md)
- [PROJECT_STATUS.md](./PROJECT_STATUS.md)
- [DOCKER_RUN.md](./DOCKER_RUN.md)
- [BENCHMARK_SLIDE_SUMMARY.md](./BENCHMARK_SLIDE_SUMMARY.md)
