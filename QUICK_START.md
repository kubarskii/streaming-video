# 🚀 Quick Start Guide

## What Was Built

A complete **Domain-Driven Design (DDD)** video streaming service with:
- ✅ **SQLite database** with Prisma ORM for metadata
- ✅ **Backblaze B2 + Cloudflare** support (cheapest enterprise storage)
- ✅ **Local storage** mode for development
- ✅ **Clean architecture** with proper separation of concerns
- ✅ **RESTful API** for video management
- ✅ **Beautiful web interface** with video library

## 📁 Project Structure

```
video/
├── src/                          # DDD Architecture
│   ├── domain/                   # Business Logic Layer
│   │   ├── entities/            # Video entity
│   │   ├── value-objects/       # VideoStatus
│   │   └── repositories/        # Repository interfaces
│   ├── application/             # Use Cases Layer
│   │   ├── use-cases/          # Business operations
│   │   └── services/           # VideoService
│   ├── infrastructure/          # Technical Layer
│   │   ├── config/             # Database & Storage config
│   │   ├── persistence/        # Prisma implementation
│   │   └── storage/            # B2 & Local storage
│   └── presentation/            # HTTP Layer
│       ├── controllers/        # Request handlers
│       └── routes/             # Router
├── prisma/                      # Database
│   └── schema.prisma           # Database schema
├── scripts/                     # Utilities
│   └── import-videos.js        # Import existing videos
├── public/                      # Frontend
│   └── index.html              # Video player UI
├── videos/                      # Local video storage
├── server.js                    # Application entry point
└── .env                         # Configuration
```

## 🎯 Currently Running

Your server is now running at: **http://127.0.0.1:3000**

### What You Can Do:

1. **View Video Library**: Open http://127.0.0.1:3000 in your browser
2. **API Endpoints**:
   - `GET /api/videos` - List all videos
   - `GET /api/videos/:id` - Get video details
   - `DELETE /api/videos/:id` - Delete video
   - `GET /video?file=:name` - Stream video

## 🔧 Current Configuration

- **Storage Mode**: Local (`./videos/` folder)
- **Database**: SQLite (`dev.db`)
- **Videos Imported**: 1 (test.mp4)

## 📦 Switching to Backblaze B2 + Cloudflare

### Step 1: Get B2 Credentials

1. Sign up at https://www.backblaze.com/b2/sign-up.html
2. Create a bucket (e.g., `my-video-bucket`)
3. Get App Key: https://secure.backblaze.com/app_keys.htm

### Step 2: Update `.env`

```bash
STORAGE_MODE=b2
B2_KEY_ID=your_actual_key_id
B2_KEY_SECRET=your_actual_key_secret
B2_BUCKET=my-video-bucket
```

### Step 3: Optional - Add Cloudflare CDN (Free Egress!)

1. Add your domain to Cloudflare
2. In Cloudflare DNS, add CNAME:
   ```
   Name: cdn
   Target: f004.backblazeb2.com (check your B2 region)
   ```
3. Update `.env`:
   ```bash
   CDN_BASE_URL=https://cdn.yourdomain.com/file/my-video-bucket
   ```

### Step 4: Restart Server

```bash
npm start
```

## 💰 Cost Comparison

| Solution            | Storage (1TB) | Bandwidth (10TB) | Total/Month |
| ------------------- | ------------- | ---------------- | ----------- |
| **B2 + Cloudflare** | $6            | **$0**           | **$6**      |
| AWS S3 + CloudFront | $23           | $850             | $873        |
| Azure + CDN         | $18           | $810             | $828        |

## 🛠️ Useful Commands

```bash
# Start server
npm start

# Database management
npm run db:studio          # Open Prisma Studio (DB GUI)
npm run db:migrate         # Run migrations
npm run db:generate        # Regenerate Prisma client

# Import videos from videos/ folder
node scripts/import-videos.js

# Install dependencies
npm install
```

## 🔍 Testing the API

### List Videos
```bash
curl http://localhost:3000/api/videos
```

### Get Video by ID
```bash
curl http://localhost:3000/api/videos/<video-id>
```

### Stream Video
```bash
curl http://localhost:3000/video?file=test.mp4
```

## 📚 Architecture Highlights

### Domain-Driven Design Layers

1. **Domain Layer** (Pure Business Logic)
   - `Video` entity with business rules
   - `VideoStatus` value object
   - Repository interfaces (no implementation details)

2. **Application Layer** (Use Cases)
   - `UploadVideoUseCase` - Upload video workflow
   - `GetVideoUseCase` - Retrieve video
   - `ListVideosUseCase` - List with pagination
   - `DeleteVideoUseCase` - Delete video & storage

3. **Infrastructure Layer** (Technical Implementation)
   - Prisma ORM for database
   - B2/Local storage implementations
   - Configuration factories

4. **Presentation Layer** (HTTP/API)
   - Controllers for request handling
   - Router for endpoint mapping
   - Response formatting

### Key Benefits

- ✅ **Testable**: Each layer can be tested independently
- ✅ **Maintainable**: Clear separation of concerns
- ✅ **Extensible**: Easy to add new storage providers
- ✅ **Scalable**: Can switch storage without changing business logic
- ✅ **Clean**: No framework coupling in domain layer

## 🎥 Adding More Videos

1. Copy video files to `videos/` folder
2. Run: `node scripts/import-videos.js`
3. Refresh the web interface

## 🚨 Troubleshooting

### Database Issues
```bash
# Reset database
rm dev.db
npm run db:migrate
node scripts/import-videos.js
```

### Port Already in Use
Edit `.env`:
```bash
PORT=8080  # Use different port
```

### Videos Not Showing
1. Check videos are in `videos/` folder
2. Run import script: `node scripts/import-videos.js`
3. Check database: `npm run db:studio`

## 📖 Learn More

- [Full Documentation](README.md)
- [Backblaze B2 Docs](https://www.backblaze.com/b2/docs/)
- [Prisma Docs](https://www.prisma.io/docs)
- [DDD Concepts](https://martinfowler.com/bliki/DomainDrivenDesign.html)

---

**Enjoy your enterprise-grade video streaming service! 🎉**

