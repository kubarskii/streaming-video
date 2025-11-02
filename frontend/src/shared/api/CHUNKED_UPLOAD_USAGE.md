# Chunked Upload with XMLHttpRequest Progress Tracking

## Overview

The enhanced `ChunkedUploadManagerAdvanced` now uses **XMLHttpRequest** instead of `fetch` for uploading chunks, enabling accurate per-chunk progress tracking and real-time upload speed calculation.

## Key Features

✅ **Accurate Progress Tracking**: XMLHttpRequest `upload.progress` event provides real-time upload progress for each chunk  
✅ **Real-Time Speed Calculation**: Upload speed is calculated from actual bytes transferred per second  
✅ **Parallel Upload Speed Aggregation**: When uploading multiple chunks in parallel, speeds are aggregated from all active uploads  
✅ **Per-Chunk Speed Details**: Access individual chunk upload speeds and progress  
✅ **Automatic Retry with Progress Resume**: Failed chunks are retried while maintaining progress tracking  

## Basic Usage

```javascript
import { chunkedUploadManagerAdvanced } from '@/shared/api/chunked-upload-advanced';

const file = document.getElementById('file-input').files[0];

const result = await chunkedUploadManagerAdvanced.uploadFile(
    file,
    {
        title: 'My Video',
        description: 'Video description',
        thumbnail: thumbnailFile
    },
    {
        onProgress: (progressData) => {
            console.log('Progress:', progressData.progress + '%');
            console.log('Speed:', progressData.speed);
            console.log('Uploaded:', progressData.uploadedChunks + '/' + progressData.totalChunks);
            console.log('Active chunks:', progressData.activeChunks);
        },
        onChunkComplete: (chunk) => {
            console.log('Chunk', chunk.index + 1, 'completed');
        },
        onError: (error) => {
            console.error('Upload error:', error);
        }
    }
);

console.log('Upload complete!', result);
```

## Progress Data Structure

The `onProgress` callback receives detailed progress information:

```javascript
{
    // Overall progress
    progress: 45,                    // Percentage (0-100)
    uploadedChunks: 9,              // Number of chunks completed
    totalChunks: 20,                // Total number of chunks
    uploadedBytes: 47185920,        // Bytes uploaded
    totalBytes: 104857600,          // Total file size
    
    // Real-time speed tracking (from XMLHttpRequest)
    speed: "5.23 MB/s",             // Formatted speed string
    speedBytes: 5483520,            // Raw speed in bytes/sec
    activeChunks: 6,                // Number of chunks currently uploading
    
    // Per-chunk details (optional)
    chunkDetails: [
        {
            chunkIndex: 5,
            loaded: 3145728,        // Bytes uploaded for this chunk
            total: 5242880,         // Total chunk size
            percentage: 60,         // Chunk progress (0-100)
            speed: 873813,          // Chunk upload speed (bytes/sec)
            speedFormatted: "0.83 MB/s"
        },
        // ... more chunks
    ]
}
```

## Advanced Example: Custom Progress UI

```javascript
import { chunkedUploadManagerAdvanced } from '@/shared/api/chunked-upload-advanced';
import { useState } from 'react';

function VideoUpload() {
    const [progress, setProgress] = useState(0);
    const [speed, setSpeed] = useState('0 MB/s');
    const [activeChunks, setActiveChunks] = useState(0);
    const [chunkDetails, setChunkDetails] = useState([]);
    const [uploaded, setUploaded] = useState(0);
    const [total, setTotal] = useState(0);

    const handleUpload = async (file) => {
        try {
            await chunkedUploadManagerAdvanced.uploadFile(
                file,
                { title: 'My Video', description: '' },
                {
                    onProgress: (data) => {
                        setProgress(data.progress);
                        setSpeed(data.speed);
                        setActiveChunks(data.activeChunks || 0);
                        setChunkDetails(data.chunkDetails || []);
                        setUploaded(data.uploadedChunks);
                        setTotal(data.totalChunks);
                    }
                }
            );
            alert('Upload complete!');
        } catch (error) {
            alert('Upload failed: ' + error.message);
        }
    };

    return (
        <div>
            <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />
            
            {/* Overall progress */}
            <div>
                <progress value={progress} max={100} />
                <p>{progress}% - {speed}</p>
                <p>{uploaded} / {total} chunks uploaded</p>
                <p>{activeChunks} chunks uploading in parallel</p>
            </div>

            {/* Per-chunk details */}
            <div>
                <h3>Active Uploads:</h3>
                {chunkDetails.map((chunk) => (
                    <div key={chunk.chunkIndex}>
                        Chunk {chunk.chunkIndex + 1}: {chunk.percentage}% 
                        ({chunk.speedFormatted})
                    </div>
                ))}
            </div>
        </div>
    );
}
```

## How It Works

### 1. XMLHttpRequest Upload Progress

Each chunk is uploaded using `XMLHttpRequest` which provides accurate progress tracking via the `upload.progress` event:

```javascript
xhr.upload.addEventListener('progress', (event) => {
    if (event.lengthComputable) {
        const percentage = (event.loaded / event.total) * 100;
        const speed = calculateSpeed(event.loaded, time);
        // Update UI with real-time progress
    }
});
```

### 2. Speed Calculation

Upload speed is calculated based on actual bytes transferred:

```javascript
const timeDelta = (now - lastUpdateTime) / 1000; // seconds
const bytesDelta = event.loaded - lastLoadedBytes;
const speed = bytesDelta / timeDelta; // bytes per second
```

### 3. Parallel Upload Aggregation

When multiple chunks upload in parallel, their speeds are aggregated:

```javascript
let totalSpeed = 0;
activeChunks.forEach((chunk) => {
    totalSpeed += chunk.speed;
});
// Display: "15.7 MB/s" (combined from all active uploads)
```

## Configuration Options

```javascript
const uploader = new ChunkedUploadManagerAdvanced({
    maxConcurrent: 6,           // Number of parallel chunk uploads
    chunkSize: 5 * 1024 * 1024, // 5MB per chunk (auto-adjusted)
    retryAttempts: 3,           // Number of retry attempts per chunk
    retryDelay: 1000,           // Initial retry delay (ms)
    useWebWorker: true,         // Use Web Worker for hash calculation
    useCompression: false       // Compress chunks (not recommended for video)
});
```

## Benefits Over Fetch API

| Feature                    | XMLHttpRequest                     | Fetch API              |
| -------------------------- | ---------------------------------- | ---------------------- |
| Upload progress tracking   | ✅ Native `upload.progress` event   | ❌ Not available        |
| Accurate speed calculation | ✅ Real-time bytes transferred      | ⚠️ Requires estimation  |
| Per-chunk progress         | ✅ Detailed progress for each chunk | ❌ No granular tracking |
| Browser support            | ✅ All browsers                     | ✅ Modern browsers      |
| Upload abort               | ✅ `xhr.abort()`                    | ✅ `controller.abort()` |

## Troubleshooting

### Progress not updating?

Ensure your server supports `Content-Length` headers and doesn't buffer the entire upload before processing.

### Speed calculation inaccurate?

- Check network conditions (WiFi vs. wired)
- Ensure no other downloads/uploads are active
- Speed is calculated as a moving average over time

### Chunks failing?

- Check server-side chunk size limits (default: 25MB)
- Verify authentication token is valid
- Check server logs for detailed error messages

## Migration from Fetch

If you're currently using `fetch` for uploads, the migration is automatic. The `ChunkedUploadManagerAdvanced` class already uses XMLHttpRequest internally. Just ensure you're using the latest version of the upload manager.

## Performance Tips

1. **Adjust concurrent uploads**: Increase `maxConcurrent` for faster connections (6-10), decrease for slower connections (2-4)
2. **Optimize chunk size**: Larger chunks = fewer requests but less granular progress. Auto-adjustment is enabled by default.
3. **Enable Web Worker**: Set `useWebWorker: true` to offload hash calculation from the main thread
4. **Disable compression**: Video files are already compressed, so skip `useCompression`

## Example: Real-Time Speed Display

```javascript
onProgress: (data) => {
    const { speed, speedBytes, activeChunks } = data;
    
    // Format speed for display
    console.log(`Upload Speed: ${speed}`);
    
    // Show average speed per chunk
    if (activeChunks > 0) {
        const avgPerChunk = (speedBytes / activeChunks) / (1024 * 1024);
        console.log(`Avg per chunk: ${avgPerChunk.toFixed(2)} MB/s`);
    }
    
    // Estimate time remaining
    const remainingBytes = data.totalBytes - data.uploadedBytes;
    const secondsRemaining = remainingBytes / speedBytes;
    console.log(`ETA: ${formatTime(secondsRemaining)}`);
}
```

## Conclusion

The XMLHttpRequest-based chunk upload provides **accurate, real-time progress tracking** with **precise upload speed calculation**. This enables you to build professional upload UIs with detailed progress information, ETA calculations, and per-chunk monitoring.

