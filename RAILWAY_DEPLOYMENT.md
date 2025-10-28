# 🚂 Railway Deployment Guide

## Quick Deployment (5 Minutes)

### Step 1: Create PostgreSQL Database in Railway

1. Go to your Railway dashboard: https://railway.app/dashboard
2. Create new project or select existing one
3. Click **"+ New"** → **"Database"** → **"PostgreSQL"**
4. Railway automatically creates the database

### Step 2: Set Up Your Application Service

1. Click **"+ New"** → **"GitHub Repo"**
2. Select your repository
3. Railway will auto-detect the configuration

### Step 3: Configure Environment Variables

Go to your **Application Service** → **Variables** tab and add these:

```env
NODE_ENV=production
PORT=3000
STORAGE_MODE=b2

# Backblaze B2 Configuration
B2_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_REGION=eu-central-003
B2_KEY_ID=003e7247e8a0a2d0000000001
B2_KEY_SECRET=K003Q90g0K6UfM54D0AzUDh2L2DKO2Q
B2_BUCKET=videos-pub-keks
CDN_BASE_URL=https://f003.backblazeb2.com/file/videos-pub-keks

# Authentication (Generate secure secrets!)
JWT_SECRET=<RUN: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
JWT_EXPIRES_IN=7d
ARGON2_SECRET=<RUN: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

⚠️ **IMPORTANT: Don't manually set `DATABASE_URL`!**
- Railway automatically connects services using **private networking**
- This avoids egress fees
- The `DATABASE_URL` variable is auto-injected

### Step 4: Connect Database to Application

1. Click on your **Application Service**
2. Go to **Settings** tab
3. Scroll to **"Service Variables"**
4. Click **"+ New Variable"** → **"Reference"**
5. Select: `DATABASE_URL` → `postgres` → `DATABASE_URL` (private)

This creates a **private network connection** with zero egress fees!

### Step 5: Verify Build Configuration

Your `Procfile` should contain:
```
web: npm run build && npm run migrate && npm start
```

Your `package.json` already has the correct scripts:
```json
{
  "scripts": {
    "start": "node server.js",
    "build": "cd frontend && npm install && npm run build && cd ..",
    "postinstall": "prisma generate",
    "migrate": "prisma migrate deploy"
  }
}
```

### Step 6: Deploy!

Railway will automatically:
1. ✅ Install dependencies
2. ✅ Build frontend
3. ✅ Generate Prisma client
4. ✅ Run database migrations
5. ✅ Start the server

## 🔒 Local Development Setup

### Get Your Database Connection for Local Dev

For local development, you **need** the public endpoint:

1. Go to Railway → **PostgreSQL Service** → **Variables**
2. Copy the **`DATABASE_PUBLIC_URL`** value
3. Update your local `.env`:

```env
DATABASE_URL="postgresql://postgres:PASSWORD@containers-us-west-xxx.railway.app:5432/railway"
```

⚠️ **Note**: Using the public endpoint locally is fine - egress fees only matter in production.

## 📊 Railway Database Variables Explained

Railway provides multiple database connection variables:

| Variable               | Use Case                | Network | Egress Fees             |
| ---------------------- | ----------------------- | ------- | ----------------------- |
| `DATABASE_URL`         | ✅ Production (auto-set) | Private | ❌ No fees               |
| `DATABASE_PRIVATE_URL` | Production (manual)     | Private | ❌ No fees               |
| `DATABASE_PUBLIC_URL`  | 🏠 Local development     | Public  | ⚠️ Yes (if used in prod) |

## 🔐 Generate Secure Secrets

Run this command locally to generate secure secrets:

```bash
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('ARGON2_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

Or use the included script:
```bash
node scripts/generate-secrets.js
```

## 🚀 Deployment Checklist

Before deploying:

- [ ] PostgreSQL database created in Railway
- [ ] All environment variables set in Railway dashboard
- [ ] `DATABASE_URL` is using **private** connection (auto-set by Railway)
- [ ] JWT_SECRET and ARGON2_SECRET are generated (32+ chars)
- [ ] B2 credentials are correct
- [ ] Code pushed to GitHub
- [ ] Railway connected to GitHub repo

## 🎯 After Deployment

1. **Check Logs**: Railway Dashboard → Your Service → Deployments → View Logs
2. **Get URL**: Railway provides a public URL (e.g., `your-app.up.railway.app`)
3. **Test API**: 
   ```bash
   curl https://your-app.up.railway.app/api/videos
   ```
4. **Test Frontend**: Open `https://your-app.up.railway.app` in browser

## 🐛 Troubleshooting

### Build Fails
- Check logs in Railway dashboard
- Verify `Procfile` is present
- Ensure all dependencies are in `package.json`

### Database Connection Error
- Verify `DATABASE_URL` is set (should be automatic)
- Check if database migration ran successfully
- Look for "Prisma" errors in logs

### Frontend Not Loading
- Check if `npm run build` completed successfully
- Verify `public/` directory was created during build
- Check if `public/index.html` exists after build

### Videos Not Uploading
- Verify B2 credentials are correct
- Check B2 bucket permissions
- Look for S3/B2 errors in logs

## 💰 Cost Optimization

**Free Tier:**
- Railway: $5 credit/month (enough for small projects)
- PostgreSQL: Included in Railway credits
- Backblaze B2: First 10GB storage free

**Avoiding Extra Costs:**
1. ✅ Use **private** `DATABASE_URL` (automatically set)
2. ✅ Serve videos from B2/CDN (not through Railway)
3. ✅ Use Cloudflare CDN with B2 (free bandwidth)
4. ❌ Don't proxy video streams through Railway server

## 🔗 Useful Links

- Railway Dashboard: https://railway.app/dashboard
- Railway Docs: https://docs.railway.app
- Railway CLI: https://docs.railway.app/develop/cli
- Backblaze B2 Dashboard: https://secure.backblaze.com

## 📝 Notes

- Railway automatically rebuilds on git push
- Database backups are handled by Railway (PostgreSQL service)
- You can scale up/down in Railway dashboard
- Custom domains can be added in Railway settings

---

**Need Help?**
- Railway Discord: https://discord.gg/railway
- Railway Docs: https://docs.railway.app

