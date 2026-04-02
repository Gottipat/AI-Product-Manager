# Database Architecture Overview

> **Owner**: @KumarSashank  
> **Package**: `@meeting-ai/ai-backend`  
> **Last Updated**: 2024-02-06

## Tech Stack

| Component  | Technology     | Purpose                            |
| ---------- | -------------- | ---------------------------------- |
| ORM        | Drizzle ORM    | Type-safe, lightweight SQL toolkit |
| Database   | PostgreSQL 14+ | Primary data store                 |
| Local Dev  | Docker Compose | Containerized PostgreSQL           |
| Production | Supabase       | Managed PostgreSQL with pgvector   |
| Migrations | Drizzle Kit    | Schema-to-SQL generation           |

## Why These Choices?

### Drizzle ORM over Prisma

- **Lighter**: No binary dependencies, faster cold starts
- **Type-safe**: Full TypeScript inference
- **SQL-like**: Queries map closely to SQL
- **Tree-shaking**: Smaller bundle size

### Supabase over self-hosted

- **Managed**: Automatic backups, updates
- **pgvector**: Built-in for RAG embeddings
- **Free tier**: 500MB storage to start
- **Row-level security**: For future multi-tenancy

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      AI Backend                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   Routes    │───▶│ Repositories │───▶│   Drizzle    │   │
│  │  (Fastify)  │    │    Layer     │    │   Client     │   │
│  └─────────────┘    └──────────────┘    └──────┬───────┘   │
│                                                  │          │
└──────────────────────────────────────────────────┼──────────┘
                                                   │
                       ┌───────────────────────────▼──────────┐
                       │            PostgreSQL                 │
                       │  ┌─────────┐  ┌─────────┐  ┌──────┐  │
                       │  │meetings │  │  moms   │  │items │  │
                       │  └─────────┘  └─────────┘  └──────┘  │
                       └───────────────────────────────────────┘
```

## Connection Pooling

```typescript
const client = postgres(connectionString, {
  max: 10, // Max connections in pool
  idle_timeout: 20, // Close idle after 20s
  connect_timeout: 10,
});
```

**Why?**

- Prevents connection exhaustion
- Reuses connections efficiently
- Handles connection drops gracefully

## Quick Start

```bash
# 1. Start local PostgreSQL
docker-compose up -d postgres

# 2. Copy environment file
cp packages/ai-backend/.env.example packages/ai-backend/.env

# 3. Push schema to database
pnpm --filter @meeting-ai/ai-backend db:push

# 4. Open visual studio (optional)
pnpm --filter @meeting-ai/ai-backend db:studio
```

## Related Documentation

- [Schema Reference](./SCHEMA.md)
- [Migration Guide](./MIGRATIONS.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
