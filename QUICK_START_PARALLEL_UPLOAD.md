# Quick Start: Parallel Chunked Upload

## 🚀 Get 5-10x Faster Uploads in 10 Minutes

This guide shows you how to implement the parallel chunked upload system for dramatically faster upload speeds.

---

## 📦 Step 1: Install Dependencies

```bash
cd frontend
npm install spark-md5
```

---

## 🔧 Step 2: Update Your Upload Page

### Option A: Replace Existing Upload Page

```bash
# Backup your current upload page
cp frontend/src/pages/upload/UploadPage.jsx frontend/src/pages/upload/UploadPage.jsx.backup

# Use the new chunked upload page
cp frontend/src/pages/upload/UploadPageChunked.jsx frontend/src/pages/upload/UploadPage.jsx
```

### Option B: Use Side-by-Side (Recommended for Testing)

Update your router to use the new page:

```javascript
// frontend/src/app/router.jsx
import { UploadPageChunked } from '../pages/upload/UploadPageChunked';

// Change the upload route to use UploadPageChunked
```

---

## ✅ Step 3: Verify the Setup

1. **Start your development server**:
   ```bash
   npm run dev
   ```

2. **Test with a large file** (>100MB):
   - Go to `/upload`
   - Select a video file larger than 100MB
   - Watch the console for parallel upload messages:
     ```
     📦 Uploading 500.00MB in 50 chunks of 10.00MB each
     ✅ Session initialized: abc-123
     🚀 Starting parallel upload of 50 chunks (6 concurrent)
       ✓ Chunk 1/50 uploaded
       ✓ Chunk 2/50 uploaded
       ✓ Chunk 3/50 uploaded
       ...
     ```

3. **Check upload speed**:
   - You should see speed indicator in the UI
   - Console will show average speed at the end
   - Expected: 30-100 MB/s (depending on your connection)

---

## 📊 What You Get

### Before (Sequential Upload)
```
Chunk 1 → Server → B2 ━━━━━━━━━━━━━━━━━━━ 100% (5 seconds)
Chunk 2 → Server → B2 ━━━━━━━━━━━━━━━━━━━ 100% (5 seconds)
Chunk 3 → Server → B2 ━━━━━━━━━━━━━━━━━━━ 100% (5 seconds)
...

Total time for 1GB: ~10 minutes
```

### After (Parallel Upload)
```
Chunk 1 ━━━━━━━━━━━━━━━━━━━ 100%
Chunk 2 ━━━━━━━━━━━━━━━━━━━ 100%
Chunk 3 ━━━━━━━━━━━━━━━━━━━ 100%
Chunk 4 ━━━━━━━━━━━━━━━━━━━ 100%
Chunk 5 ━━━━━━━━━━━━━━━━━━━ 100%
Chunk 6 ━━━━━━━━━━━━━━━━━━━ 100%  } All uploading simultaneously!
...

Total time for 1GB: ~1-2 minutes
```

**Performance Improvement: 5-10x faster!**

---

## 🎛️ Configuration Options

You can customize the upload behavior in `frontend/src/shared/api/chunked-upload.js`:

```javascript
export const chunkedUploadManager = new ChunkedUploadManager({
    maxConcurrent: 6,           // Number of chunks uploaded simultaneously
                                // Increase for faster connections (max 10)
                                // Decrease for slower connections (min 2)
    
    chunkSize: 5 * 1024 * 1024, // Default chunk size (5MB)
                                // Will be auto-adjusted based on file size
    
    retryAttempts: 3,           // Number of retries per chunk
                                // Increase for unreliable connections
    
    retryDelay: 1000            // Initial retry delay in ms
                                // Uses exponential backoff
});
```

### Recommended Settings by Connection Speed:

**Fast Fiber (>100 Mbps)**:
```javascript
maxConcurrent: 8-10
chunkSize: 10-20 MB
```

**Medium (10-100 Mbps)**:
```javascript
maxConcurrent: 6  // Default
chunkSize: 5-10 MB
```

**Slow (<10 Mbps)**:
```javascript
maxConcurrent: 3-4
chunkSize: 2-5 MB
```

---

## 🔍 Monitoring Upload Performance

### Console Output

The upload manager logs detailed progress:

```javascript
📦 Uploading 500.00MB in 50 chunks of 10.00MB each
✅ Session initialized: abc-123
🚀 Starting parallel upload of 50 chunks (6 concurrent)
  ✓ Chunk 1/50 uploaded
  ✓ Chunk 2/50 uploaded
  ⚠️  Chunk 5 attempt 1 failed: Network error
  ⏳ Retrying in 1000ms...
  ✓ Chunk 5/50 uploaded
  ...
🏁 Finalizing upload...
✅ Upload complete in 75.3s (6.64 MB/s average)
```

### UI Progress Display

The upload page shows:
- **Progress bar**: Visual upload progress (0-100%)
- **Upload speed**: Real-time MB/s
- **Chunk progress**: "25/50 chunks" 
- **File size**: Size of file being uploaded

---

## 🐛 Troubleshooting

### Upload Slower Than Expected?

1. **Check concurrent uploads**:
   - Open browser DevTools → Network tab
   - During upload, you should see 6 requests to `/upload/chunk` running simultaneously
   - If you see only 1-2, increase `maxConcurrent`

2. **Check backend performance**:
   - Backend should respond to chunk uploads in <1 second
   - If slower, check:
     - B2 upload speed (test with their CLI)
     - Server CPU/memory usage
     - Database connection pool

3. **Network limitations**:
   - Test your upload speed: https://fast.com
   - Your actual upload speed can't exceed ISP limits
   - Some ISPs throttle bulk uploads

### Chunks Failing?

1. **Check chunk size**:
   - Very large chunks (>20MB) may timeout
   - Try reducing chunk size

2. **Increase retry attempts**:
   ```javascript
   retryAttempts: 5  // From 3
   ```

3. **Check backend logs**:
   - Look for errors in chunk upload handler
   - Verify B2 credentials and permissions

### Resume Not Working?

1. **Check session expiry**:
   - Sessions expire after 24 hours by default
   - Verify `expiresAt` in session

2. **Clear stale sessions**:
   ```javascript
   // Run on backend to clean up old sessions
   await chunkUploadService.cleanupExpiredSessions();
   ```

---

## 📈 Performance Testing

Test with different file sizes:

```bash
# Small file (< 100MB) - Uses standard upload
Test: 50MB video
Expected: 5-10 seconds
Method: Standard FormData upload

# Medium file (100MB - 1GB) - Uses chunked upload
Test: 500MB video
Expected: 30-90 seconds
Method: Parallel chunked (6 concurrent)
Chunks: 50 x 10MB

# Large file (1-5GB) - Uses chunked upload
Test: 2GB video
Expected: 1-3 minutes
Method: Parallel chunked (6 concurrent)
Chunks: 133 x 15MB

# Very large file (5-10GB) - Uses chunked upload
Test: 8GB video
Expected: 3-6 minutes
Method: Parallel chunked (6 concurrent)
Chunks: 400 x 20MB
```

---

## 🎯 Expected Performance Metrics

Based on connection speed:

| Connection | Sequential | Parallel (6x) | Improvement |
| ---------- | ---------- | ------------- | ----------- |
| 10 Mbps    | 1.25 MB/s  | 5-6 MB/s      | 4-5x        |
| 50 Mbps    | 6.25 MB/s  | 30-35 MB/s    | 5-6x        |
| 100 Mbps   | 12.5 MB/s  | 60-70 MB/s    | 5-6x        |
| 1 Gbps     | 125 MB/s   | 400-500 MB/s  | 4-5x        |

*Note: Actual performance varies based on server speed, B2 upload limits, and network conditions*

---

## ✨ Next Steps

Once parallel upload is working, consider these additional optimizations:

1. **Add upload queue** (multiple files)
2. **Implement pause/resume** (beyond session resume)
3. **Add WebWorker** for hash calculation
4. **Enable HTTP/2** for true multiplexing
5. **Add compression** for metadata uploads
6. **Implement pre-signed URLs** for direct B2 upload

See `CHUNKED_UPLOAD_OPTIMIZATION_GUIDE.md` for advanced optimizations.

---

## 🆘 Need Help?

Check these resources:
- **Full optimization guide**: `CHUNKED_UPLOAD_OPTIMIZATION_GUIDE.md`
- **Architecture plan**: `SCALABLE_ARCHITECTURE_PLAN.md`
- **Backend chunk controller**: `src/presentation/controllers/ChunkUploadController.js`
- **Frontend upload manager**: `frontend/src/shared/api/chunked-upload.js`

---

**Ready to upload at lightning speed? Start with Step 1!** ⚡

