# Database Operations Runbook

> Operational procedures for database maintenance, backup, and recovery.

---

## Daily Operations

### Health Check

```bash
# Check PostgreSQL is running
docker-compose ps

# Check connection count (Supabase)
# Dashboard → Database → Insights → Connections
```

### Monitor Query Performance

```sql
-- Top slow queries (Supabase Dashboard → Logs → Postgres)
-- Or run:
SELECT query, calls, mean_time, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

---

## Backup Procedures

### Local Development

```bash
# Backup
docker exec ai-product-manager-postgres-1 pg_dump -U meeting_ai meeting_ai > backup.sql

# Restore
docker exec -i ai-product-manager-postgres-1 psql -U meeting_ai meeting_ai < backup.sql
```

### Supabase Production

Supabase handles automatic daily backups. Manual backup:

1. Dashboard → Settings → Database
2. Click "Download backup"

**Point-in-time recovery**: Available on Pro plan

---

## Disaster Recovery

### Scenario: Database Corruption

1. **Stop application** to prevent further writes
2. **Restore from backup**
   - Supabase: Dashboard → Settings → Restore
   - Local: Use backup.sql
3. **Verify data integrity**
   ```sql
   SELECT COUNT(*) FROM meetings;
   SELECT COUNT(*) FROM transcript_events;
   ```
4. **Resume application**

### Scenario: Connection Pool Exhausted

1. **Identify cause**
   ```sql
   SELECT count(*), state FROM pg_stat_activity GROUP BY state;
   ```
2. **Kill idle connections**
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle' AND query_start < NOW() - INTERVAL '1 hour';
   ```
3. **Increase pool size** if needed

---

## Maintenance Tasks

### Weekly: Vacuum and Analyze

```sql
-- Run during low-traffic period
VACUUM ANALYZE meetings;
VACUUM ANALYZE transcript_events;
VACUUM ANALYZE meeting_items;
```

### Monthly: Check Index Usage

```sql
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

Drop unused indexes to improve write performance.

### Quarterly: Review Table Size

```sql
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

---

## Emergency Contacts

| Role             | Contact                        |
| ---------------- | ------------------------------ |
| Database Owner   | @KumarSashank                  |
| Supabase Support | support@supabase.io (Pro plan) |

---

## Change Log

| Date       | Change                  | Author        |
| ---------- | ----------------------- | ------------- |
| 2024-02-06 | Initial runbook created | @KumarSashank |
