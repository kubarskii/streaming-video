# Microservices Implementation Plan
## Railway + PostgreSQL + RabbitMQ + BullMQ + B2

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Railway Platform                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Upload     │  │  Processing  │  │  Streaming    │    │
│  │   Service    │  │   Service    │  │   Service     │    │
│  │              │  │   (Worker)   │  │              │    │
│  │ Port: 3001   │  │ Port: 3002   │  │ Port: 3003   │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                  │             │
│         └────────┬────────┴────────┬─────────┘             │
│                  │                 │                        │
│  ┌───────────────┴────────┐  ┌────┴──────────────┐      │
│  │    PostgreSQL DB       │  │   RabbitMQ Queue   │      │
│  │                         │  │   (amqplib)       │      │
│  └─────────────────────────┘  └────────────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  Backblaze B2   │
                  │   Storage       │
                  └─────────────────┘
```

---

## 📋 Phase 1: Database Migration (SQLite → PostgreSQL)

### Step 1.1: Update Prisma Schema

**File**: `prisma/schema.prisma`

```prisma
datasource db {
  provider = "postgresql"  // Change from "sqlite"
  url      = env("DATABASE_URL")
}
```

### Step 1.2: Create Migration Script

**File**: `scripts/migrate-to-postgres.js`

```javascript
// Migration script to move data from SQLite to PostgreSQL
// Run locally before deploying to Railway
```

### Step 1.3: Update Railway Configuration

**File**: `railway.toml` (update)

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npx prisma migrate deploy && npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

healthcheckPath = "/health"
healthcheckTimeout = 100
```

**Railway Services Needed**:
- PostgreSQL (hobby plan for dev, pro for production)
- RabbitMQ (using Railway's RabbitMQ service or CloudAMQP addon)

---

## 📋 Phase 2: Queue Infrastructure Setup

### Step 2.1: Install Dependencies

```bash
npm install amqplib bullmq ioredis
```

### Step 2.2: Queue Architecture Decision

**Option A: RabbitMQ Only** (Recommended for inter-service communication)
- Use `amqplib` for RabbitMQ
- Pros: One queue system, simpler
- Cons: Less feature-rich for job processing

**Option B: RabbitMQ + BullMQ** (Hybrid approach)
- RabbitMQ: Inter-service communication (upload → processing)
- BullMQ (Redis): Job processing queues within services
- Pros: Best of both worlds
- Cons: Two systems to manage

**Recommendation**: Start with **RabbitMQ only**, add BullMQ later if needed.

### Step 2.3: Create Queue Configuration

**File**: `src/infrastructure/config/QueueConfig.js`

```javascript
// RabbitMQ connection factory
// Queue names: 'video.processing', 'video.notifications', etc.
```

**File**: `src/infrastructure/queue/RabbitMQClient.js`

```javascript
// RabbitMQ client wrapper
// Connection management
// Publisher/Consumer helpers
```

---

## 📋 Phase 3: Service Separation

### Service 1: Upload Service

**File**: `services/upload-service/server.js`

**Responsibilities**:
- Handle chunked uploads (`POST /api/upload/chunk`)
- Handle finalize upload (`POST /api/upload/finalize`)
- Upload raw video to B2
- Create video record in DB with status="uploaded"
- Publish message to RabbitMQ queue: `video.processing`

**Dependencies**:
- PostgreSQL (video records)
- RabbitMQ (publish processing jobs)
- B2 Storage (upload raw videos)

**Railway Service**: `upload-service`
- Port: 3001
- Environment: `SERVICE_NAME=upload`

### Service 2: Processing Service

**File**: `services/processing-service/server.js`

**Responsibilities**:
- Consume messages from RabbitMQ queue: `video.processing`
- Download video from B2
- Transcode to multiple qualities
- Generate thumbnails
- Upload processed videos to B2
- Update database with quality variants
- Update video status to "ready"

**Dependencies**:
- PostgreSQL (read video metadata, update records)
- RabbitMQ (consume processing jobs)
- B2 Storage (download raw, upload processed)
- FFmpeg (transcoding)

**Railway Service**: `processing-service`
- Port: 3002
- Environment: `SERVICE_NAME=processing`

### Service 3: Streaming Service

**File**: `services/streaming-service/server.js`

**Responsibilities**:
- Stream videos from B2 (`GET /video?file=...`)
- Handle HTTP Range requests
- Update view counts
- Serve thumbnails
- Serve quality variants

**Dependencies**:
- PostgreSQL (video metadata, view counts)
- B2 Storage (stream videos)

**Railway Service**: `streaming-service`
- Port: 3003
- Environment: `SERVICE_NAME=streaming`

---

## 📋 Phase 4: Railway Deployment Configuration

### Step 4.1: Create Railway Project Structure

```
railway/
├── upload-service/
│   ├── railway.toml
│   └── package.json
├── processing-service/
│   ├── railway.toml
│   └── package.json
└── streaming-service/
    ├── railway.toml
    └── package.json
```

### Step 4.2: Railway Service Configurations

**File**: `railway/upload-service/railway.toml`

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "cd services/upload-service && npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

healthcheckPath = "/health"
healthcheckTimeout = 100
```

**File**: `railway/processing-service/railway.toml`

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "cd services/processing-service && npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

healthcheckPath = "/health"
healthcheckTimeout = 100
```

**File**: `railway/streaming-service/railway.toml`

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "cd services/streaming-service && npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

healthcheckPath = "/health"
healthcheckTimeout = 100
```

### Step 4.3: Shared Environment Variables

**Railway Variables** (set in each service):

```bash
# Database (shared)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# RabbitMQ (shared)
RABBITMQ_URL=${{RabbitMQ.RABBITMQ_URL}}
RABBITMQ_QUEUE_VIDEO_PROCESSING=video.processing

# B2 Storage (shared)
STORAGE_MODE=b2
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004
B2_KEY_ID=${{B2_KEY_ID}}
B2_KEY_SECRET=${{B2_KEY_SECRET}}
B2_BUCKET=${{B2_BUCKET}}
CDN_BASE_URL=${{CDN_BASE_URL}}

# Service-specific
SERVICE_NAME=upload  # or "processing" or "streaming"
PORT=3001  # or 3002 or 3003

# Auth (shared)
JWT_SECRET=${{JWT_SECRET}}
ARGON2_SECRET=${{ARGON2_SECRET}}

# Node
NODE_ENV=production
```

---

## 📋 Phase 5: Code Structure

### Directory Structure

```
project-root/
├── services/
│   ├── upload-service/
│   │   ├── server.js
│   │   ├── package.json
│   │   └── Dockerfile (optional)
│   ├── processing-service/
│   │   ├── server.js
│   │   ├── worker.js
│   │   ├── package.json
│   │   └── Dockerfile (optional)
│   └── streaming-service/
│       ├── server.js
│       ├── package.json
│       └── Dockerfile (optional)
├── src/                    # Shared code
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   │   ├── config/
│   │   │   ├── DatabaseConfig.js
│   │   │   ├── StorageConfig.js
│   │   │   └── QueueConfig.js
│   │   ├── queue/
│   │   │   ├── RabbitMQClient.js
│   │   │   ├── Publisher.js
│   │   │   └── Consumer.js
│   │   └── persistence/
│   └── presentation/
├── prisma/
│   └── schema.prisma
├── package.json
├── railway.toml
└── README.md
```

### Shared Code Organization

Create shared packages for:
- Domain entities
- Repository interfaces
- Storage interfaces
- Queue interfaces

Each service imports from shared `src/` directory.

---

## 📋 Phase 6: Implementation Steps

### Step 6.1: Prepare Database Migration

1. **Update Prisma schema** to PostgreSQL
2. **Create migration**: `npx prisma migrate dev --name migrate_to_postgresql`
3. **Test locally** with PostgreSQL
4. **Export SQLite data** (if needed)
5. **Import to PostgreSQL** (if needed)

### Step 6.2: Set Up RabbitMQ

1. **Add RabbitMQ service** in Railway (or use CloudAMQP)
2. **Install amqplib**: `npm install amqplib`
3. **Create queue client** wrapper
4. **Create publisher** for upload service
5. **Create consumer** for processing service
6. **Test queue** communication locally

### Step 6.3: Extract Upload Service

1. **Create** `services/upload-service/server.js`
2. **Copy** upload controllers/routes
3. **Remove** processing logic
4. **Add** RabbitMQ publisher
5. **Update** to create video with status="uploaded"
6. **Test** upload → queue → (no processing yet)

### Step 6.4: Extract Processing Service

1. **Create** `services/processing-service/server.js`
2. **Create** `services/processing-service/worker.js`
3. **Copy** transcoding logic
4. **Add** RabbitMQ consumer
5. **Update** to consume from queue
6. **Test** queue → processing → DB update

### Step 6.5: Extract Streaming Service

1. **Create** `services/streaming-service/server.js`
2. **Copy** streaming controllers/routes
3. **Remove** upload/processing logic
4. **Keep** only streaming + view count logic
5. **Test** streaming independently

### Step 6.6: Deploy to Railway

1. **Create** Railway project
2. **Add** PostgreSQL service
3. **Add** RabbitMQ service (or CloudAMQP)
4. **Deploy** upload service
5. **Deploy** processing service
6. **Deploy** streaming service
7. **Configure** service URLs/environment variables
8. **Test** end-to-end flow

---

## 🔧 Technical Details

### RabbitMQ Queue Structure

**Queue Names**:
- `video.processing` - Videos to process
- `video.processing.dlq` - Dead letter queue for failed jobs

**Message Format**:
```json
{
  "videoId": "uuid",
  "storageKey": "raw-video-key",
  "userId": "uuid",
  "title": "Video Title",
  "description": "Video Description",
  "metadata": {
    "fileName": "video.mp4",
    "mimeType": "video/mp4",
    "sizeBytes": 1000000
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Database Schema Updates

**No schema changes needed** - existing schema works with PostgreSQL.

**Consider adding**:
- Indexes for `status` field (for processing queries)
- Indexes for `uploadedAt` (for sorting)
- Indexes for `userId` (for user queries)

### Error Handling

**Upload Service**:
- Retry failed uploads
- Handle partial uploads
- Queue dead letter queue for failed jobs

**Processing Service**:
- Retry failed transcoding (with exponential backoff)
- Handle corrupted videos
- Update status to "failed" on errors

**Streaming Service**:
- Handle missing videos gracefully
- Handle B2 connection errors
- Return proper HTTP status codes

---

## 📊 Monitoring & Logging

### Health Checks

Each service should expose `/health` endpoint:

```javascript
// GET /health
{
  "status": "healthy",
  "service": "upload",
  "database": "connected",
  "queue": "connected",
  "storage": "connected"
}
```

### Logging

Use structured logging:
```javascript
logger.info('Video uploaded', { videoId, userId, storageKey });
logger.error('Processing failed', { videoId, error });
```

### Metrics

Track:
- Upload success/failure rate
- Processing queue depth
- Processing time per video
- Streaming requests per second
- Error rates per service

---

## 🚀 Deployment Checklist

### Pre-Deployment

- [ ] Update Prisma schema to PostgreSQL
- [ ] Test database migration locally
- [ ] Set up RabbitMQ locally (Docker)
- [ ] Test queue communication locally
- [ ] Extract upload service code
- [ ] Extract processing service code
- [ ] Extract streaming service code
- [ ] Test each service independently
- [ ] Test end-to-end flow locally

### Railway Setup

- [ ] Create Railway project
- [ ] Add PostgreSQL service
- [ ] Add RabbitMQ service (or CloudAMQP)
- [ ] Configure environment variables
- [ ] Deploy upload service
- [ ] Deploy processing service
- [ ] Deploy streaming service
- [ ] Test service communication
- [ ] Monitor logs
- [ ] Test health checks

### Post-Deployment

- [ ] Test video upload → processing → streaming
- [ ] Monitor queue depth
- [ ] Monitor error rates
- [ ] Set up alerts
- [ ] Document service URLs
- [ ] Update frontend API URLs

---

## 🔄 Migration Strategy

### Option 1: Big Bang (All at once)
- Deploy all services together
- Risk: High
- Time: Faster

### Option 2: Incremental (Recommended)
1. **Week 1**: Database migration + RabbitMQ setup
2. **Week 2**: Extract streaming service (lowest risk)
3. **Week 3**: Extract upload service
4. **Week 4**: Extract processing service
5. **Week 5**: Testing & optimization

---

## 📝 Next Steps

1. **Review this plan**
2. **Set up PostgreSQL locally** (Docker)
3. **Set up RabbitMQ locally** (Docker)
4. **Create queue infrastructure** code
5. **Start with streaming service** (easiest to extract)
6. **Iterate and deploy**

---

## 🆘 Troubleshooting

### Common Issues

**Database Connection**:
- Check `DATABASE_URL` format
- Ensure PostgreSQL service is running
- Check connection pooling settings

**RabbitMQ Connection**:
- Check `RABBITMQ_URL` format
- Ensure RabbitMQ service is running
- Check queue permissions

**B2 Storage**:
- Verify credentials
- Check bucket permissions
- Verify CDN configuration

**Service Communication**:
- Check service URLs
- Verify CORS settings
- Check network connectivity

---

## 📚 Resources

- [Railway PostgreSQL Docs](https://docs.railway.app/databases/postgresql)
- [RabbitMQ Node.js Guide](https://www.rabbitmq.com/tutorials/tutorial-one-javascript.html)
- [BullMQ Docs](https://docs.bullmq.io/)
- [Prisma PostgreSQL Guide](https://www.prisma.io/docs/concepts/database-connectors/postgresql)

