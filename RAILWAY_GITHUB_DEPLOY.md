# 🚂 Railway Automatic GitHub Deployment Guide

## How Railway Auto-Detection Works

When you deploy from GitHub, Railway **automatically detects**:

✅ **Node.js Project** - Detects `package.json`  
✅ **Build Scripts** - Runs `npm install`, `postinstall`, `build`  
✅ **Prisma Schema** - Detects `prisma/schema.prisma`  
✅ **PostgreSQL Need** - Suggests adding PostgreSQL when it sees Prisma with `postgresql` provider  

---

## 📋 One-Click Deployment Setup

### Step 1: Push Your Code to GitHub

```bash
git add .
git commit -m "Ready for Railway deployment"
git push origin master
```

### Step 2: Deploy from GitHub in Railway Dashboard

1. Go to https://railway.app/dashboard
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway to access your GitHub
5. Select your repository

### Step 3: Railway Auto-Detection Happens

Railway will automatically:
1. ✅ Detect Node.js (from `package.json`)
2. ✅ Detect Prisma (from `prisma/schema.prisma`)
3. ✅ Show suggestion: **"Add PostgreSQL"**
4. ✅ Click the suggestion to add PostgreSQL service
5. ✅ Railway auto-connects `DATABASE_URL` between services

### Step 4: Add Environment Variables

In Railway Dashboard → Your Web Service → Variables:

```env
NODE_ENV=production
STORAGE_MODE=b2
B2_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_REGION=eu-central-003
B2_KEY_ID=<your_key>
B2_KEY_SECRET=<your_secret>
B2_BUCKET=<your_bucket>
CDN_BASE_URL=<your_cdn_url>
JWT_SECRET=<generate_with_script>
JWT_EXPIRES_IN=7d
ARGON2_SECRET=<generate_with_script>
```

⚠️ **DATABASE_URL** is automatically set - don't add it manually!

---

## 🔄 What Railway Does Automatically

### Build Phase:
```bash
1. npm install                    # Auto-detected
2. npm run postinstall            # Runs: prisma generate
3. npm run build                  # Builds frontend → public/
```

### Deploy Phase (from Procfile):
```bash
npx prisma db push --skip-generate && npm start
```

This:
- ✅ Creates database tables on first deploy
- ✅ Updates schema on subsequent deploys  
- ✅ Starts your Node.js server

---

## 💾 Volume Configuration (Optional)

### If Using Local Storage Mode:

You can add a volume for persistent storage:

1. Go to your **Web Service** → **Settings** → **Volumes**
2. Click **"+ New Volume"**
3. **Mount Path**: `/app/videos`
4. **Size**: Choose appropriate size

Update your env:
```env
STORAGE_MODE=local
LOCAL_STORAGE_PATH=/app/videos
```

### For B2 Storage (Recommended):

No volume needed! Videos stored in Backblaze B2.

---

## 🔗 Database Auto-Connection

Railway automatically creates a **private network** connection:

```
Your Web Service:
  DATABASE_URL → postgres.railway.internal:5432/railway
  
PostgreSQL Service:
  DATABASE_URL ← Automatically provided
```

**Benefits:**
- ✅ Free internal networking (no egress fees)
- ✅ Low latency
- ✅ Secure private connection
- ✅ No manual configuration needed

---

## 📊 Deployment Flow Diagram

```
GitHub Push
    ↓
Railway Detects Changes
    ↓
┌─────────────────────┐
│   Build Phase       │
├─────────────────────┤
│ 1. npm install      │
│ 2. prisma generate  │
│ 3. npm run build    │
└─────────────────────┘
    ↓
┌─────────────────────┐
│   Deploy Phase      │
├─────────────────────┤
│ 1. prisma db push   │
│ 2. npm start        │
└─────────────────────┘
    ↓
✅ App Running!
```

---

## 🧪 Testing Auto-Deployment

### First Deploy:
1. Push code to GitHub
2. Railway builds and deploys
3. Check logs: `railway logs`
4. Visit your app: Click "Open App" in Railway dashboard

### Subsequent Deploys:
Just push to GitHub - Railway auto-redeploys!

```bash
git add .
git commit -m "Update feature"
git push origin master
```

Railway automatically:
1. Detects the push
2. Builds the app
3. Runs database sync
4. Deploys new version
5. Zero downtime deployment

---

## 🔐 Environment Variables Checklist

Required variables (set in Railway dashboard):

- [ ] `NODE_ENV=production`
- [ ] `STORAGE_MODE=b2`
- [ ] `B2_ENDPOINT=...`
- [ ] `B2_REGION=...`
- [ ] `B2_KEY_ID=...`
- [ ] `B2_KEY_SECRET=...`
- [ ] `B2_BUCKET=...`
- [ ] `CDN_BASE_URL=...`
- [ ] `JWT_SECRET=...` (generate with `node scripts/generate-secrets.js`)
- [ ] `JWT_EXPIRES_IN=7d`
- [ ] `ARGON2_SECRET=...` (generate with script)

**Auto-provided by Railway:**
- ✅ `DATABASE_URL` (from PostgreSQL service)
- ✅ `PORT` (Railway sets this automatically)
- ✅ `RAILWAY_*` variables (metadata)

---

## 🎯 Files Required for Auto-Detection

Make sure these files are in your repo:

### ✅ Required:
- `package.json` - Node.js detection
- `prisma/schema.prisma` - PostgreSQL detection
- `Procfile` - Start command
- `.gitignore` - Exclude `.env`, `node_modules`, etc.

### ✅ Configuration Files:
- `railway.json` - Railway build/deploy config
- `railway.toml` - Alternative config format
- `.env.example` - Template for local development

### ❌ Don't Commit:
- `.env` - Local secrets
- `node_modules/` - Dependencies
- `public/` - Built frontend (built during deploy)
- `*.db` - Local database files

---

## 🚨 Troubleshooting Auto-Deployment

### Issue: PostgreSQL not detected
**Solution:** 
- Check `prisma/schema.prisma` has `provider = "postgresql"`
- Manually add PostgreSQL: Dashboard → "+ New" → "Database" → "PostgreSQL"

### Issue: Build fails
**Solution:**
- Check Railway logs for specific error
- Verify all dependencies in `package.json`
- Test build locally: `npm run build`

### Issue: Database connection error
**Solution:**
- Verify PostgreSQL service is running
- Check `DATABASE_URL` exists: Railway Dashboard → Variables
- Ensure services are connected (Railway auto-connects)

### Issue: App crashes on startup
**Solution:**
- Check environment variables are set
- View runtime logs: `railway logs`
- Test locally with Railway DATABASE_URL

---

## 📈 Monitoring Your Deployment

### Railway Dashboard:
- **Deployments** - View build logs and status
- **Metrics** - CPU, Memory, Network usage
- **Logs** - Real-time application logs
- **Settings** - Configure domains, volumes, etc.

### Via Railway CLI:
```bash
# View live logs
railway logs --follow

# Check deployment status
railway status

# Open app in browser
railway open
```

---

## 💡 Pro Tips

1. **Use Preview Environments**: Railway can create preview deployments for pull requests
2. **Custom Domains**: Add your domain in Settings → Domains
3. **Environment Variables**: Use Railway's variable references: `${{Postgres.DATABASE_URL}}`
4. **Healthchecks**: Configure in `railway.toml` for better reliability
5. **Auto-Scaling**: Railway scales based on traffic automatically

---

## 🎉 Summary

Your deployment is fully automatic:

1. ✅ **Push to GitHub** → Railway detects
2. ✅ **PostgreSQL Added** → Auto-connected
3. ✅ **Environment Variables Set** → Once only
4. ✅ **Database Syncs** → Automatic via `prisma db push`
5. ✅ **App Deploys** → Zero configuration

**Future deploys:** Just `git push` - everything else is automatic! 🚀

---

## 📚 Additional Resources

- [Railway Documentation](https://docs.railway.app)
- [Prisma with Railway](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-railway)
- [Railway GitHub Integration](https://docs.railway.app/deploy/deployments#github-integration)

