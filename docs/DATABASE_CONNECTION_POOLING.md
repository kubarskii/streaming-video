# Database Connection Pooling Configuration

## Problem

When running multiple services (gateway, upload, streaming, worker) simultaneously, the application was exhausting PostgreSQL's connection limit with the error:

```
FATAL: sorry, too many clients already
```

## Root Cause

- The application runs **4 separate Node.js processes** concurrently
- Each process creates a Prisma Client instance
- By default, each Prisma Client creates a connection pool of **10 connections**
- Total potential connections: **4 processes × 10 connections = 40 connections**
- Railway PostgreSQL default limit: **~20-100 connections** (varies by plan)

## Solution

### 1. Connection Pool Limiting

Updated `src/infrastructure/config/DatabaseConfig.js` to automatically add connection pool parameters:

```javascript
connection_limit=5    // Max 5 connections per service (4 services = 20 total)
pool_timeout=10       // 10 second timeout for acquiring connections
```

### 2. Singleton Pattern

Ensured all services use the `DatabaseConfig.getPrismaClient()` singleton instead of creating new `PrismaClient` instances. This was fixed in:

- ✅ `worker.js` - Now uses DatabaseConfig singleton
- ✅ `server.js` - Already using singleton
- ✅ `services/gateway/server.js` - Uses singleton
- ✅ `services/upload/server.js` - Uses singleton  
- ✅ `services/streaming/server.js` - Uses singleton

## Connection Math

With the fix applied:

- **Gateway Service**: 5 connections max
- **Upload Service**: 5 connections max
- **Streaming Service**: 5 connections max
- **Worker Process**: 5 connections max
- **Total**: ~20 connections maximum

This leaves headroom for:
- Prisma Migrate operations during deployment
- Database management tools
- Other services

## Alternative Solutions

### Option 1: Use Connection Pooler (Recommended for Production)

Add PgBouncer or Railway's connection pooler in front of PostgreSQL:

```bash
# Railway Connection Pooler URL format
DATABASE_URL="postgresql://user:pass@host:port/db?pgbouncer=true"
```

### Option 2: Increase Database Connection Limit

For Railway PostgreSQL, you can request a higher connection limit based on your plan, but this doesn't scale well with many services.

### Option 3: Reduce Number of Services

Consider combining services or using a monolith architecture:

```bash
npm run start:monolith  # Runs combined server + worker
```

## Monitoring

To check current connection count in PostgreSQL:

```sql
SELECT count(*) FROM pg_stat_activity WHERE datname = 'railway';
```

To see connections by application:

```sql
SELECT application_name, count(*) 
FROM pg_stat_activity 
WHERE datname = 'railway' 
GROUP BY application_name;
```

## Deployment

After making these changes:

1. Regenerate Prisma Client:
   ```bash
   npx prisma generate
   ```

2. Redeploy the application:
   ```bash
   git add .
   git commit -m "Fix: Configure connection pooling to prevent database exhaustion"
   git push
   ```

3. Railway will automatically rebuild and redeploy

## References

- [Prisma Connection Management](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [PostgreSQL Connection Pooling](https://www.postgresql.org/docs/current/runtime-config-connection.html)
- [Railway PostgreSQL Limits](https://docs.railway.app/databases/postgresql)

