# Robust Large File Upload Implementation Guide

## Overview

This guide explains how to implement chunked, resumable uploads for large video files with maximum reliability and safety.

## Architecture

```
┌─────────────┐     Chunks (5MB each)      ┌─────────────┐
│   Browser   │ ─────────────────────────> │   Server    │
│  (Frontend) │ <───────────────────────── │  (Backend)  │
└─────────────┘     Progress/Status         └─────────────┘
      │                                            │
      │                                            │
      ↓                                            ↓
  IndexedDB                                   Temp Storage
  (Resume State)                              (Chunks)
```

## Implementation Steps

### Phase 1: Frontend ChunkedUploader (✅ Created)

Location: `frontend/src/shared/lib/ChunkedUploader.js`

**Key Features:**
- ✅ Splits files into 5MB chunks
- ✅ MD5/SHA-256 hash verification
- ✅ Parallel chunk uploads (3 concurrent)
- ✅ Automatic retry with exponential backoff
- ✅ Pause/Resume/Cancel support
- ✅ Progress tracking
- ✅ AbortController integration

### Phase 2: Backend API Endpoints (Need to implement)

#### 2.1 Initialize Upload Endpoint

**Route:** `POST /api/upload/init`

**Purpose:** Create upload session and return uploadId

**Request Body:**
```json
{
  "fileName": "video.mp4",
  "fileSize": 1073741824,
  "mimeType": "video/mp4",
  "totalChunks": 215,
  "title": "My Video",
  "description": "Video description"
}
```

**Response:**
```json
{
  "uploadId": "uuid-v4-string",
  "resumableChunks": [0, 1, 2],  // Already uploaded chunks (for resume)
  "chunkSize": 5242880
}
```

**Implementation:**
```javascript
// Store upload metadata in database
// Create temp directory for chunks
// Check for existing partial upload (resume)
// Return upload session info
```

#### 2.2 Upload Chunk Endpoint

**Route:** `POST /api/upload/chunk`

**Purpose:** Receive and store individual chunks

**Request (multipart/form-data):**
- `chunk`: File blob
- `chunkIndex`: Number
- `chunkHash`: String (SHA-256)
- `uploadId`: String
- `totalChunks`: Number

**Response:**
```json
{
  "chunkIndex": 42,
  "received": true,
  "hashMatch": true,
  "uploadedChunks": 43,
  "totalChunks": 215,
  "progress": 20.0
}
```

**Implementation:**
```javascript
// Verify hash
// Save chunk to temp storage
// Update upload session in database
// Return progress info
```

#### 2.3 Finalize Upload Endpoint

**Route:** `POST /api/upload/finalize`

**Purpose:** Merge chunks and process video

**Request Body:**
```json
{
  "uploadId": "uuid-v4-string",
  "fileName": "video.mp4",
  "title": "My Video",
  "description": "Video description"
}
```

**Response:**
```json
{
  "video": {
    "id": "video-id",
    "title": "My Video",
    "playbackUrl": "https://...",
    "thumbnailUrl": "https://..."
  }
}
```

**Implementation:**
```javascript
// Verify all chunks received
// Merge chunks into complete file
// Generate thumbnail
// Store in cloud storage (B2)
// Clean up temp chunks
// Trigger transcoding
// Return video details
```

### Phase 3: Database Schema

Add upload session tracking:

```sql
-- Upload sessions table (for resumable uploads)
CREATE TABLE upload_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  total_chunks INTEGER NOT NULL,
  uploaded_chunks TEXT, -- JSON array of uploaded chunk indices
  metadata TEXT,        -- JSON for additional data (title, description, etc.)
  status TEXT DEFAULT 'in_progress', -- in_progress, completed, failed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,  -- Auto-cleanup old sessions
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_upload_sessions_user ON upload_sessions(user_id);
CREATE INDEX idx_upload_sessions_status ON upload_sessions(status);
CREATE INDEX idx_upload_sessions_expires ON upload_sessions(expires_at);
```

### Phase 4: Backend Implementation Files

#### 4.1 ChunkUploadController

Create: `src/presentation/controllers/ChunkUploadController.js`

```javascript
class ChunkUploadController {
  async initializeUpload(req, res) { }
  async uploadChunk(req, res) { }
  async finalizeUpload(req, res) { }
  async getUploadStatus(req, res) { }
  async cancelUpload(req, res) { }
}
```

#### 4.2 ChunkUploadService

Create: `src/application/services/ChunkUploadService.js`

```javascript
class ChunkUploadService {
  async createSession(userId, fileMetadata) { }
  async storeChunk(uploadId, chunkIndex, chunkData, hash) { }
  async mergeChunks(uploadId) { }
  async cleanupSession(uploadId) { }
  async resumeSession(uploadId) { }
}
```

## Security Considerations

### 1. Authentication
```javascript
// Verify user is authenticated
if (!req.user) {
  return res.status(401).json({ error: 'Authentication required' });
}
```

### 2. Rate Limiting
```javascript
// Limit requests per user per hour
const rateLimit = require('express-rate-limit');
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 uploads per hour
  keyGenerator: (req) => req.user.id,
});
```

### 3. File Validation
```javascript
// Validate file type
const allowedMimeTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
if (!allowedMimeTypes.includes(metadata.mimeType)) {
  throw new Error('Invalid file type');
}

// Validate file size
const maxSize = 10 * 1024 * 1024 * 1024; // 10GB
if (metadata.fileSize > maxSize) {
  throw new Error('File too large');
}
```

### 4. Hash Verification
```javascript
// Verify chunk integrity
const receivedHash = await calculateHash(chunkData);
if (receivedHash !== expectedHash) {
  throw new Error('Chunk corrupted - hash mismatch');
}
```

### 5. Session Cleanup
```javascript
// Auto-cleanup expired sessions (cron job)
async function cleanupExpiredSessions() {
  const expired = await db.uploadSessions.findMany({
    where: { expires_at: { lt: new Date() } }
  });
  
  for (const session of expired) {
    await deleteChunks(session.id);
    await db.uploadSessions.delete({ where: { id: session.id } });
  }
}

// Run every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);
```

### 6. Disk Space Management
```javascript
// Check available disk space before upload
const diskSpace = require('check-disk-space');
const space = await diskSpace('/path/to/upload/dir');

if (space.free < fileSize * 1.5) { // Need 1.5x for temp + final
  throw new Error('Insufficient disk space');
}
```

## Best Practices

### 1. Chunk Size Selection
- **5MB** - Good balance for most connections
- Smaller chunks (1-2MB) for poor connections
- Larger chunks (10-20MB) for very fast connections

### 2. Concurrency Control
- **3 parallel uploads** - Optimal for most cases
- Adjust based on server capacity
- Prevent overwhelming the server

### 3. Retry Strategy
```javascript
// Exponential backoff: 1s, 2s, 4s, 8s
const delay = baseDelay * Math.pow(2, retryCount);
// Max 3 retries before giving up
```

### 4. Progress Tracking
```javascript
// Update progress frequently (every chunk)
const progress = (uploadedChunks / totalChunks) * 100;
onProgress(progress, uploadedBytes, totalBytes);
```

### 5. Error Handling
```javascript
try {
  await uploader.upload(file, metadata);
} catch (error) {
  if (error.message === 'Upload cancelled') {
    // User cancelled - clean up
  } else if (error.message.includes('Network')) {
    // Network error - offer resume
    showResumeDialog();
  } else {
    // Other error - show message
    showError(error.message);
  }
}
```

### 6. Resume Capability
```javascript
// Store upload state in IndexedDB
const uploadState = {
  uploadId,
  fileName,
  uploadedChunks: Array.from(uploader.uploadedChunks),
  lastUpdated: Date.now()
};
await db.uploads.put(uploadState);

// On page reload, check for incomplete uploads
const incompleteUploads = await db.uploads
  .where('lastUpdated')
  .above(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
  .toArray();
```

## Performance Optimizations

### 1. Use Web Workers for Hashing
```javascript
// Offload CPU-intensive hashing to worker thread
const worker = new Worker('hash-worker.js');
worker.postMessage({ chunk });
const hash = await new Promise(resolve => {
  worker.onmessage = (e) => resolve(e.data.hash);
});
```

### 2. Compress Chunks (Optional)
```javascript
// Compress before upload (if server supports)
const compressed = await new Response(
  chunk.blob.stream().pipeThrough(new CompressionStream('gzip'))
).blob();
```

### 3. CDN Upload (Direct to B2/S3)
```javascript
// Get presigned URLs from server
const { urls } = await fetch('/api/upload/presigned-urls', {
  method: 'POST',
  body: JSON.stringify({ chunks: totalChunks })
}).then(r => r.json());

// Upload directly to storage
await fetch(urls[chunkIndex], {
  method: 'PUT',
  body: chunk.blob
});
```

### 4. Adaptive Chunk Size
```javascript
// Adjust chunk size based on connection speed
const speed = measureConnectionSpeed();
const chunkSize = speed > 10_000_000 ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
```

## Testing Checklist

- [ ] Upload small file (< 10MB) - single chunk
- [ ] Upload medium file (100MB) - multiple chunks
- [ ] Upload large file (1GB+) - many chunks
- [ ] Pause and resume upload
- [ ] Cancel upload mid-way
- [ ] Simulate network failure (reconnect and resume)
- [ ] Concurrent uploads from same user
- [ ] Invalid file types rejected
- [ ] File size limits enforced
- [ ] Hash mismatch handling
- [ ] Session expiration cleanup
- [ ] Rate limiting works
- [ ] Progress tracking accurate
- [ ] Mobile device uploads
- [ ] Slow connection (throttle network in DevTools)

## Monitoring & Observability

### Metrics to Track
- Average upload time by file size
- Chunk retry rate
- Failed upload rate
- Disk space usage
- Active upload sessions
- Network errors by type

### Logging
```javascript
console.log(`Upload ${uploadId}: ${progress}% (${uploadedChunks}/${totalChunks})`);
console.error(`Upload ${uploadId} failed:`, error);
console.info(`Upload ${uploadId} completed in ${duration}ms`);
```

## Comparison: Simple vs Chunked Upload

| Feature             | Simple Upload               | Chunked Upload      |
| ------------------- | --------------------------- | ------------------- |
| Max File Size       | ~500MB                      | 10GB+               |
| Resume on Failure   | ❌ No                        | ✅ Yes               |
| Network Reliability | Low                         | High                |
| Upload Speed        | Medium                      | Fast (parallel)     |
| Server Resources    | High (single large request) | Medium (many small) |
| Implementation      | Simple                      | Complex             |
| Error Recovery      | Poor                        | Excellent           |

## Next Steps

1. ✅ Implement frontend ChunkedUploader
2. ⏳ Create backend endpoints (init, chunk, finalize)
3. ⏳ Add database schema for upload sessions
4. ⏳ Implement chunk merging logic
5. ⏳ Add resume capability with IndexedDB
6. ⏳ Update UploadPage to use ChunkedUploader
7. ⏳ Add pause/resume UI controls
8. ⏳ Implement session cleanup cron job
9. ⏳ Add comprehensive error handling
10. ⏳ Performance testing and optimization

## Quick Start (When Backend Ready)

```javascript
import { ChunkedUploader } from '../../shared/lib/ChunkedUploader';

// Create uploader instance
const uploader = new ChunkedUploader({
  chunkSize: 5 * 1024 * 1024,  // 5MB
  maxConcurrent: 3,
  maxRetries: 3,
  onProgress: (progress, uploaded, total) => {
    console.log(`${progress.toFixed(1)}% - ${uploaded}/${total} bytes`);
  },
  onChunkComplete: (chunkIndex, totalChunks) => {
    console.log(`Chunk ${chunkIndex + 1}/${totalChunks} completed`);
  },
  onError: (error) => {
    console.error('Upload error:', error);
  }
});

// Upload file
try {
  const result = await uploader.upload(file, {
    title: 'My Video',
    description: 'Video description'
  });
  console.log('Upload complete:', result);
} catch (error) {
  console.error('Upload failed:', error);
}

// Pause/Resume/Cancel
uploader.pause();
uploader.resume();
uploader.cancel();
```

## Additional Resources

- [MDN: File API](https://developer.mozilla.org/en-US/docs/Web/API/File)
- [MDN: Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Backblaze B2 Large File Upload](https://www.backblaze.com/b2/docs/large_files.html)

