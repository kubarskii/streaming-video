# 🚂 Railway Quick Start (5 Minutes)

## Copy-Paste Environment Variables

### 1. Generate Secrets First:
```bash
node scripts/generate-secrets.js
```

### 2. Copy All Variables to Railway Dashboard:

Go to: **Railway Project → Your Service → Variables Tab**

```
NODE_ENV=production
STORAGE_MODE=b2
B2_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_REGION=eu-central-003
B2_KEY_ID=003e7247e8a0a2d0000000001
B2_KEY_SECRET=K003Q90g0K6UfM54D0AzUDh2L2DKO2Q
B2_BUCKET=video-platform-key
CDN_BASE_URL=
JWT_SECRET=<PASTE_FROM_GENERATE_SECRETS>
JWT_EXPIRES_IN=7d
ARGON2_SECRET=<PASTE_FROM_GENERATE_SECRETS>
```

### 3. Add PostgreSQL:
Click **"+ New" → "Database" → "PostgreSQL"**
(DATABASE_URL is auto-set)

### 4. Update Code for PostgreSQL:

**Edit `prisma/schema.prisma`:**
```prisma
datasource db {
  provider = "postgresql"  // Change from "sqlite"
  url      = env("DATABASE_URL")
}
```

**Run migration:**
```bash
npx prisma migrate dev --name postgresql
```

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

