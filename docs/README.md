# Documentation Hub

This folder contains the operational, technical, research, and review-facing
documentation for the AI Product Manager project.

## Start Here

If you are new to the repo, use this order:

1. [../README.md](../README.md)
2. [REVIEW_GUIDE.md](./REVIEW_GUIDE.md)
3. [PROJECT_STATUS.md](./PROJECT_STATUS.md)
4. [DOCKER_RUN.md](./DOCKER_RUN.md)

## Recommended Docs By Audience

For product overview and walkthrough:

- [REVIEW_GUIDE.md](./REVIEW_GUIDE.md)
- [PROJECT_STATUS.md](./PROJECT_STATUS.md)
- [BENCHMARK_SLIDE_SUMMARY.md](./BENCHMARK_SLIDE_SUMMARY.md)

For implementation and local setup:

- [DOCKER_RUN.md](./DOCKER_RUN.md)
- [ENVIRONMENT.md](./ENVIRONMENT.md)
- [TESTING.md](./TESTING.md)
- [TOOLING.md](./TOOLING.md)

For architecture and implementation:

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [API_CONTRACTS.md](./API_CONTRACTS.md)
- [database/OVERVIEW.md](./database/OVERVIEW.md)
- [AI_PIPELINE.md](./AI_PIPELINE.md)

For research and benchmark work:

- [AI_PRODUCT_MANAGER_RESEARCH_PLAN.md](./AI_PRODUCT_MANAGER_RESEARCH_PLAN.md)
- [DATASET_SPEC.md](./DATASET_SPEC.md)
- [EVAL_RUBRIC.md](./EVAL_RUBRIC.md)
- [PAPER_OUTLINE.md](./PAPER_OUTLINE.md)
- [../benchmark/README.md](../benchmark/README.md)

## Documentation Index

| Document                                                                     | Purpose                                                         |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [PROJECT_STATUS.md](./PROJECT_STATUS.md)                                     | What is working well, what is experimental, and what comes next |
| [REVIEW_GUIDE.md](./REVIEW_GUIDE.md)                                         | Guided product walkthrough                                      |
| [SUBMISSION_GUIDE.md](./SUBMISSION_GUIDE.md)                                 | Code and dataset access mapping for submission                  |
| [DOCKER_RUN.md](./DOCKER_RUN.md)                                             | Full Docker workflow for local setup                            |
| [ENVIRONMENT.md](./ENVIRONMENT.md)                                           | Environment variable reference                                  |
| [TESTING.md](./TESTING.md)                                                   | Test commands and testing conventions                           |
| [TOOLING.md](./TOOLING.md)                                                   | Lint, formatting, hooks, and local CI                           |
| [ARCHITECTURE.md](./ARCHITECTURE.md)                                         | System architecture and package roles                           |
| [API_CONTRACTS.md](./API_CONTRACTS.md)                                       | API routes and request/response contracts                       |
| [AI_PIPELINE.md](./AI_PIPELINE.md)                                           | AI flow and context-aware MoM pipeline                          |
| [database/OVERVIEW.md](./database/OVERVIEW.md)                               | Database schema and operational docs                            |
| [BENCHMARK_SLIDE_SUMMARY.md](./BENCHMARK_SLIDE_SUMMARY.md)                   | Slide-friendly benchmark summary                                |
| [AI_PRODUCT_MANAGER_RESEARCH_PLAN.md](./AI_PRODUCT_MANAGER_RESEARCH_PLAN.md) | Product and research thesis                                     |
| [DATASET_SPEC.md](./DATASET_SPEC.md)                                         | Longitudinal scenario dataset design                            |
| [EVAL_RUBRIC.md](./EVAL_RUBRIC.md)                                           | Evaluation method for PM-quality behavior                       |
| [PAPER_OUTLINE.md](./PAPER_OUTLINE.md)                                       | Draft paper structure                                           |

## Key Commands

### Run The App

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up --build -d
```

### Stop The App

```bash
docker compose --env-file .env.docker down
```

### Run Core Checks

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm pre-push
```

### Run Benchmark Comparison

```bash
pnpm benchmark:compare
```

## Environment Summary

Minimum local Docker requirement:

```env
OPENAI_API_KEY=sk-your-openai-key
```

Optional depending on the path you are testing:

- `GOOGLE_EMAIL`
- `GOOGLE_PASSWORD`
- `DEEPGRAM_API_KEY`

For more detail, see [ENVIRONMENT.md](./ENVIRONMENT.md).
