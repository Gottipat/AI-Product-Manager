# Context-Aware AI Meeting System

> Longitudinal analysis of recurring meetings with AI-powered insights

[![CI Pipeline](https://github.com/YOUR_ORG/AI-Product-Manager/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_ORG/AI-Product-Manager/actions/workflows/ci.yml)

## Overview

A system that joins Google Meet sessions as a bot participant, captures live captions with speaker attribution, and streams transcripts to an AI backend for extraction, MoM generation, and longitudinal task tracking.

### Key Features

- 🤖 **Bot Participant**: Joins meetings when invited (no covert recording)
- 📝 **Live Captions**: Captures speaker-attributed transcripts in real-time
- 🧠 **AI Extraction**: Identifies decisions, action items, and key points
- 📋 **MoM Generation**: Produces structured Minutes of Meeting
- 📊 **Progress Tracking**: Tracks action items across recurring meetings
- 🔍 **RAG System**: Contextual retrieval for historical meeting data

## Architecture

```
┌─────────────────┐         ┌─────────────────┐
│   Google Meet   │         │     Clients     │
│                 │         │   (Dashboard)   │
└────────┬────────┘         └────────┬────────┘
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│   Bot Runner    │────────▶│   AI Backend    │
│  (Playwright)   │ Stream  │   (Fastify)     │
│                 │         │                 │
│ • Join Meet     │         │ • Store Data    │
│ • Capture Caps  │         │ • AI Extraction │
│ • Stream Events │         │ • MoM Gen       │
└─────────────────┘         │ • RAG System    │
                            └─────────────────┘
```

## Team Ownership

| Package | Owner | Description |
|---------|-------|-------------|
| `@meeting-ai/shared` | Both | Types, schemas, API contracts |
| `@meeting-ai/bot-runner` | Friend | Playwright bot, caption capture |
| `@meeting-ai/ai-backend` | You | AI extraction, MoM, RAG |

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+

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

### Development

```bash
# Run all packages in dev mode
pnpm dev

# Run specific package
pnpm --filter @meeting-ai/ai-backend dev
pnpm --filter @meeting-ai/bot-runner dev
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @meeting-ai/shared test
```

## Project Structure

```
AI-Product-Manager/
├── packages/
│   ├── shared/           # Shared types & contracts
│   ├── bot-runner/       # Playwright bot
│   └── ai-backend/       # AI processing server
├── docs/                 # Documentation
├── .github/              # GitHub workflows
└── scripts/              # Utility scripts
```

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
