# Environment Configuration

## Quick Start

```bash
# Copy example to .env
cp packages/ai-backend/.env.example packages/ai-backend/.env

# Edit and add your values
nano packages/ai-backend/.env
```

For Docker-based local runs, use the root Docker env template instead:

```bash
cp .env.docker.example .env.docker
```

See [docs/DOCKER_RUN.md](./DOCKER_RUN.md) for the full Docker workflow.

## Required Variables

### Database

```env
DATABASE_URL=postgresql://user:password@host:5432/database
```

| Environment  | Example Value                                                             |
| ------------ | ------------------------------------------------------------------------- |
| Local Docker | `postgresql://meeting_ai:password@localhost:5432/meeting_ai`              |
| Supabase     | `postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres` |

### OpenAI API

```env
OPENAI_API_KEY=sk-your-api-key-here
```

**How to get your key:**

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click "Create new secret key"
3. Copy and paste into your `.env` file

> ⚠️ **Never commit `.env` files to git.** The `.gitignore` already excludes them.

## Optional Variables

### Server Configuration

| Variable   | Default       | Description      |
| ---------- | ------------- | ---------------- |
| `PORT`     | `3000`        | API server port  |
| `NODE_ENV` | `development` | Environment mode |

### OpenAI Models

| Variable                 | Default                  | Description           |
| ------------------------ | ------------------------ | --------------------- |
| `OPENAI_MODEL`           | `gpt-4o`                 | Chat completion model |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model       |

### Supabase (Production)

| Variable            | Description              |
| ------------------- | ------------------------ |
| `SUPABASE_URL`      | Project URL              |
| `SUPABASE_ANON_KEY` | Anonymous key for client |

## Environment-Specific Configs

### Development

```env
DATABASE_URL=postgresql://meeting_ai:password@localhost:5432/meeting_ai
PORT=3000
NODE_ENV=development
OPENAI_API_KEY=sk-...
```

### Production

```env
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
PORT=3000
NODE_ENV=production
OPENAI_API_KEY=sk-...
# Add rate limiting, monitoring, etc.
```

## Validation

The application validates all required environment variables at startup:

```typescript
// Fails fast if OPENAI_API_KEY is missing
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
```

## Security Best Practices

1. **Never commit secrets** - Use `.env` files (gitignored)
2. **Use different keys per environment** - Dev/staging/prod
3. **Rotate keys periodically** - Especially after team member changes
4. **Use secret management** - Consider Vault, AWS Secrets Manager for production
