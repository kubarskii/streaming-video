# Video Streaming Service with DDD Architecture

Enterprise-grade video streaming service built with Domain-Driven Design (DDD), supporting both local storage and Backblaze B2 + Cloudflare CDN.

## 🏗️ Architecture

This project follows **Domain-Driven Design (DDD)** principles with clear separation of concerns:

```
src/
├── domain/               # Domain Layer (Business Logic)
│   ├── entities/         # Domain entities (Video)
│   ├── value-objects/    # Value objects (VideoStatus)
│   └── repositories/     # Repository interfaces
├── application/          # Application Layer (Use Cases)
│   ├── use-cases/        # Business use cases
│   └── services/         # Application services
├── infrastructure/       # Infrastructure Layer (Technical Details)
│   ├── config/           # Configuration
│   ├── persistence/      # Database implementation (Prisma)
│   └── storage/          # Storage implementation (B2, Local)
└── presentation/         # Presentation Layer (HTTP)
    ├── controllers/      # HTTP controllers
    └── routes/           # Routing
```

## 🚀 Features

- ✅ **DDD Architecture** - Clean, maintainable, testable code
- ✅ **Backblaze B2 + Cloudflare** - Ultra-cheap cloud storage with free egress
- ✅ **Local Storage** - Development mode with filesystem storage
- ✅ **SQLite + Prisma ORM** - Type-safe database access
- ✅ **Video Streaming** - HTTP Range request support for seeking
- ✅ **RESTful API** - CRUD operations for videos
- ✅ **Graceful Shutdown** - Proper cleanup on server stop

## 📦 Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
# For local development (default)
STORAGE_MODE=local

# For production with B2
STORAGE_MODE=b2
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004
B2_KEY_ID=your_key_id
B2_KEY_SECRET=your_key_secret
B2_BUCKET=your-bucket-name
CDN_BASE_URL=https://your-cdn-url.com  # Optional: Cloudflare CDN URL
```

### 3. Setup Database

```bash
npm run db:generate    # Generate Prisma client
npm run db:migrate     # Run database migrations
```

Or use the combined setup command:

```bash
npm run setup
```

### 4. Import Existing Videos (Optional)

If you have existing videos in the `videos/` folder:

```bash
node scripts/import-videos.js
```

## 🐳 Docker Deployment

### Quick Start with Docker Compose

Run locally with environment variables (same as Railway):

```bash
# Option 1: Export variables first
export DATABASE_URL="postgresql://..."
export REDIS_URL="redis://..."
export JWT_SECRET="your_secret"
# ... export other variables
npm run docker:up

# Option 2: Use .env file (will be loaded by shell)
# Create .env file and source it:
source .env
npm run docker:up

# Option 3: Use Railway CLI (connects to Railway environment)
railway run npm run docker:up

# View logs
npm run docker:logs

# Stop application
npm run docker:down
```

### Build Custom Docker Image

```bash
# Build image
npm run docker:build

# Run with environment file
npm run docker:run
```

### Railway Deployment

The project is optimized for Railway deployment with Docker:

1. **Connect your repository** to Railway
2. **Add PostgreSQL plugin** (sets `DATABASE_URL` automatically)
3. **Add Redis plugin** (sets `REDIS_URL` automatically)
4. **Set environment variables:**
   - `JWT_SECRET` - Random secure string
   - `ARGON2_SECRET` - Random secure string
   - `STORAGE_MODE=b2`
   - B2 credentials (see Backblaze B2 Setup)
5. **Deploy** - Railway will use the Dockerfile automatically

📖 **Full deployment guide:** See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

### Docker Benefits

- ✅ **Consistent environments** - Same setup everywhere
- ✅ **Easy scaling** - Deploy to any cloud provider
- ✅ **Optimized builds** - Multi-stage builds reduce image size
- ✅ **Production-ready** - Security hardening and health checks
- ✅ **Fast deployments** - Layer caching for quick rebuilds

## 🎯 Usage

### Start Server

```bash
npm start
```

The server will start at `http://127.0.0.1:3000`

### API Endpoints

#### List Videos
```bash
GET /api/videos?limit=50&offset=0&status=ready
```

Response:
```json
{
  "videos": [
    {
      "id": "uuid",
      "title": "Video Title",
      "fileName": "test.mp4",
      "playbackUrl": "http://...",
      "status": "ready"
    }
  ],
  "total": 100,
  "limit": 50,
  "offset": 0,
  "hasMore": true
}
```

#### Get Video by ID
```bash
GET /api/videos/:id
```

#### Delete Video
```bash
DELETE /api/videos/:id
```

#### Stream Video
```bash
GET /video?file=test.mp4
```

## 💰 Backblaze B2 Setup

### 1. Create B2 Account
Sign up at [Backblaze](https://www.backblaze.com/b2/sign-up.html)

### 2. Create Bucket
- Go to "Buckets" → "Create a Bucket"
- Name: `your-video-bucket`
- Files in Bucket: Public or Private (recommend Private with signed URLs)

### 3. Create Application Key
- Go to "App Keys" → "Add a New Application Key"
- Copy `keyID` and `applicationKey`

### 4. Configure in `.env`
```bash
STORAGE_MODE=b2
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_KEY_ID=your_key_id_here
B2_KEY_SECRET=your_application_key_here
B2_BUCKET=your-video-bucket
```

### 5. Optional: Add Cloudflare CDN (Free Egress!)

1. Add domain to Cloudflare
2. In B2 Bucket Settings → "Bucket Info" → Copy "Endpoint"
3. In Cloudflare DNS, add CNAME:
   ```
   Name: cdn (or videos)
   Target: f004.backblazeb2.com
   ```
4. Update `.env`:
   ```bash
   CDN_BASE_URL=https://cdn.yourdomain.com/file/your-video-bucket
   ```

## 🧪 Testing

### Test Video Upload
```bash
# Using the import script
node scripts/import-videos.js
```

### Test API
```bash
# List videos
curl http://localhost:3000/api/videos

# Get specific video
curl http://localhost:3000/api/videos/<video-id>

# Stream video
curl http://localhost:3000/video?file=test.mp4
```

## 📊 Cost Comparison

| Provider            | 1TB Storage | 10TB Bandwidth | Total/Month |
| ------------------- | ----------- | -------------- | ----------- |
| **B2 + Cloudflare** | $6          | $0             | **$6**      |
| AWS S3 + CloudFront | $23         | $850           | **$873**    |
| Self-hosted         | ~$10        | incl           | **$10**     |

## 🏛️ DDD Principles Applied

### Domain Layer
- **Entities**: `Video` - Core business object with identity and lifecycle
- **Value Objects**: `VideoStatus` - Immutable status values
- **Repository Interfaces**: Contracts for data access, implementation-agnostic

### Application Layer
- **Use Cases**: Single-responsibility business operations
  - `UploadVideoUseCase`
  - `GetVideoUseCase`
  - `ListVideosUseCase`
  - `DeleteVideoUseCase`
- **Services**: Coordinate multiple use cases

### Infrastructure Layer
- **Storage Repositories**: Pluggable implementations (B2, Local, can add S3, etc.)
- **Persistence**: Prisma ORM for database access
- **Configuration**: Factory patterns for dependency creation

### Presentation Layer
- **Controllers**: HTTP request/response handling
- **Router**: Route requests to appropriate controllers
- **DTOs**: Transform domain objects for API responses

## 🔧 Development

### Database Management

```bash
# View database in browser
npm run db:studio

# Create new migration
npm run db:migrate

# Regenerate Prisma client
npm run db:generate
```

### Adding New Storage Provider

1. Create new class implementing `IStorageRepository`
2. Add to `StorageConfig.js` factory
3. Update `.env` with new mode

Example:
```javascript
// src/infrastructure/storage/S3StorageRepository.js
class S3StorageRepository extends IStorageRepository {
    // Implement interface methods
}
```

## 📝 License

ISC

## 🤝 Contributing

This is an educational project demonstrating DDD principles. Feel free to fork and modify!

## 🔗 Resources

- [Backblaze B2 Pricing](https://www.backblaze.com/b2/cloud-storage-pricing.html)
- [Cloudflare Bandwidth Alliance](https://www.cloudflare.com/bandwidth-alliance/)
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)
- [Prisma Documentation](https://www.prisma.io/docs)

