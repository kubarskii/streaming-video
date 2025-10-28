# Deployment Guide

## Quick Deploy to Railway (Recommended)

### Prerequisites
- GitHub account
- Railway account (free)
- Your code pushed to GitHub

### Step 1: Prepare for Deployment

1. **Add PostgreSQL support** (Railway provides free PostgreSQL):

```bash
npm install pg
```

2. **Update `prisma/schema.prisma`**:

```prisma
datasource db {
  provider = "postgresql"  // Changed from "sqlite"
  url      = env("DATABASE_URL")
}
```

3. **Generate new migration**:

```bash
npx prisma migrate dev --name postgresql
```

4. **Add `.railwayignore`**:

```
node_modules
.env
*.db
*.db-journal
videos/
.git
```

5. **Add `Procfile`** (optional but recommended):

```
web: npm start
```

6. **Update `package.json` with build script**:

```json
{
  "scripts": {
    "start": "node server.js",
    "build": "cd frontend && npm install && npm run build",
    "postinstall": "prisma generate",
    "migrate": "prisma migrate deploy"
  }
}
```

### Step 2: Deploy to Railway

1. **Go to [railway.app](https://railway.app)**
2. **Click "Start a New Project"**
3. **Select "Deploy from GitHub repo"**
4. **Choose your repository**
5. **Add PostgreSQL database**: Click "New" → "Database" → "PostgreSQL"
6. **Set environment variables**:

```env
NODE_ENV=production
PORT=3000
STORAGE_MODE=b2
B2_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_REGION=eu-central-003
B2_KEY_ID=your_backblaze_key_id
B2_KEY_SECRET=your_backblaze_key_secret
B2_BUCKET=your-bucket-name
CDN_BASE_URL=
JWT_SECRET=generate-a-secure-random-string-here-min-32-chars
JWT_EXPIRES_IN=7d
ARGON2_SECRET=another-secure-random-string-here-min-32-chars
```

7. **Add start command** in Railway settings:
```bash
npm run migrate && npm start
```

8. **Deploy!** Railway will automatically build and deploy

### Step 3: Build Frontend Separately

Option A: **Deploy frontend to Vercel** (Recommended):
```bash
cd frontend
vercel
```

Option B: **Serve from backend** (current setup):
- Frontend will be served from `http://your-app.railway.app`
- Update CORS in production

---

## Alternative: Deploy to Render

### Step 1: Create `render.yaml`

```yaml
services:
  - type: web
    name: video-platform
    env: node
    buildCommand: npm install && cd frontend && npm install && npm run build && cd .. && npx prisma generate
    startCommand: npx prisma migrate deploy && npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: STORAGE_MODE
        value: b2
      - key: B2_ENDPOINT
        value: https://s3.eu-central-003.backblazeb2.com
      - key: B2_REGION
        value: eu-central-003
      - key: B2_KEY_ID
        sync: false
      - key: B2_KEY_SECRET
        sync: false
      - key: B2_BUCKET
        value: video-platform-key
      - key: JWT_SECRET
        generateValue: true
      - key: ARGON2_SECRET
        generateValue: true

databases:
  - name: video-platform-db
    plan: free
```

### Step 2: Deploy

1. Push to GitHub
2. Go to [render.com](https://render.com)
3. Click "New +" → "Blueprint"
4. Connect your repository
5. Render will automatically deploy using `render.yaml`

---

## Alternative: VPS Deployment (DigitalOcean, Hetzner, etc.)

### Step 1: Server Setup

```bash
# SSH into your server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install nginx
apt install -y nginx

# Install certbot for SSL
apt install -y certbot python3-certbot-nginx

# Install PM2 for process management
npm install -g pm2
```

### Step 2: Deploy Application

```bash
# Clone your repository
cd /var/www
git clone https://github.com/yourusername/video.git
cd video

# Install dependencies
npm install
cd frontend && npm install && npm run build && cd ..

# Set up environment
cp .env.example .env
nano .env  # Add your production values

# Run migrations
npx prisma migrate deploy
npx prisma generate

# Start with PM2
pm2 start server.js --name video-platform
pm2 save
pm2 startup
```

### Step 3: Configure Nginx

```bash
nano /etc/nginx/sites-available/video-platform
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 2G;  # For 2GB video uploads

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts for large uploads
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/video-platform /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# Get SSL certificate
certbot --nginx -d your-domain.com
```

---

## Cost Comparison

| Platform         | Free Tier       | Production Cost | Best For                   |
| ---------------- | --------------- | --------------- | -------------------------- |
| **Railway**      | $5 credit/month | $5-20/month     | Quick deploy, easy setup   |
| **Render**       | Yes (limited)   | $7-25/month     | Free testing, auto-scaling |
| **Fly.io**       | 3 VMs free      | $10-30/month    | Global performance         |
| **Hetzner VPS**  | No              | €4-10/month     | Best value, full control   |
| **DigitalOcean** | No              | $5-20/month     | Managed services           |

---

## Production Checklist

Before going live:

- [ ] Migrate from SQLite to PostgreSQL
- [ ] Set strong JWT_SECRET (32+ random characters)
- [ ] Set strong ARGON2_SECRET (32+ random characters)
- [ ] Enable HTTPS/SSL
- [ ] Set NODE_ENV=production
- [ ] Configure CORS for your domain
- [ ] Set up monitoring (Railway/Render have built-in)
- [ ] Configure B2 bucket lifecycle rules
- [ ] Set up automated backups for database
- [ ] Test video upload/streaming in production
- [ ] Set up CDN for Backblaze B2 (optional but recommended)

---

## Need Help?

- Railway docs: https://docs.railway.app
- Render docs: https://render.com/docs
- Fly.io docs: https://fly.io/docs
- Prisma PostgreSQL: https://www.prisma.io/docs/concepts/database-connectors/postgresql

