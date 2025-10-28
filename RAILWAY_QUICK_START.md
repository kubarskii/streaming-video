# 🚂 Railway Quick Start (5 Minutes)

## Copy-Paste Environment Variables

### 1. Generate Secrets First:
```bash
node scripts/generate-secrets.js
```

### 2. Add PostgreSQL Database First:
Click **"+ New" → "Database" → "PostgreSQL"**
(Railway automatically sets DATABASE_URL)

### 3. Copy All Variables to Railway Dashboard:

Go to: **Railway Project → Your Service → Variables Tab**

```
NODE_ENV=production
STORAGE_MODE=b2
B2_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_REGION=eu-central-003
B2_KEY_ID=your_backblaze_key_id
B2_KEY_SECRET=your_backblaze_key_secret
B2_BUCKET=your-bucket-name
CDN_BASE_URL=https://f003.backblazeb2.com/file/your-bucket-name
JWT_SECRET=<PASTE_FROM_GENERATE_SECRETS>
JWT_EXPIRES_IN=7d
ARGON2_SECRET=<PASTE_FROM_GENERATE_SECRETS>
```

⚠️ **Don't set DATABASE_URL manually** - Railway auto-connects it!

### 4. Verify Prisma Schema:

Your `prisma/schema.prisma` should already have:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

✅ Already configured!

### 5. Deploy:
```bash
git add .
git commit -m "Setup for Railway deployment"
git push origin main
```

**Done!** 🎉

Railway will:
1. Build frontend → `public/`
2. Install dependencies
3. Run migrations
4. Start server

**View logs:**
```bash
railway logs
```

**Open app:**
```bash
railway open
```

