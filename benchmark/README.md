# Longitudinal Benchmark Harness

> Scenario-driven evaluation for the AI Product Manager system

## Purpose

This benchmark exists to test the system as a `stateful execution-memory product`, not just a single-meeting summarizer.

The harness processes meetings in order, stores project state in the backend, and evaluates whether later meetings correctly use earlier context.

## What It Does

For a given scenario, the runner:

1. checks backend health
2. creates a fresh project
3. uploads each meeting transcript sequentially
4. fetches generated MoM and extracted items after every upload
5. runs expectation checks for each meeting
6. fetches final project state
7. writes a JSON report under `benchmark/reports/`

## Directory Layout

```text
benchmark/
  README.md
  run-longitudinal-eval.ts
  schema/
    longitudinal-scenario.schema.json
    longitudinal-report.schema.json
  scenarios/
    onboarding_growth_initiative/
      scenario.json
      transcripts/
        001_week1_kickoff.txt
        002_week2_status.txt
        003_week3_scope_risk.txt
        004_week4_replan.txt
        005_week5_launch_readiness.txt
  reports/
```

## Scenario Format

Each scenario contains:

- project metadata
- a sequence of meetings
- transcript file paths
- expectation checks per meeting
- final project-state expectations

See:

- [scenario schema](./schema/longitudinal-scenario.schema.json)
- [first scenario](./scenarios/onboarding_growth_initiative/scenario.json)

## Running The Benchmark

### Against a locally running backend

```bash
pnpm benchmark:longitudinal
```

### Against a specific scenario

```bash
pnpm benchmark:longitudinal -- benchmark/scenarios/onboarding_growth_initiative/scenario.json
```

### Against a different backend URL

```bash
BENCHMARK_API_BASE_URL=http://localhost:3002/api/v1 \
pnpm benchmark:longitudinal -- benchmark/scenarios/onboarding_growth_initiative/scenario.json
```

### Inside the Docker backend container

If host networking is awkward, copy the benchmark directory into the container and run:

```bash
node /app/benchmark/run-longitudinal-eval.ts
```

Or use `tsx` if you are running from the workspace:

```bash
pnpm --filter @meeting-ai/ai-backend exec tsx ../../benchmark/run-longitudinal-eval.ts
```

When running inside Docker, prefer:

```bash
BENCHMARK_API_BASE_URL=http://127.0.0.1:3002/api/v1
```

## Environment Variables

- `BENCHMARK_API_BASE_URL`
  Defaults to `http://127.0.0.1:3002/api/v1`

- `BENCHMARK_REPORT_DIR`
  Defaults to `benchmark/reports`

- `BENCHMARK_PROJECT_SUFFIX`
  Optional suffix for easier manual identification in the UI

## What A Report Contains

The generated report includes:

- scenario metadata
- health check result
- created project id
- each uploaded meeting id
- upload and MoM results
- extracted item summaries
- expectation pass/fail checks
- final project-state checks
- aggregate pass/fail totals

See [report schema](./schema/longitudinal-report.schema.json).

## Important Constraint

This benchmark is intentionally sequential.
Do not evaluate longitudinal behavior by uploading all meetings in parallel.

The whole point is to simulate the real product loop:

- week 1 creates project memory
- week 2 consumes and updates it
- week 3 consumes and updates it
- and so on

## Near-Term Next Steps

- add 10 to 20 more scenarios
- add baseline runner support
- add lifecycle-transition scoring against gold labels
- add a Markdown summary report alongside JSON
- add PM human-evaluation export sheets
