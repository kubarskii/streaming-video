# Deployment Guide

This guide covers deploying the Video Streaming Platform using Docker containers on Railway and other platforms.

## Table of Contents

- [Quick Start with Docker](#quick-start-with-docker)
- [Railway Deployment](#railway-deployment)
- [Environment Variables](#environment-variables)
- [Docker Commands](#docker-commands)
- [Troubleshooting](#troubleshooting)

---

## Quick Start with Docker

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+

### Local Development

The docker-compose.yml uses environment variables from your system (Railway style), not .env files.

1. **Export environment variables:**

```bash
export DATABASE_URL="postgresql://user:password@host:5432/database"
export REDIS_URL="redis://host:6379"
export JWT_SECRET="your_secret"
export ARGON2_SECRET="your_secret"
export STORAGE_MODE="local"
# ... other variables
```

Or use Railway CLI to automatically load Railway's environment:

```bash
railway run docker-compose up
```

2. **Start the application:**

```bash
docker-compose up -d
```

This will start:
- Video platform application on port 3000 (connects to your Railway PostgreSQL and Redis)

2. **Check service status:**

```bash
docker-compose ps
```

3. **View logs:**

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
```

4. **Stop services:**

```bash
docker-compose down
```

5. **Stop services and remove volumes:**

```bash
docker-compose down -v
```

---

## Railway Deployment

### Configuration

The project is configured to use Docker for Railway deployment:

- **Build:** Uses multi-stage Dockerfile for optimized image size
- **Deploy:** Automatic database migrations on startup
- **Health Check:** Monitors `/api/videos` endpoint
- **Environment:** Variables are injected directly into the container (no .env files needed)

### Required Environment Variables

Set these in Railway's **Service Variables** (not .env files):

**How to set variables on Railway:**
1. Go to your service in Railway dashboard
2. Click on the "Variables" tab
3. Add each variable using the UI
4. Railway automatically injects them into your Docker container

#### Essential Variables

```env
# Database (automatically set by Railway PostgreSQL plugin)
DATABASE_URL=postgresql://user:password@host:port/database

# Redis (set if using external Redis, or Railway Redis plugin)
REDIS_URL=redis://host:port

# Authentication
JWT_SECRET=your_secure_random_string_here
ARGON2_SECRET=your_secure_random_string_here

# Storage Mode
STORAGE_MODE=b2  # or 'local' for testing
```

#### Backblaze B2 Storage (Required for production)

```env
B2_KEY_ID=your_b2_application_key_id
B2_KEY_SECRET=your_b2_application_key
B2_BUCKET=your_bucket_name
B2_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_REGION=eu-central-003
CDN_BASE_URL=https://your-cdn-url.com
```

#### Optional Variables

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Local Storage (only if STORAGE_MODE=local)
LOCAL_STORAGE_PATH=./videos
```

### Deployment Steps

1. **Connect Repository:**
   - Link your GitHub repository to Railway
   - Railway will auto-detect the Dockerfile

2. **Add PostgreSQL Plugin:**
   - Click "+ New" in your Railway project
   - Select "Database" → "PostgreSQL"
   - This automatically sets `DATABASE_URL`

3. **Add Redis Plugin (Optional but Recommended):**
   - Click "+ New" in your Railway project
   - Select "Database" → "Redis"
   - This automatically sets `REDIS_URL`

4. **Set Environment Variables:**
   - Go to your service settings
   - Navigate to "Variables" tab
   - Add all required variables listed above

5. **Deploy:**
   - Push to your connected branch
   - Railway will automatically build and deploy using Docker

6. **Verify Deployment:**
   - Check deployment logs for any errors
   - Visit your Railway URL
   - Test video upload and playback

---

## Environment Variables

### Complete Reference

| Variable             | Required | Default                  | Description                      |
| -------------------- | -------- | ------------------------ | -------------------------------- |
| `DATABASE_URL`       | Yes      | -                        | PostgreSQL connection string     |
| `REDIS_URL`          | Yes      | `redis://localhost:6379` | Redis connection string          |
| `JWT_SECRET`         | Yes      | -                        | Secret for JWT token signing     |
| `ARGON2_SECRET`      | Yes      | -                        | Secret for password hashing      |
| `STORAGE_MODE`       | Yes      | `local`                  | Storage backend: `local` or `b2` |
| `PORT`               | No       | `3000`                   | Server port                      |
| `NODE_ENV`           | No       | `development`            | Node environment                 |
| `LOCAL_STORAGE_PATH` | No       | `./videos`               | Local storage path               |
| `B2_KEY_ID`          | If B2    | -                        | Backblaze B2 key ID              |
| `B2_KEY_SECRET`      | If B2    | -                        | Backblaze B2 key secret          |
| `B2_BUCKET`          | If B2    | -                        | Backblaze B2 bucket name         |
| `B2_ENDPOINT`        | If B2    | -                        | Backblaze B2 endpoint URL        |
| `B2_REGION`          | If B2    | -                        | Backblaze B2 region              |
| `CDN_BASE_URL`       | If B2    | -                        | CDN base URL for video delivery  |

### Generating Secrets

```bash
# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate ARGON2_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Docker Commands

### Building

```bash
# Build production image
docker build -t video-platform .

# Build with custom tag
docker build -t video-platform:v1.0.0 .

# Build without cache
docker build --no-cache -t video-platform .
```

### Running

```bash
# Run with environment file
docker run --env-file .env -p 3000:3000 video-platform

# Run with specific environment variables
docker run -e DATABASE_URL="postgresql://..." \
           -e REDIS_URL="redis://..." \
           -e JWT_SECRET="..." \
           -p 3000:3000 video-platform

# Run in detached mode
docker run -d --name video-app -p 3000:3000 video-platform
```

### Debugging

```bash
# View logs
docker logs video-app
docker logs -f video-app  # Follow logs

# Execute commands in running container
docker exec -it video-app sh

# Inspect container
docker inspect video-app

# View resource usage
docker stats video-app
```

### Maintenance

```bash
# Stop container
docker stop video-app

# Start container
docker start video-app

# Restart container
docker restart video-app

# Remove container
docker rm video-app

# Remove image
docker rmi video-platform
```

---

## Docker Image Optimization

### Current Optimizations

1. **Multi-stage Build:**
   - Separate frontend build stage
   - Separate dependency installation stage
   - Final image only contains production artifacts

2. **Alpine Linux Base:**
   - Minimal base image (~5MB)
   - Reduces attack surface
   - Faster pull times

3. **Layer Caching:**
   - Dependencies installed before source copy
   - Maximizes cache utilization

4. **Security:**
   - Non-root user execution
   - Minimal system packages
   - No development dependencies

5. **Health Checks:**
   - Built-in container health monitoring
   - Automatic restart on failure

### Image Size

Expected final image size: **~500-600MB**

Breakdown:
- Base Alpine image: ~5MB
- Node.js runtime: ~50MB
- Dependencies: ~200-300MB
- FFmpeg: ~100MB
- Application code: ~50MB
- Frontend build: ~10MB

---

## Troubleshooting

### Build Issues

**Problem:** `npm ci` fails with permission errors

**Solution:** Ensure you're using Node 20+ Alpine image

**Problem:** FFmpeg not found

**Solution:** Check that `ffmpeg` is installed in the Dockerfile:
```dockerfile
RUN apk add --no-cache ffmpeg
```

### Runtime Issues

**Problem:** Database connection fails

**Solution:** 
- Verify `DATABASE_URL` is set correctly
- Ensure PostgreSQL is accessible from container
- Check network connectivity

**Problem:** Redis connection fails

**Solution:**
- Verify `REDIS_URL` format: `redis://host:port`
- Ensure Redis is running and accessible

**Problem:** Video processing fails

**Solution:**
- Check FFmpeg is installed: `docker exec -it video-app ffmpeg -version`
- Verify storage permissions
- Check worker logs

### Performance Issues

**Problem:** Slow video uploads

**Solution:**
- Increase container memory allocation
- Use CDN for video delivery
- Optimize network connectivity

**Problem:** High memory usage

**Solution:**
- Monitor container stats: `docker stats video-app`
- Adjust Node.js memory limits if needed
- Check for memory leaks in logs

### Railway-Specific Issues

**Problem:** Deployment timeout

**Solution:**
- Check build logs for errors
- Increase build timeout in Railway settings
- Optimize Dockerfile layer caching

**Problem:** Health check failing

**Solution:**
- Verify `/api/videos` endpoint works
- Check application logs
- Increase health check timeout

**Problem:** Environment variables not loaded

**Solution:**
- Verify all required variables are set in Railway
- Check for typos in variable names
- Restart deployment after setting variables

---

## Additional Deployment Platforms

### AWS ECS

```bash
# Build for ARM64 (if using Graviton)
docker buildx build --platform linux/arm64 -t video-platform .

# Tag for ECR
docker tag video-platform:latest [account-id].dkr.ecr.[region].amazonaws.com/video-platform:latest

# Push to ECR
docker push [account-id].dkr.ecr.[region].amazonaws.com/video-platform:latest
```

### Google Cloud Run

```bash
# Build and push to GCR
gcloud builds submit --tag gcr.io/[project-id]/video-platform

# Deploy to Cloud Run
gcloud run deploy video-platform \
  --image gcr.io/[project-id]/video-platform \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Azure Container Instances

```bash
# Build and push to ACR
az acr build --registry [registry-name] --image video-platform .

# Deploy to ACI
az container create \
  --resource-group [resource-group] \
  --name video-platform \
  --image [registry-name].azurecr.io/video-platform \
  --cpu 2 --memory 4 \
  --ports 3000
```

---

## Monitoring and Logging

### Built-in Health Checks

The Docker container includes a health check that:
- Runs every 30 seconds
- Tests the `/api/videos` endpoint
- Fails after 3 consecutive failures
- Has a 40-second startup grace period

### Recommended Monitoring

1. **Application Performance:**
   - Railway built-in metrics
   - New Relic / DataDog / Application Insights

2. **Container Health:**
   - Docker health status
   - Resource usage monitoring

3. **Database Performance:**
   - PostgreSQL slow query log
   - Connection pool monitoring

4. **Queue Management:**
   - Redis memory usage
   - BullMQ dashboard

---

## Best Practices

1. **Always use environment variables** for configuration
2. **Enable health checks** in production
3. **Set appropriate resource limits** (CPU/Memory)
4. **Use CDN** for video delivery
5. **Monitor application logs** regularly
6. **Implement backup strategy** for PostgreSQL
7. **Use Redis persistence** for queue reliability
8. **Set up alerts** for critical errors
9. **Regular security updates** for base images
10. **Test Docker builds** locally before deploying

---

## Support

For issues or questions:
- Check the troubleshooting section
- Review Railway deployment logs
- Verify environment variables are set correctly
- Test locally with Docker Compose first

---

## License

See main project LICENSE file.

