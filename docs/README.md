# Meeting AI Documentation

> Complete documentation hub for the Context-Aware AI Meeting System

## Quick Links

| Doc                                 | Purpose                             |
| ----------------------------------- | ----------------------------------- |
| [Getting Started](#getting-started) | Set up your development environment |
| [Architecture](./ARCHITECTURE.md)   | System design and package structure |
| [API Contracts](./API_CONTRACTS.md) | API endpoints and data formats      |
| [Database](./database/OVERVIEW.md)  | Schema, migrations, and operations  |
| [Testing](./TESTING.md)             | Test conventions and running tests  |
| [Contributing](./CONTRIBUTING.md)   | Code style and PR process           |
| [Developer Tooling](./TOOLING.md)   | Pre-push hooks, linting, formatting |
| [Docker Run](./DOCKER_RUN.md)       | Team Docker setup and run guide     |

---

## Getting Started

```bash
# 1. Clone and install
git clone https://github.com/KumarSashank/AI-Product-Manager.git
cd AI-Product-Manager
pnpm install

# 2. Start local services
docker compose up -d postgres

# 3. Set up database
cp packages/ai-backend/.env.example packages/ai-backend/.env
pnpm --filter @meeting-ai/ai-backend db:push

# 4. Run development servers
pnpm dev
```

---

## Documentation Index

### Architecture & Design

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System overview, package responsibilities, data flow
- [API_CONTRACTS.md](./API_CONTRACTS.md) - REST endpoints, WebSocket events, validation schemas

### Database

- [database/OVERVIEW.md](./database/OVERVIEW.md) - Tech stack, architecture, quick start
- [database/SCHEMA.md](./database/SCHEMA.md) - Complete table reference with all columns
- [database/MIGRATIONS.md](./database/MIGRATIONS.md) - How to create and apply migrations
- [database/TROUBLESHOOTING.md](./database/TROUBLESHOOTING.md) - Common issues and fixes
- [database/RUNBOOK.md](./database/RUNBOOK.md) - Operations procedures, backup, recovery

### AI Pipeline

- [AI_PIPELINE.md](./AI_PIPELINE.md) - OpenAI integration, MoM generation, RAG search
- [ENVIRONMENT.md](./ENVIRONMENT.md) - Environment variables and configuration

### Development

- [TESTING.md](./TESTING.md) - Test framework, conventions, coverage requirements
- [TOOLING.md](./TOOLING.md) - Git hooks, linting, formatting, CI/CD
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Branch strategy, code style, PR process
- [DOCKER_RUN.md](./DOCKER_RUN.md) - Full Docker Compose workflow for teammates

---

## Package Documentation

Each package has its own README:

| Package                  | README                                                            | Description                      |
| ------------------------ | ----------------------------------------------------------------- | -------------------------------- |
| `@meeting-ai/shared`     | [packages/shared/README.md](../packages/shared/README.md)         | Shared types, schemas, constants |
| `@meeting-ai/bot-runner` | [packages/bot-runner/README.md](../packages/bot-runner/README.md) | Google Meet bot (Playwright)     |
| `@meeting-ai/ai-backend` | [packages/ai-backend/README.md](../packages/ai-backend/README.md) | AI extraction, MoM, RAG          |

---

## Team Ownership

| Package      | Owner         | Contact                 |
| ------------ | ------------- | ----------------------- |
| `shared`     | Both          | -                       |
| `bot-runner` | @Gottipat     | Google Meet integration |
| `ai-backend` | @KumarSashank | AI/ML processing        |

---

## Changelog

| Date       | Change                                | Author        |
| ---------- | ------------------------------------- | ------------- |
| 2024-02-06 | Initial documentation structure       | @KumarSashank |
| 2024-02-06 | Added database documentation (5 docs) | @KumarSashank |
| 2024-02-06 | Added testing documentation           | @KumarSashank |
| 2024-02-06 | Added tooling documentation           | @KumarSashank |
