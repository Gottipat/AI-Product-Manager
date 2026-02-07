# AI Pipeline Documentation

## Overview

The AI Pipeline transforms meeting transcripts into structured, actionable insights using OpenAI's GPT-4o model with structured outputs (Zod schemas).

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Bot Runner     │────▶│  AI Backend     │────▶│   PostgreSQL    │
│ (Transcription) │     │  (Processing)   │     │   (Storage)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   OpenAI API    │
                        │   (GPT-4o)      │
                        └─────────────────┘
```

## Components

### 1. OpenAI Service (`services/openai.service.ts`)

Core wrapper for OpenAI API interactions.

| Method                           | Purpose                                  |
| -------------------------------- | ---------------------------------------- |
| `generateMoM(transcript)`        | Full MoM with summary, highlights, items |
| `extractActionItems(transcript)` | Extract 14 meeting item types            |
| `generateEmbedding(text)`        | Create embedding for semantic search     |
| `estimateTokens(text)`           | Count tokens for context management      |

**Zod Schemas** ensure type-safe, validated AI outputs:

- `ExecutiveSummarySchema` - Meeting summary structure
- `HighlightSchema` - Key points, quotes, outcomes
- `ActionItemSchema` - All 14 item types with metadata
- `MoMResponseSchema` - Complete MoM structure

### 2. MoM Pipeline (`pipelines/mom.pipeline.ts`)

Orchestrates the full MoM generation flow:

```
Transcript → OpenAI Processing → Database Storage
     │              │                    │
     │              ▼                    ▼
     │       ┌──────────────┐    ┌──────────────┐
     │       │ Highlights   │    │ MoM Record   │
     │       │ Action Items │    │ Progress     │
     │       └──────────────┘    └──────────────┘
     │
     ▼
Progress Tracking (in-memory)
```

### 3. Action Items Pipeline (`pipelines/actionItems.pipeline.ts`)

Standalone extraction of all 14 meeting item types:

| Type             | Description              |
| ---------------- | ------------------------ |
| `action_item`    | Tasks to be completed    |
| `decision`       | Decisions made           |
| `announcement`   | Information shared       |
| `project_update` | Status updates           |
| `blocker`        | Issues blocking progress |
| `idea`           | Suggestions proposed     |
| `question`       | Questions raised         |
| `risk`           | Risks identified         |
| `commitment`     | Promises made            |
| `deadline`       | Dates mentioned          |
| `dependency`     | External dependencies    |
| `parking_lot`    | Deferred topics          |
| `key_takeaway`   | Important insights       |
| `reference`      | Resources mentioned      |

### 4. RAG Service (`services/rag.service.ts`)

Semantic search across meeting content:

```typescript
// Index content for search
await ragService.indexContent(meetingId, 'transcript', content);

// Search across all meetings
const results = await ragService.search('budget allocation', { limit: 10 });

// Get context for RAG-based Q&A
const context = await ragService.getContext('What was decided?', {
  maxTokens: 8000,
  meetingId: 'optional-filter',
});
```

## API Endpoints

| Endpoint                             | Method | Description               |
| ------------------------------------ | ------ | ------------------------- |
| `/api/v1/meetings/:id/generate-mom`  | POST   | Trigger MoM generation    |
| `/api/v1/meetings/:id/ai-status`     | GET    | Check generation progress |
| `/api/v1/meetings/:id/extract-items` | POST   | Extract action items      |
| `/api/v1/search`                     | POST   | Semantic search           |
| `/api/v1/context`                    | POST   | Get RAG context           |

## Configuration

### Required Environment Variables

```env
OPENAI_API_KEY=sk-your-api-key-here
```

### Optional Configuration

```env
OPENAI_MODEL=gpt-4o                      # Default model
OPENAI_EMBEDDING_MODEL=text-embedding-3-small  # Embedding model
```

## Testing

All AI components are tested with mocked OpenAI responses:

```bash
pnpm --filter @meeting-ai/ai-backend test
```

**Test Coverage:**

- Schema validation (Zod)
- Pipeline error handling
- Progress tracking
- Statistics calculation
- Route integration

## Error Handling

The pipeline handles:

- Missing transcripts
- OpenAI rate limits
- Invalid API responses
- Empty results

All errors are captured and returned with structured error messages.
