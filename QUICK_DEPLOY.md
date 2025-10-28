# 🚀 Quick Deploy Guide

## 🎯 **Fastest Way: Railway (5 minutes)**

### Step 1: Install Railway CLI
```bash
npm install -g @railway/cli
```

### Step 2: Login
```bash
railway login
```

### Step 3: Initialize Project
```bash
railway init
```

### Step 4: Add PostgreSQL Database
```bash
railway add --database postgres
```

### Step 5: Set Environment Variables

Generate secrets:
```bash
node scripts/generate-secrets.js
```

Set variables in Railway:
```bash
railway variables --set NODE_ENV=production
railway variables --set STORAGE_MODE=b2
railway variables --set B2_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
railway variables --set B2_REGION=eu-central-003
railway variables --set B2_KEY_ID=your_key_id
railway variables --set B2_KEY_SECRET=your_key_secret
railway variables --set B2_BUCKET=video-platform-key
railway variables --set JWT_SECRET=<copy from generate-secrets>
railway variables --set ARGON2_SECRET=<copy from generate-secrets>
railway variables --set JWT_EXPIRES_IN=7d
railway variables --set CDN_BASE_URL=""
```

### Step 6: Deploy!
```bash
railway up
```

### Step 7: Open Your App
```bash
railway open
```

**Done! 🎉** Your app is live!

---

## 🔧 **Alternative: Render (One-Click)**

### Option 1: Using Blueprint (Easiest)

1. Push your code to GitHub
2. Go to [render.com](https://render.com)
3. Click **"New +"** → **"Blueprint"**
4. Select your GitHub repository
5. Render will use `render.yaml` to deploy everything
6. Set your secrets in Render dashboard:
   - `B2_KEY_ID`
   - `B2_KEY_SECRET`

**Done! 🎉**

### Option 2: Manual Setup

1. Go to [render.com](https://render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: video-platform
   - **Environment**: Node
   - **Build Command**: 
     ```bash
     npm install && cd frontend && npm install && npm run build && cd .. && npx prisma generate
     ```
   - **Start Command**: 
     ```bash
     npx prisma migrate deploy && npm start
     ```
5. Add PostgreSQL database (separate service)
6. Add all environment variables from the Railway guide
7. Click **Deploy**

**Done! 🎉**

---

## 💰 **Cost Comparison**

| Platform    | Free Tier     | Best For     | Deploy Time |
| ----------- | ------------- | ------------ | ----------- |
| **Railway** | $5 credit/mo  | Beginners    | 5 min ⚡     |
| **Render**  | Yes           | Testing      | 10 min      |
| **Fly.io**  | Yes           | Global apps  | 15 min      |
| **VPS**     | No ($4-10/mo) | Full control | 30-60 min   |

---

## 📋 **Pre-Deploy Checklist**

Before deploying, make sure:

- [x] PostgreSQL driver installed (`pg` package) ✅
- [x] Deployment config files created ✅
- [x] Frontend builds to `public/` during deployment ✅
- [x] `public/` excluded from git (built on deployment) ✅
- [ ] Code pushed to GitHub
- [ ] B2 bucket credentials ready
- [ ] Secrets generated (run `node scripts/generate-secrets.js`)

---

## 🔍 **After Deployment**

### Test Your Deployment:

1. **Check health**: `https://your-app.com/api/videos`
2. **Register user**: POST to `/api/auth/register`
3. **Upload video**: POST to `/api/upload`
4. **Stream video**: GET `/video?file=xxx`

### Monitor Logs:

**Railway:**
```bash
railway logs
```

**Render:**
Go to Dashboard → Logs tab

---

## ⚠️ **Common Issues**

### Issue: Build fails on `prisma generate`
**Fix:** Make sure `postinstall` script runs:
```json
"postinstall": "prisma generate"
```

### Issue: Database connection error
**Fix:** Check `DATABASE_URL` is set correctly (Railway/Render auto-set this)

### Issue: File uploads fail
**Fix:** 
1. Check B2 credentials are correct
2. Make sure `STORAGE_MODE=b2`
3. Verify bucket exists and is accessible

### Issue: CORS errors
**Fix:** Update `src/presentation/middleware/corsMiddleware.js` with your domain:
```javascript
'Access-Control-Allow-Origin': 'https://your-frontend-domain.com'
```

---

## 🎓 **Next Steps**

After successful deployment:

1. ✅ Set up custom domain
2. ✅ Configure Cloudflare CDN for B2
3. ✅ Enable monitoring/alerts
4. ✅ Set up automated backups
5. ✅ Test video streaming performance
6. ✅ Configure rate limiting
7. ✅ Add video transcoding (optional)

---

## 📚 **Resources**

- Railway Docs: https://docs.railway.app
- Render Docs: https://render.com/docs
- Prisma PostgreSQL: https://www.prisma.io/docs/concepts/database-connectors/postgresql
- B2 + Cloudflare: https://www.backblaze.com/docs/cloud-storage-deliver-public-backblaze-b2-content-through-cloudflare-cdn

---

## 💬 **Need Help?**

Check `DEPLOYMENT_GUIDE.md` for detailed instructions on each platform.

