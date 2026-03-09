# System Architecture

## Overview

The Meeting AI system consists of two main services that communicate via REST/WebSocket APIs.

```
┌──────────────────────────────────────────────────────────────────┐
│                        Meeting AI System                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐       ┌──────────────────┐                      │
│  │ Google Meet │       │  Web Dashboard   │                      │
│  │   Session   │       │ (Next.js/React)  │                      │
│  └──────┬──────┘       └────────┬─────────┘                      │
│         │ Join                  │ REST/Auth                      │
│         ▼                       ▼                                │
│  ┌─────────────┐       ┌──────────────────┐                      │
│  │ Bot Runner  │──────▶│    AI Backend    │                      │
│  └─────────────┘       └────────┬─────────┘                      │
│                                 │                                │
│                        ┌────────▼─────────┐                      │
│                        │    PostgreSQL    │                      │
│                        └──────────────────┘                      │
└──────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Meeting Join Flow

```mermaid
sequenceDiagram
    participant Client
    participant Backend as AI Backend
    participant Bot as Bot Runner
    participant Meet as Google Meet

    Client->>Backend: Schedule bot join
    Backend->>Bot: Join request
    Bot->>Meet: Join meeting
    Meet-->>Bot: Admitted
    Bot->>Backend: Meeting started
    Backend-->>Client: Status update
```

### 2. Transcript Streaming Flow

```mermaid
sequenceDiagram
    participant Meet as Google Meet
    participant Bot as Bot Runner
    participant Backend as AI Backend
    participant DB as PostgreSQL

    Meet->>Bot: Caption appears
    Bot->>Bot: Parse & attribute speaker
    Bot->>Bot: Buffer into batch
    Bot->>Backend: Stream batch
    Backend->>DB: Store transcript
    Backend-->>Bot: Acknowledge
```

### 3. MoM Generation Flow

```mermaid
sequenceDiagram
    participant Backend as AI Backend
    participant AI as OpenAI
    participant DB as PostgreSQL

    Note over Backend: Meeting ended
    Backend->>DB: Load transcript
    Backend->>AI: Extract decisions
    Backend->>AI: Extract action items
    Backend->>AI: Generate summary
    Backend->>DB: Store MoM
```

## Package Dependencies

```
@meeting-ai/shared
        ▲
        │ (workspace:*)
   ┌────┼────┐
   │    │    │
   ▼    ▼    ▼
 bot   ai   web
runner backend

```

## Technology Stack

| Component  | Technology             |
| ---------- | ---------------------- |
| Web App    | Next.js 14, React      |
| Bot Runner | Playwright, TypeScript |
| AI Backend | Fastify, TypeScript    |
| AI/LLM     | OpenAI GPT-4           |
| Database   | PostgreSQL             |
| Auth       | JWT, bcrypt            |
| Testing    | Vitest                 |
