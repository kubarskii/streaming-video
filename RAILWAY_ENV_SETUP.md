# Railway Environment Variables Setup

## 🚂 Quick Setup for Railway

### Step 1: Generate Secrets

First, generate secure secrets locally:

```bash
node scripts/generate-secrets.js
```

**Copy the output** - you'll need it!

---

## Step 2: Set Environment Variables in Railway

### Option A: Using Railway Dashboard (Easiest)

1. Go to [railway.app](https://railway.app)
2. Select your project
3. Click on your service
4. Go to **"Variables"** tab
5. Click **"+ New Variable"**
6. Add each variable below:

### Required Variables:

```env
# Node Environment
NODE_ENV=production

# Server (Railway auto-sets PORT, but you can override)
PORT=3000

# Storage - Backblaze B2
STORAGE_MODE=b2
B2_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_REGION=eu-central-003
B2_KEY_ID=003e7247e8a0a2d0000000001
B2_KEY_SECRET=K003Q90g0K6UfM54D0AzUDh2L2DKO2Q
B2_BUCKET=video-platform-key
CDN_BASE_URL=

# Authentication (use values from generate-secrets.js)
JWT_SECRET=<paste-from-generate-secrets>
JWT_EXPIRES_IN=7d
ARGON2_SECRET=<paste-from-generate-secrets>

# Database (Railway auto-provides this when you add PostgreSQL)
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

### Option B: Using Railway CLI (Faster)

```bash
# Login to Railway
railway login

# Link to your project
railway link

# Generate and copy secrets
node scripts/generate-secrets.js

# Set all variables at once (correct Railway CLI syntax)
railway variables --set NODE_ENV=production
railway variables --set STORAGE_MODE=b2
railway variables --set B2_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
railway variables --set B2_REGION=eu-central-003
railway variables --set B2_KEY_ID=003e7247e8a0a2d0000000001
railway variables --set B2_KEY_SECRET=K003Q90g0K6UfM54D0AzUDh2L2DKO2Q
railway variables --set B2_BUCKET=video-platform-key
railway variables --set CDN_BASE_URL=""
railway variables --set JWT_SECRET="<paste-your-generated-secret>"
railway variables --set JWT_EXPIRES_IN=7d
railway variables --set ARGON2_SECRET="<paste-your-generated-secret>"

# DATABASE_URL is automatically set when you add PostgreSQL database
```

---

## Step 3: Add PostgreSQL Database

### Using Railway Dashboard:

1. In your project, click **"+ New"**
2. Select **"Database"**
3. Choose **"PostgreSQL"**
4. Railway automatically:
   - Creates the database
   - Sets `DATABASE_URL` variable
   - Links it to your service

### Using Railway CLI:

```bash
railway add --database postgres
```

**Important:** Railway automatically connects `DATABASE_URL` between services!

---

## Step 4: Update Prisma Schema for PostgreSQL

Before deploying, update your database provider:

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"  // Changed from "sqlite"
  url      = env("DATABASE_URL")
}
```

Then generate new migration locally:

```bash
npx prisma migrate dev --name postgresql
```

Commit and push:

```bash
git add .
git commit -m "Switch to PostgreSQL for production"
git push
```

---

## Step 5: Deploy

### Automatic Deploy (if connected to GitHub):
- Push to GitHub → Railway auto-deploys ✨

### Manual Deploy:
```bash
railway up
```

---

## 🔍 Verify Environment Variables

### Check variables in Railway:

**Dashboard:**
1. Go to your service
2. Click **"Variables"** tab
3. Verify all variables are set

**CLI:**
```bash
railway variables
```

---

## 🎯 Your Specific Configuration

Based on your current `.env`, here's what you need in Railway:

```env
NODE_ENV=production
STORAGE_MODE=b2
B2_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_REGION=eu-central-003
B2_KEY_ID=003e7247e8a0a2d0000000001
B2_KEY_SECRET=K003Q90g0K6UfM54D0AzUDh2L2DKO2Q
B2_BUCKET=video-platform-key
CDN_BASE_URL=
JWT_SECRET=<generate new for production>
JWT_EXPIRES_IN=7d
ARGON2_SECRET=<generate new for production>
```

**⚠️ IMPORTANT:** Generate NEW secrets for production (don't use dev secrets!)

---

## 📊 Railway-Specific Features

### Reference Other Services:

Railway allows you to reference variables from other services:

```env
# Reference PostgreSQL database
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Reference Redis (if you add it later)
REDIS_URL=${{Redis.REDIS_URL}}
```

### Railway Provides Automatically:

- `PORT` - The port your app should listen on
- `RAILWAY_ENVIRONMENT` - deployment environment
- `RAILWAY_PROJECT_ID` - your project ID
- `DATABASE_URL` - when PostgreSQL is added

---

## 🔐 Security Best Practices

### ✅ DO:
- Generate new secrets for production
- Use Railway's variable encryption (automatic)
- Keep secrets in Railway dashboard only
- Use `${{Service.VARIABLE}}` for service references

### ❌ DON'T:
- Commit production secrets to git
- Use development secrets in production
- Share secrets in screenshots
- Hard-code secrets in code

---

## 🧪 Test Configuration

After setting variables, test your deployment:

```bash
# Check logs
railway logs

# Open deployed app
railway open

# Run commands in Railway environment
railway run npm run migrate
```

---

## 🔄 Update Variables Later

### Dashboard:
1. Go to Variables tab
2. Click on variable to edit
3. Save changes
4. Railway auto-redeploys

### CLI:
```bash
# Update single variable
railway variables --set JWT_SECRET="new-secret-here"

# Delete variable
railway variables --unset OLD_VARIABLE
```

---

## 📝 Quick Checklist

Before deploying to Railway:

- [ ] Generated production secrets (`node scripts/generate-secrets.js`)
- [ ] Added PostgreSQL database in Railway
- [ ] Set all required environment variables
- [ ] Updated `prisma/schema.prisma` to use PostgreSQL
- [ ] Pushed code to GitHub (or ready for `railway up`)
- [ ] Verified B2 credentials are correct
- [ ] `public/` is in `.gitignore` ✓
- [ ] `npm run build` works locally ✓

---

## 🆘 Troubleshooting

### Issue: "DATABASE_URL is not defined"
**Fix:** Make sure PostgreSQL database is added and linked to your service

### Issue: Build fails
**Fix:** Check build logs in Railway dashboard:
```bash
railway logs --build
```

### Issue: App crashes on startup
**Fix:** Check runtime logs:
```bash
railway logs
```

### Issue: Can't connect to B2
**Fix:** Verify B2 credentials in Railway Variables tab

---

## 📚 Useful Railway Commands

```bash
# View logs (live)
railway logs

# View specific deployment
railway logs --deployment <id>

# Run migrations manually
railway run npx prisma migrate deploy

# Open database shell
railway run npx prisma studio

# Check service status
railway status

# Open deployed app
railway open
```

---

## 🎓 Next Steps After Setup

1. ✅ Deploy your app
2. ✅ Test video upload/streaming
3. ✅ Set up custom domain (optional)
4. ✅ Configure Cloudflare CDN for B2
5. ✅ Monitor logs and usage
6. ✅ Set up automated backups

---

**Need help?** 
- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway

