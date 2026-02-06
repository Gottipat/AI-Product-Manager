# Database Migrations Guide

> How to create, manage, and apply database migrations.

## Quick Reference

| Command                                            | Description                     |
| -------------------------------------------------- | ------------------------------- |
| `pnpm --filter @meeting-ai/ai-backend db:generate` | Generate migration files        |
| `pnpm --filter @meeting-ai/ai-backend db:push`     | Push schema directly (dev only) |
| `pnpm --filter @meeting-ai/ai-backend db:studio`   | Open Drizzle Studio GUI         |

---

## Development Workflow

### Option 1: Direct Push (Recommended for Dev)

For rapid iteration during development:

```bash
# Edit schema files in src/db/schema/

# Push changes directly to database
pnpm --filter @meeting-ai/ai-backend db:push
```

**Pros**: Fast, no migration files to manage  
**Cons**: No version control of schema changes

### Option 2: Migration Files

For production-ready changes:

```bash
# 1. Edit schema files

# 2. Generate migration SQL
pnpm --filter @meeting-ai/ai-backend db:generate

# 3. Review generated SQL in drizzle/ folder

# 4. Apply migration
pnpm --filter @meeting-ai/ai-backend db:push
```

---

## Production Workflow

### Supabase Migrations

1. **Generate migration locally**

   ```bash
   pnpm --filter @meeting-ai/ai-backend db:generate
   ```

2. **Review SQL file** in `packages/ai-backend/drizzle/`

3. **Apply via Supabase Dashboard**
   - Go to SQL Editor
   - Paste migration SQL
   - Run in transaction

4. **Commit migration file** to version control

### Rollback Strategy

Drizzle doesn't auto-generate rollback migrations. For critical changes:

1. Create manual rollback SQL
2. Store in `drizzle/rollbacks/` folder
3. Test rollback in staging before production

---

## Schema Change Best Practices

### Adding a Column

```typescript
// In schema file, add new column with default
newColumn: text('new_column').default('value'),

// Run db:push - safe, adds column with default
```

### Adding a Required Column

```typescript
// Step 1: Add with default
newColumn: text('new_column').default('temp').notNull(),

// Step 2: Migrate data
// UPDATE table SET new_column = calculated_value;

// Step 3: Remove default if needed
```

### Renaming a Column

⚠️ **HIGH RISK** - Causes downtime if not handled carefully.

1. Add new column
2. Migrate data
3. Update application code
4. Remove old column

### Deleting a Column

1. Remove from application code first
2. Deploy application
3. Drop column in next release

---

## Common Issues

### "Column already exists"

Schema is out of sync. Run `db:push` with `--force` or:

```bash
# Connect to database
psql $DATABASE_URL

# Check current schema
\d table_name
```

### "Cannot drop column with dependencies"

Check for foreign keys or indexes. Drop dependencies first.

### "Transaction failed"

For large migrations, break into smaller transactions.

---

## Drizzle Studio

Visual interface for exploring data:

```bash
pnpm --filter @meeting-ai/ai-backend db:studio
```

Opens at http://local.drizzle.studio

**Features**:

- Browse tables and data
- Run queries
- Edit records (dev only)
