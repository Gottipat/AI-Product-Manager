# Transcript Dataset Usage

This folder contains the transcript dataset for the built-in
`onboarding_growth_initiative` longitudinal benchmark scenario.

This file is the single reference for:

- where the dataset lives
- what the files mean
- how to run the benchmark scripts
- how to compare the baseline against our system
- where to find the benchmark report
- how to read the final score

## Direct Dataset Link

GitHub folder:

- `https://github.com/KumarSashank/AI-Product-Manager/tree/main/benchmark/scenarios/onboarding_growth_initiative/transcripts`

## What This Folder Contains

Chronological meeting transcripts:

1. `001_week1_kickoff.txt`
2. `002_week2_status.txt`
3. `003_week3_scope_risk.txt`
4. `004_week4_replan.txt`
5. `005_week5_launch_readiness.txt`

Related scenario definition:

- `../scenario.json`

## What The Dataset Is For

This dataset is used to test whether the system behaves like a stateful
`AI Product Manager` instead of a one-meeting summarizer.

The goal is to evaluate whether the system can:

- carry context from week to week
- track open questions
- preserve accountability by owner
- detect continuity across meetings
- outperform a transcript-only baseline

## Why The Order Matters

This is a longitudinal dataset. The transcript files must be treated as a
sequence, not as independent meetings.

Correct order:

- week 1 creates the initial project state
- week 2 consumes week 1 context
- week 3 consumes weeks 1 and 2
- week 4 consumes weeks 1 to 3
- week 5 consumes weeks 1 to 4

If the transcripts are uploaded or evaluated out of order, the continuity logic
will not be tested correctly.

## Script Used For Evaluation

Main benchmark runner:

- `benchmark/run-longitudinal-eval.ts`

Scenario file:

- `benchmark/scenarios/onboarding_growth_initiative/scenario.json`

Root package scripts:

- `pnpm benchmark:typecheck`
- `pnpm benchmark:longitudinal`
- `pnpm benchmark:compare`

## How To Run The Tests And Comparison

Run from the repository root.

### 1. Typecheck The Benchmark

```bash
pnpm benchmark:typecheck
```

### 2. Run Only Our Stateful Method

This runs the `current_system`, which is our full context-aware AI Product
Manager pipeline.

```bash
pnpm benchmark:longitudinal -- benchmark/scenarios/onboarding_growth_initiative/scenario.json
```

### 3. Run Only The Normal Baseline

This runs the `transcript_only` system, which is the baseline or “normal”
method. It uses only the current meeting transcript and does not use prior
project memory.

```bash
pnpm benchmark:longitudinal -- --system transcript_only benchmark/scenarios/onboarding_growth_initiative/scenario.json
```

### 4. Compare Both Methods

This is the most important command because it compares:

- `current_system`
  Our method with project memory and accountability carry-forward
- `transcript_only`
  The baseline with no project memory

```bash
pnpm benchmark:compare
```

### 5. Full Project Checks

You can also run the broader repo checks:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
```

## How To Run It Inside Docker

If the app is running in Docker and you want to execute the benchmark from the
backend container:

```bash
docker exec meeting-ai-backend \
  pnpm --filter @meeting-ai/ai-backend exec tsx ../../benchmark/run-longitudinal-eval.ts --system all
```

Preferred API base URL in Docker:

```bash
BENCHMARK_API_BASE_URL=http://127.0.0.1:3002/api/v1
```

## Where To Find The Score

The benchmark writes timestamped JSON reports to:

- host runs:
  `benchmark/reports/`
- Docker backend container runs:
  `/app/benchmark/reports/`

Example:

```text
benchmark/reports/2026-04-05T08-17-01-695Z-onboarding_growth_initiative_v1.json
```

## How To Read The Score

The benchmark compares two systems:

- `current_system`
  Our method
- `transcript_only`
  The normal baseline

Expected result for this scenario:

- `current_system`: `38 passed / 0 failed`
- `transcript_only`: `32 passed / 6 failed`

Interpretation:

- higher passed count is better
- lower failed count is better
- if `transcript_only` matches or beats `current_system`, that indicates a
  regression in longitudinal reasoning

## What Counts As “Normal” Vs “Our Method”

### Normal Method

`transcript_only`

- reads only the current transcript
- does not use prior project memory
- does not reason over previous meetings in a structured way

### Our Method

`current_system`

- stores meeting state across the project
- carries open items and unresolved questions forward
- uses prior context during MoM generation
- reasons about continuity and accountability

## Manual Use In The App

You can also use this dataset manually in the product:

1. Start the application.
2. Create a single project.
3. Upload the transcripts in order:
   `001` -> `002` -> `003` -> `004` -> `005`
4. Review how the MoM and extracted items evolve over time.

This is useful if you want to show the product behavior directly in the UI
instead of only using the benchmark harness.

## Short Summary

If someone asks how to use this dataset, the short answer is:

1. go to this transcripts folder
2. run `pnpm benchmark:compare`
3. check the JSON report in `benchmark/reports/`
4. compare `current_system` against `transcript_only`

## Related Files

- Scenario JSON:
  [../scenario.json](../scenario.json)
- Benchmark runner:
  [../../../run-longitudinal-eval.ts](../../../run-longitudinal-eval.ts)
- Benchmark root doc:
  [../../../README.md](../../../README.md)
