# SQLite to PostgreSQL Migration Guide

This guide will help you migrate your video streaming application from SQLite to PostgreSQL on Railway.

## Overview

We've updated the application to use PostgreSQL instead of SQLite. This provides:
- Better scalability and performance
- Improved concurrent access handling
- Better support for production workloads
- Native Railway integration

## Prerequisites

- Existing Railway project with your application
- Access to your current SQLite data (if you want to migrate it)
- Railway CLI (optional, but recommended)

## Migration Steps

### Step 1: Export Existing Data (Optional)

If you have existing data in SQLite that you want to preserve:

1. **Before deploying**, export your current SQLite data:
   ```bash
   npm run migrate:export
   ```

2. This creates a `data-export.sql` file with all your data.

3. **Keep this file safe** - you'll use it after setting up PostgreSQL.

### Step 2: Add PostgreSQL to Railway

#### Option A: Using Railway Dashboard

1. Go to your Railway project dashboard
2. Click **"+ New"** → **"Database"** → **"Add PostgreSQL"**
3. Railway will provision a PostgreSQL database
4. The `DATABASE_URL` environment variable will be automatically added

#### Option B: Using Railway CLI

```bash
railway add --database postgresql
```

### Step 3: Remove SQLite Volume (Important!)

1. In Railway dashboard, go to your service settings
2. Navigate to **"Volumes"** tab
3. **Remove** the `sqlite-data` volume (it's no longer needed)
4. This prevents unnecessary storage usage

### Step 4: Deploy Updated Code

1. **Commit and push your changes:**
   ```bash
   git add .
   git commit -m "Migrate from SQLite to PostgreSQL"
   git push
   ```

2. Railway will automatically:
   - Detect the changes
   - Install dependencies
   - Generate Prisma client for PostgreSQL
   - Run migrations (`prisma migrate deploy`)
   - Start your application

3. **Monitor the deployment logs** to ensure everything runs smoothly.

### Step 5: Import Existing Data (Optional)

If you exported data in Step 1:

1. **Get your PostgreSQL connection string:**
   ```bash
   railway variables --service postgresql
   ```
   
   Or from the Railway dashboard:
   - Click on PostgreSQL service
   - Go to **"Variables"** tab
   - Copy the `DATABASE_URL`

2. **Import your data using psql:**
   ```bash
   # On Unix/Mac/Linux:
   psql "$DATABASE_URL" -f data-export.sql
   
   # On Windows (PowerShell):
   $env:PGPASSWORD="your-password"; psql -h hostname -U username -d database -f data-export.sql
   ```

   Or use a PostgreSQL client like pgAdmin, DBeaver, or TablePlus to execute the SQL file.

3. **Verify your data:**
   ```bash
   railway run npx prisma studio
   ```

## Verification Checklist

After deployment, verify everything works:

- [ ] Application starts without errors
- [ ] Database connection is successful
- [ ] Users can log in
- [ ] Videos are displayed correctly
- [ ] Upload functionality works
- [ ] Playlists and subscriptions work
- [ ] Comments and likes function properly

## Important Changes

### Configuration Files Updated

1. **`prisma/schema.prisma`**
   - Changed provider from `sqlite` to `postgresql`

2. **`railway.json` and `railway.toml`**
   - Removed SQLite volume configuration
   - Updated start command to use `prisma migrate deploy`

3. **`package.json`**
   - Added `migrate:export` script for data export
   - Removed SQLite optimization script

### Removed Files

- `scripts/optimize-sqlite.js` (no longer needed with PostgreSQL)
- Old SQLite migration files

### New Files

- `scripts/migrate-sqlite-to-postgres.js` - Data export utility
- `prisma/migrations/20251102000000_init_postgresql/` - Initial PostgreSQL migration

## Troubleshooting

### Issue: "Error: P1001: Can't reach database server"

**Solution:** 
- Ensure PostgreSQL service is running in Railway
- Check that `DATABASE_URL` environment variable is set correctly
- Verify network connectivity between services

### Issue: "Migration failed"

**Solution:**
- Check deployment logs for specific error
- Ensure the database is empty before first migration
- Try running migrations manually: `railway run npx prisma migrate deploy`

### Issue: "Data import fails"

**Solution:**
- Ensure the database schema is created (migrations ran successfully)
- Check SQL file for syntax errors
- Import in smaller batches if file is large
- Verify foreign key constraints are satisfied

### Issue: "Application still tries to use SQLite"

**Solution:**
- Ensure you've committed all changes
- Force redeploy in Railway
- Check that `DATABASE_URL` points to PostgreSQL (should start with `postgresql://`)
- Clear build cache in Railway settings

## Environment Variables

Your Railway PostgreSQL service automatically provides these variables:

- `DATABASE_URL` - Full PostgreSQL connection string
- `PGHOST` - Database host
- `PGPORT` - Database port (default: 5432)
- `PGUSER` - Database user
- `PGPASSWORD` - Database password
- `PGDATABASE` - Database name

Your application only needs `DATABASE_URL`, which is automatically set when you add PostgreSQL.

## Rollback Plan

If you need to rollback to SQLite:

1. Revert the code changes:
   ```bash
   git revert HEAD
   git push
   ```

2. Re-add the SQLite volume in Railway dashboard

3. Restore your SQLite database file to the volume

## Performance Optimization

PostgreSQL is already optimized for production use, but consider these settings:

1. **Connection Pooling** (for high-traffic applications):
   - Use connection pooling in your DATABASE_URL
   - Example: `postgresql://user:pass@host:5432/db?connection_limit=10`

2. **Prisma Accelerate** (optional):
   - Consider Prisma Accelerate for caching and connection pooling
   - See: https://www.prisma.io/accelerate

3. **Database Indexes**:
   - Already configured in `schema.prisma`
   - Monitor query performance using Railway's metrics

## Support

If you encounter issues:

1. Check Railway deployment logs
2. Review Prisma migration logs
3. Verify database connectivity
4. Check GitHub issues for similar problems

## Next Steps

After successful migration:

1. **Monitor Performance**: Use Railway's metrics dashboard
2. **Set up Backups**: Configure Railway's automated backups
3. **Update Documentation**: Update any team documentation
4. **Clean Up**: Delete the `data-export.sql` file after confirming data integrity

---

**Migration Complete!** 🎉

Your application is now running on PostgreSQL with better scalability and performance.

