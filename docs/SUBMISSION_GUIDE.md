# Submission Guide

This document maps the project assets to common submission requirements such as:

- code download link
- dataset download/access link
- setup and run instructions
- benchmark and evaluation assets

## Code Access

Repository URL:

- `https://github.com/KumarSashank/AI-Product-Manager`

Download options:

- Clone the repository:

```bash
git clone https://github.com/KumarSashank/AI-Product-Manager.git
```

- Download the current `main` branch as a ZIP archive:
  `https://github.com/KumarSashank/AI-Product-Manager/archive/refs/heads/main.zip`

## Dataset Access

The evaluation dataset used by this project is included in the repository.

Dataset root:

- `benchmark/scenarios/`

Primary scenario used for longitudinal evaluation:

- `benchmark/scenarios/onboarding_growth_initiative/scenario.json`

Transcript files:

- `benchmark/scenarios/onboarding_growth_initiative/transcripts/001_week1_kickoff.txt`
- `benchmark/scenarios/onboarding_growth_initiative/transcripts/002_week2_status.txt`
- `benchmark/scenarios/onboarding_growth_initiative/transcripts/003_week3_scope_risk.txt`
- `benchmark/scenarios/onboarding_growth_initiative/transcripts/004_week4_replan.txt`
- `benchmark/scenarios/onboarding_growth_initiative/transcripts/005_week5_launch_readiness.txt`

GitHub links:

- Scenario folder:
  `https://github.com/KumarSashank/AI-Product-Manager/tree/main/benchmark/scenarios/onboarding_growth_initiative`
- Transcripts folder:
  `https://github.com/KumarSashank/AI-Product-Manager/tree/main/benchmark/scenarios/onboarding_growth_initiative/transcripts`
- Scenario JSON:
  `https://github.com/KumarSashank/AI-Product-Manager/blob/main/benchmark/scenarios/onboarding_growth_initiative/scenario.json`

The dataset can be accessed either:

- directly inside the repository after cloning, or
- through the GitHub links above

## How To Run The Code

Recommended method:

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up --build -d
```

Minimum required environment variable for the normal flow:

```env
OPENAI_API_KEY=sk-your-openai-key
```

Then open:

- Web app: `http://localhost:3001`
- API health: `http://localhost:3002/api/v1/health`

Additional setup docs:

- [../README.md](../README.md)
- [DOCKER_RUN.md](./DOCKER_RUN.md)
- [ENVIRONMENT.md](./ENVIRONMENT.md)

## How To Use The Dataset

The dataset is used by the longitudinal benchmark harness. It simulates a
sequence of recurring meetings in the same project and checks whether the
system preserves continuity across meetings.

Typical benchmark commands:

```bash
pnpm benchmark:typecheck
pnpm benchmark:longitudinal
pnpm benchmark:compare
```

Run against the included scenario:

```bash
pnpm benchmark:longitudinal -- benchmark/scenarios/onboarding_growth_initiative/scenario.json
```

Compare the full stateful system against the transcript-only baseline:

```bash
pnpm benchmark:compare
```

More detail:

- [../benchmark/README.md](../benchmark/README.md)
- [../benchmark/scenarios/onboarding_growth_initiative/transcripts/README.md](../benchmark/scenarios/onboarding_growth_initiative/transcripts/README.md)
- [EVAL_RUBRIC.md](./EVAL_RUBRIC.md)

## Expected Evaluation Result

For the built-in onboarding growth initiative scenario, the expected comparison
result is:

- `current_system`: `38 passed / 0 failed`
- `transcript_only`: `32 passed / 6 failed`

This result is used to demonstrate that the stateful project-memory system
outperforms a transcript-only baseline on continuity and accountability checks.

## Suggested Submission Assets

If a submission portal requires links, the clean set is:

1. Code repository link
2. ZIP download link for the repository
3. Dataset folder link
4. Transcripts folder link
5. Scenario JSON link
6. README link
7. Benchmark documentation link

Useful references:

- Repository:
  `https://github.com/KumarSashank/AI-Product-Manager`
- ZIP:
  `https://github.com/KumarSashank/AI-Product-Manager/archive/refs/heads/main.zip`
- Dataset folder:
  `https://github.com/KumarSashank/AI-Product-Manager/tree/main/benchmark/scenarios/onboarding_growth_initiative`
- Transcripts folder:
  `https://github.com/KumarSashank/AI-Product-Manager/tree/main/benchmark/scenarios/onboarding_growth_initiative/transcripts`
- README:
  `https://github.com/KumarSashank/AI-Product-Manager/blob/main/README.md`
