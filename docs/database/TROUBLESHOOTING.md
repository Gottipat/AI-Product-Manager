# Database Troubleshooting Guide

> Common issues, solutions, and debugging techniques.

---

## Connection Issues

### Error: "CONNECTION_REFUSED"

**Symptoms**: Cannot connect to database

**Causes & Solutions**:

1. **Docker not running**

   ```bash
   docker-compose up -d postgres
   docker-compose ps  # Check status
   ```

2. **Wrong DATABASE_URL**

   ```bash
   # Check .env file
   cat packages/ai-backend/.env

   # Default should be:
   DATABASE_URL=postgresql://meeting_ai:password@localhost:5432/meeting_ai
   ```

3. **Port conflict**
   ```bash
   lsof -i :5432  # Check what's using port
   ```

### Error: "AUTHENTICATION_FAILED"

**Solution**: Verify credentials in `docker-compose.yml` match `.env`:

```yaml
POSTGRES_USER: meeting_ai
POSTGRES_PASSWORD: password
POSTGRES_DB: meeting_ai
```

### Error: "DATABASE_NOT_EXIST"

**Solution**: Create database manually:

```bash
docker exec -it ai-product-manager-postgres-1 psql -U meeting_ai -c "CREATE DATABASE meeting_ai;"
```

---

## Schema Issues

### Error: "Relation already exists"

**Cause**: Trying to create table that exists

**Solution**:

```bash
# Option 1: Drop and recreate (DEV ONLY)
docker-compose down -v  # Removes volumes
docker-compose up -d postgres
pnpm --filter @meeting-ai/ai-backend db:push

# Option 2: Introspect existing schema
pnpm drizzle-kit introspect
```

### Error: "Column type mismatch"

**Cause**: Schema doesn't match database

**Solution**:

```bash
# Check current database schema
psql $DATABASE_URL -c "\d table_name"

# Compare with Drizzle schema
# Fix discrepancy in schema file
# Run db:push
```

### Error: "Unknown type: vector"

**Cause**: pgvector extension not enabled

**Solution (Supabase)**:

1. Go to Database → Extensions
2. Enable `vector` extension

**Solution (Local)**:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## Performance Issues

### Slow Queries

1. **Check query plan**

   ```sql
   EXPLAIN ANALYZE SELECT * FROM meetings WHERE ...;
   ```

2. **Add missing indexes**

   ```typescript
   // In schema, add index
   export const meetingIdIdx = index('meeting_id_idx').on(transcriptEvents.meetingId);
   ```

3. **Use connection pooling** (already configured in db/index.ts)

### Connection Pool Exhausted

**Symptoms**: "Too many connections" error

**Solution**: Adjust pool settings:

```typescript
const client = postgres(connectionString, {
  max: 20, // Increase if needed
});
```

---

## Data Issues

### Duplicate Records

Check unique constraints:

```sql
-- Find duplicates
SELECT meeting_id, COUNT(*)
FROM moms
GROUP BY meeting_id
HAVING COUNT(*) > 1;
```

### Missing Foreign Key Data

```sql
-- Find orphaned records
SELECT t.*
FROM transcript_events t
LEFT JOIN meetings m ON t.meeting_id = m.id
WHERE m.id IS NULL;
```

---

## Environment-Specific

### Local Docker PostgreSQL

```bash
# Restart container
docker-compose restart postgres

# View logs
docker-compose logs -f postgres

# Access psql
docker exec -it ai-product-manager-postgres-1 psql -U meeting_ai -d meeting_ai
```

### Supabase Production

1. **Check connection limits**: Free tier = 60 connections
2. **View logs**: Dashboard → Logs → Postgres
3. **Check extensions**: Dashboard → Database → Extensions

---

## Debugging Drizzle Queries

Enable query logging:

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';

export const db = drizzle(client, {
  schema,
  logger: true, // Logs all queries
});
```

---

## Getting Help

1. Check [Drizzle ORM Docs](https://orm.drizzle.team)
2. Check [Supabase Docs](https://supabase.com/docs)
3. Run Drizzle Studio: `pnpm --filter @meeting-ai/ai-backend db:studio`
