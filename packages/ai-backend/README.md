# @meeting-ai/ai-backend

> 🧠 **Owner**: You (Kumar Sashank)
>
> AI extraction, MoM generation, and RAG system for meeting analysis

## Overview

This package handles:

- Receiving and storing transcript streams from Bot Runner
- AI-powered extraction of key information (decisions, action items)
- Minutes of Meeting (MoM) generation
- Task/progress tracking across recurring meetings (longitudinal analysis)
- RAG system for context retrieval

## Architecture

```
src/
├── api/            # REST/WebSocket endpoints
│   ├── routes/         # Fastify route handlers
│   ├── middleware/     # Auth, validation, logging
│   └── server.ts       # Fastify server setup
├── extraction/     # AI extraction pipelines
│   ├── prompts/        # LLM prompt templates
│   ├── chains/         # Extraction chains
│   └── parser.ts       # Response parsing
├── mom/            # Minutes of Meeting
│   ├── generator.ts    # MoM document generation
│   └── templates/      # Output templates
├── tasks/          # Task tracking
│   ├── extractor.ts    # Action item extraction
│   ├── tracker.ts      # Progress tracking logic
│   └── longitudinal.ts # Cross-meeting analysis
├── rag/            # RAG system
│   ├── embeddings.ts   # Text embeddings
│   ├── retriever.ts    # Context retrieval
│   └── index.ts        # Vector store setup
├── storage/        # Database layer
│   ├── repositories/   # Data access
│   └── models/         # Database models
└── index.ts        # Entry point
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Development mode
pnpm dev

# Build
pnpm build

# Run tests
pnpm test
```

## Environment Variables

```env
# Required
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...

# Optional
PORT=3000
LOG_LEVEL=info
```

## API Endpoints

### From Bot Runner

| Method | Endpoint                           | Description                  |
| ------ | ---------------------------------- | ---------------------------- |
| POST   | `/api/v1/stream/transcript`        | Receive transcript batches   |
| POST   | `/api/v1/meetings/start`           | Meeting started notification |
| POST   | `/api/v1/meetings/:id/end`         | Meeting ended notification   |
| POST   | `/api/v1/meetings/:id/participant` | Participant update           |

### For Clients

| Method | Endpoint                      | Description                  |
| ------ | ----------------------------- | ---------------------------- |
| GET    | `/api/v1/meetings/:id/mom`    | Get Minutes of Meeting       |
| GET    | `/api/v1/meetings/:id/tasks`  | Get extracted tasks          |
| GET    | `/api/v1/series/:id/progress` | Longitudinal progress report |
| POST   | `/api/v1/rag/query`           | Query meeting context        |

## Data Flow

```
Bot Runner → [Transcript Stream] → AI Backend
                                      ↓
                              [Store Transcript]
                                      ↓
                              [AI Extraction]
                                      ↓
                    [MoM Generation] + [Task Extraction]
                                      ↓
                          [Longitudinal Analysis]
                                      ↓
                              [RAG Indexing]
```
