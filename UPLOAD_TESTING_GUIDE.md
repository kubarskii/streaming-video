# Upload Testing Guide

Complete testing guide for the parallel chunked upload system.

---

## 🧪 Test Setup

### 1. Install Test Dependencies

```bash
cd frontend
npm install --save-dev vitest @vitest/ui @testing-library/react @testing-library/user-event
```

### 2. Run Unit Tests

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test chunked-upload
```

---

## 📋 Manual Testing Checklist

### Test 1: Small File Upload (<100MB)

**Purpose**: Verify standard upload works for small files

**Steps**:
1. Navigate to `/upload`
2. Select a video file < 100MB
3. Fill in title and description
4. Click "Upload Video"

**Expected Results**:
- ✅ Upload uses standard FormData (not chunked)
- ✅ Progress bar shows 0-100%
- ✅ Upload completes in <30 seconds
- ✅ Redirects to video page
- ✅ Video is playable

---

### Test 2: Large File Parallel Upload (>100MB)

**Purpose**: Verify parallel chunked upload works

**Steps**:
1. Navigate to `/upload`
2. Select a video file > 100MB (e.g., 500MB)
3. Fill in title and description
4. Click "Upload Video"

**Expected Results**:
- ✅ Console shows: "📦 Uploading X.XXMB in X chunks"
- ✅ Console shows: "🚀 Starting parallel upload of X chunks (6 concurrent)"
- ✅ Browser Network tab shows 6 simultaneous `/upload/chunk` requests
- ✅ UI shows upload speed (e.g., "25.5 MB/s")
- ✅ UI shows chunk progress (e.g., "25/50 chunks")
- ✅ Progress bar updates smoothly
- ✅ Upload completes 5-6x faster than sequential
- ✅ Console shows: "✅ Upload complete in Xs (X.XX MB/s average)"
- ✅ Redirects to video page
- ✅ Video is playable

---

### Test 3: Very Large File (>1GB)

**Purpose**: Verify system handles very large files

**Steps**:
1. Select a video file > 1GB
2. Monitor system resources during upload
3. Complete upload

**Expected Results**:
- ✅ Browser memory usage stays reasonable (<500MB)
- ✅ Backend memory usage stays reasonable
- ✅ Adaptive chunk size (15-20MB chunks)
- ✅ Upload completes successfully
- ✅ No memory leaks

---

### Test 4: Network Interruption & Retry

**Purpose**: Verify retry logic works

**Steps**:
1. Start uploading a large file
2. Open DevTools → Network tab
3. Throttle network to "Slow 3G"
4. Wait for some chunks to fail
5. Restore normal network speed

**Expected Results**:
- ✅ Console shows retry messages: "⚠️ Chunk X attempt Y failed"
- ✅ Console shows: "⏳ Retrying in Xms..."
- ✅ Failed chunks retry automatically
- ✅ Upload continues and completes
- ✅ No data corruption

---

### Test 5: Upload Cancellation

**Purpose**: Verify cancel works properly

**Steps**:
1. Start uploading a large file
2. Wait for 25% progress
3. Click "Cancel Upload" button
4. Check backend sessions

**Expected Results**:
- ✅ Upload stops immediately
- ✅ Progress resets to 0%
- ✅ Backend session cleaned up
- ✅ B2 multipart upload aborted
- ✅ No orphaned chunks in temp storage

---

### Test 6: Resume Upload (Session Resume)

**Purpose**: Verify resume from existing session works

**Steps**:
1. Start uploading a large file
2. Wait for 50% progress
3. Close browser (or refresh page)
4. Navigate back to `/upload`
5. Select the same file again

**Expected Results**:
- ✅ System detects existing incomplete upload
- ✅ Console shows: "♻️ Resuming: X chunks already uploaded"
- ✅ Only remaining chunks are uploaded
- ✅ Total time = time for remaining chunks only
- ✅ Upload completes successfully

---

### Test 7: Multiple File Types

**Purpose**: Verify different video formats work

**Test Files**:
- MP4 (H.264)
- WebM (VP9)
- MOV (QuickTime)
- AVI (older format)

**Expected Results**:
- ✅ All formats accepted
- ✅ Upload succeeds for all formats
- ✅ Videos are playable

---

### Test 8: Invalid File Upload

**Purpose**: Verify validation works

**Steps**:
1. Try to upload non-video file (e.g., .txt, .exe)
2. Try to upload file > 10GB
3. Try to upload without title

**Expected Results**:
- ✅ Non-video file rejected with error message
- ✅ File > 10GB rejected with error message
- ✅ Missing title shows error message
- ✅ No upload starts

---

### Test 9: Concurrent Uploads

**Purpose**: Verify system handles multiple simultaneous uploads

**Steps**:
1. Open 3 browser tabs
2. Start upload in each tab simultaneously
3. Monitor all uploads

**Expected Results**:
- ✅ All uploads progress independently
- ✅ No interference between uploads
- ✅ All uploads complete successfully
- ✅ Backend handles concurrent requests

---

### Test 10: Network Speed Variations

**Purpose**: Verify adaptive behavior

**Test Scenarios**:
- Fast network (>100 Mbps)
- Medium network (10-50 Mbps)
- Slow network (<10 Mbps)

**Expected Results**:
- ✅ Fast network: Uses 10-20MB chunks
- ✅ Medium network: Uses 5-10MB chunks
- ✅ Slow network: Uses 2-5MB chunks
- ✅ Chunk size adapts to connection speed

---

## 🔍 Performance Testing

### Load Test Script

Create `scripts/load-test-upload.js`:

```javascript
// Load test for chunked upload
import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
    stages: [
        { duration: '1m', target: 10 },  // Ramp up to 10 concurrent uploads
        { duration: '3m', target: 10 },  // Stay at 10 for 3 minutes
        { duration: '1m', target: 0 },   // Ramp down to 0
    ],
    thresholds: {
        http_req_duration: ['p(95)<5000'], // 95% of requests under 5s
        http_req_failed: ['rate<0.01'],    // Less than 1% failure rate
    },
};

export default function () {
    const baseUrl = 'http://localhost:3000';
    
    // Login first
    const loginRes = http.post(`${baseUrl}/api/auth/login`, {
        email: 'test@example.com',
        password: 'testpassword'
    });
    
    check(loginRes, {
        'login successful': (r) => r.status === 200,
    });
    
    const token = loginRes.json('token');
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
    
    // Initialize upload session
    const initRes = http.post(
        `${baseUrl}/api/upload/init`,
        JSON.stringify({
            fileName: `test-video-${__VU}-${__ITER}.mp4`,
            fileSize: 100 * 1024 * 1024, // 100MB
            mimeType: 'video/mp4',
            totalChunks: 20,
            title: `Load Test Video ${__VU}-${__ITER}`
        }),
        { headers }
    );
    
    check(initRes, {
        'init successful': (r) => r.status === 200,
        'got uploadId': (r) => r.json('uploadId') !== undefined,
    });
    
    const uploadId = initRes.json('uploadId');
    
    // Upload chunks (simulate)
    for (let i = 0; i < 20; i++) {
        const chunkData = new Uint8Array(5 * 1024 * 1024); // 5MB chunk
        
        const formData = {
            chunk: http.file(chunkData, `chunk-${i}.bin`),
            chunkIndex: i.toString(),
            chunkHash: `mock-hash-${i}`,
            uploadId: uploadId,
            totalChunks: '20'
        };
        
        const chunkRes = http.post(
            `${baseUrl}/api/upload/chunk`,
            formData,
            { headers }
        );
        
        check(chunkRes, {
            'chunk uploaded': (r) => r.status === 200,
        });
    }
    
    // Finalize upload
    const finalizeRes = http.post(
        `${baseUrl}/api/upload/finalize`,
        JSON.stringify({
            uploadId: uploadId,
            fileName: `test-video-${__VU}-${__ITER}.mp4`,
            title: `Load Test Video ${__VU}-${__ITER}`
        }),
        { headers }
    );
    
    check(finalizeRes, {
        'finalize successful': (r) => r.status === 201,
    });
    
    sleep(1);
}
```

**Run Load Test**:
```bash
# Install k6
brew install k6  # macOS
# or download from https://k6.io/docs/get-started/installation/

# Run test
k6 run scripts/load-test-upload.js
```

---

## 📊 Performance Benchmarks

### Expected Results (50 Mbps connection):

| File Size | Sequential | Parallel (6x) | Improvement | Pass/Fail |
|-----------|-----------|---------------|-------------|-----------|
| 100MB     | ~2 min    | ~20-30 sec    | 4-6x faster | ✅        |
| 500MB     | ~10 min   | ~1.5-2 min    | 5-7x faster | ✅        |
| 1GB       | ~20 min   | ~3-4 min      | 5-7x faster | ✅        |
| 5GB       | ~100 min  | ~15-20 min    | 5-7x faster | ✅        |

### Metrics to Track:

1. **Upload Speed**: Average MB/s
   - Sequential: ~6 MB/s
   - Parallel: ~30-35 MB/s
   - **Target**: 5x improvement minimum

2. **Network Utilization**
   - Sequential: ~30%
   - Parallel: ~90-95%
   - **Target**: 90%+ utilization

3. **Chunk Success Rate**
   - **Target**: >99% success rate

4. **Retry Rate**
   - **Target**: <5% of chunks require retry

5. **Memory Usage**
   - Frontend: <500MB during upload
   - Backend: <1GB per concurrent upload
   - **Target**: No memory leaks

---

## 🐛 Common Issues & Debug Steps

### Issue: Upload not faster

**Debug Steps**:
1. Open DevTools → Network tab
2. Count simultaneous `/upload/chunk` requests
3. If < 6, check `maxConcurrent` setting
4. Check backend logs for bottlenecks
5. Test B2 upload speed directly

**Tools**:
```bash
# Test B2 upload speed
b2 upload-file <bucket-name> test-file.dat test-file.dat

# Monitor backend CPU/memory
htop
# or
pm2 monit
```

---

### Issue: Chunks failing

**Debug Steps**:
1. Check browser console for error messages
2. Check backend logs: `tail -f logs/error.log`
3. Verify B2 credentials in `.env`
4. Test B2 connectivity
5. Check chunk size (reduce if timing out)

**Tools**:
```bash
# Test B2 connectivity
b2 get-bucket <bucket-name>

# Check backend logs
docker logs -f video-platform-api
# or
pm2 logs api
```

---

### Issue: High memory usage

**Debug Steps**:
1. Open DevTools → Memory profiler
2. Take heap snapshot before upload
3. Upload file
4. Take heap snapshot after upload
5. Compare snapshots for leaks
6. Reduce `maxConcurrent` if needed

**Tools**:
- Chrome DevTools Memory Profiler
- `performance.memory` API in console

---

## ✅ Test Results Template

```markdown
# Upload Test Results

**Date**: YYYY-MM-DD
**Tester**: Your Name
**Environment**: Development/Staging/Production

## Configuration
- maxConcurrent: 6
- chunkSize: 5-20MB (adaptive)
- retryAttempts: 3
- Connection Speed: XX Mbps

## Test Results

### Test 1: Small File (<100MB)
- File: 50MB MP4
- Result: ✅ Pass / ❌ Fail
- Time: XX seconds
- Notes: 

### Test 2: Large File (>100MB)
- File: 500MB MP4
- Result: ✅ Pass / ❌ Fail
- Time: XX seconds
- Speed: XX MB/s
- Parallel Requests: X/6
- Notes:

### Test 3: Very Large File (>1GB)
- File: 2GB MP4
- Result: ✅ Pass / ❌ Fail
- Time: XX minutes
- Speed: XX MB/s
- Memory Usage: XXX MB
- Notes:

### Test 4: Network Interruption
- Result: ✅ Pass / ❌ Fail
- Retries: X chunks retried
- Recovery Time: XX seconds
- Notes:

### Test 5: Upload Cancellation
- Result: ✅ Pass / ❌ Fail
- Cleanup: ✅ Successful / ❌ Failed
- Notes:

## Performance Metrics
- Average Upload Speed: XX MB/s
- Network Utilization: XX%
- Chunk Success Rate: XX%
- Retry Rate: XX%

## Issues Found
1. 
2. 
3. 

## Recommendations
1. 
2. 
3. 
```

---

## 🎯 Automated Testing with CI/CD

### GitHub Actions Workflow

Create `.github/workflows/test-upload.yml`:

```yaml
name: Test Upload System

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          cd frontend
          npm ci
      
      - name: Run unit tests
        run: |
          cd frontend
          npm test
      
      - name: Run integration tests
        run: |
          cd frontend
          npm run test:integration
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./frontend/coverage/coverage-final.json
```

---

## 📈 Success Criteria

**Minimum Requirements**:
- ✅ All unit tests pass
- ✅ 5x faster uploads on average
- ✅ >99% chunk upload success rate
- ✅ <1% system error rate
- ✅ Resume capability works
- ✅ Cancel cleans up resources
- ✅ Memory usage stays reasonable

**Optimal Performance**:
- ✅ 6-8x faster uploads
- ✅ >99.9% chunk success rate
- ✅ Network utilization >90%
- ✅ All retry logic works correctly
- ✅ No memory leaks
- ✅ Handles 10+ concurrent uploads

---

**Test early, test often! 🧪**

