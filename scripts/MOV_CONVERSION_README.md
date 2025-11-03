# MOV to WebM Conversion System

## Overview

This system automatically converts MOV (QuickTime) video files to WebM format for better browser compatibility across Android, Windows, and other non-Apple devices.

## Why Convert MOV to WebM?

- **MOV files** (video/quicktime) are primarily supported on Apple devices
- **WebM format** is widely supported across all modern browsers on all platforms
- Android and Windows browsers have limited or no support for MOV files
- WebM uses VP9 codec which provides good quality and compression

## Architecture

### Components

1. **Queue System** (`src/infrastructure/queue/QueueManager.js`)
   - New `MOV_CONVERSION` queue for batch processing
   - Lowest priority (3) to not interfere with regular uploads

2. **Conversion Worker** (`src/infrastructure/queue/workers/ConversionWorker.js`)
   - Processes MOV to WebM conversion jobs
   - Downloads original file, converts it, uploads WebM version
   - Automatically cleans up temp files and deletes original MOV from storage
   - Updates database with new file information

3. **Video Transcoder** (`src/infrastructure/media/VideoTranscoder.js`)
   - Uses FFmpeg with VP9 codec for WebM conversion
   - Configurable quality settings (CRF and audio bitrate)

4. **Queue Script** (`scripts/queue-mov-conversions.js`)
   - Scans database for all MOV files
   - Queues them for conversion
   - Provides progress reporting

## Usage

### Step 1: Start the Worker

Make sure the video processing worker is running:

```bash
npm run worker
```

Or in development mode:

```bash
npm run worker:dev
```

The worker will automatically start processing jobs from all queues including:
- `video-transcoding` (priority 1)
- `thumbnail-generation` (priority 2)
- `mov-conversion` (priority 3)

### Step 2: Queue MOV Files for Conversion

Run the queue script to find and queue all MOV files:

```bash
npm run queue:mov-convert
```

This script will:
1. Connect to the database
2. Find all videos with:
   - MIME type: `video/quicktime`
   - File name ending in `.mov` or `.MOV`
3. Display all found videos with details
4. Queue each video for conversion
5. Show a summary of results

### Example Output

```
🎬 MOV to WebM Conversion Queue Script
========================================

📦 Redis URL: redis://localhost:6379
📦 Database: Connected

✅ Database connected

🔍 Searching for MOV videos...

📊 Found 5 MOV video(s)

Videos to be queued for conversion:
────────────────────────────────────────────────────────────────────────────────
1. My Sample Video
   ID: abc123-def456-ghi789
   File: sample.mov
   Size: 45.67 MB
   MIME: video/quicktime
   Status: ready
   Uploaded: 2025-11-03T10:30:00.000Z

...

📤 Queueing conversion jobs...

✅ Queued: My Sample Video (abc123-def456-ghi789)
...

════════════════════════════════════════════════════════════════════════════════
📊 Summary:
   Total videos found: 5
   Successfully queued: 5
   Failed: 0
════════════════════════════════════════════════════════════════════════════════

✅ Jobs queued successfully!
💡 Make sure the worker is running to process these jobs.
   Run: npm run worker
```

## Conversion Process

For each MOV file, the worker:

1. **Downloads** the original MOV file from storage (B2/Local)
2. **Converts** to WebM format using FFmpeg:
   - Video: VP9 codec
   - Audio: Vorbis codec
   - Quality: CRF 32 (configurable)
   - Audio Bitrate: 128k (configurable)
3. **Uploads** the WebM file to storage
4. **Updates** the database record:
   - Changes `fileName` from `.mov` to `.webm`
   - Updates `storageKey` and `storageUrl`
   - Changes `mimeType` to `video/webm`
   - Updates `sizeBytes` with new file size
5. **Cleans up** temporary files
6. **Deletes** the original MOV file from storage

## Monitoring

### Check Queue Status

You can monitor the conversion queue using Redis CLI or a queue monitoring tool like Bull Board.

### Worker Logs

The worker provides detailed logging:
- `🔄 Processing MOV conversion: {jobId}` - Job started
- `✅ MOV conversion completed: {jobId}` - Job succeeded
- `❌ MOV conversion job failed: {jobId}` - Job failed
- Progress updates at 10%, 20%, 40%, 70%, 85%, 95%, 100%

### Check Video Status

After conversion, verify in the database:

```sql
SELECT id, title, fileName, mimeType, sizeBytes 
FROM "Video" 
WHERE mimeType = 'video/webm'
AND fileName LIKE '%.webm';
```

## Error Handling

The system includes robust error handling:

- **Retry Logic**: Failed jobs are retried up to 3 times with exponential backoff
- **Re-queuing**: After all retries exhausted, jobs are re-queued with a 1-minute delay
- **Status Updates**: Videos are marked as `failed` if conversion fails
- **Cleanup**: Temporary files are cleaned up even if conversion fails
- **Permanent Failures**: Jobs for deleted videos are not re-queued

## Configuration

### Conversion Quality Settings

Edit `src/infrastructure/queue/workers/ConversionWorker.js`:

```javascript
await this.videoTranscoder.convertToWebm(originalPath, webmPath, {
    crf: 32, // Quality (lower = better, range: 4-63)
    audioBitrate: '128k' // Audio quality
});
```

### Queue Priority

Edit `src/infrastructure/queue/QueueManager.js`:

```javascript
priority: 3, // Lowest priority for batch conversions
```

## Best Practices

1. **Run During Off-Peak Hours**: MOV conversions are CPU-intensive
2. **Monitor Disk Space**: Conversions require temporary storage
3. **Check Logs**: Monitor for any conversion failures
4. **Backup Original Files**: Consider backing up before bulk conversion
5. **Test First**: Try converting a few files before queuing all

## Troubleshooting

### Worker Not Processing Jobs

1. Check if worker is running: `ps aux | grep worker`
2. Check Redis connection: `redis-cli ping`
3. Check worker logs for errors

### Conversion Failures

Common issues:
- **Corrupted MOV file**: Cannot be converted
- **Insufficient disk space**: Need space for temp files
- **FFmpeg not installed**: Required for conversion
- **Storage errors**: Check B2/storage credentials

### Job Stuck

If a job seems stuck:
1. Check worker logs
2. Check Redis for active jobs: `redis-cli`
3. Restart the worker if needed

## Performance

### Processing Time

Approximate conversion times (depends on hardware):
- 100MB MOV file: ~2-5 minutes
- 500MB MOV file: ~10-15 minutes
- 1GB MOV file: ~20-30 minutes

### File Size Comparison

WebM files are typically:
- **Smaller**: 20-40% reduction in file size
- **Better compression**: VP9 codec is more efficient than H.264

### Concurrency

The worker processes **1 video at a time** to avoid overwhelming the system. To increase throughput:
1. Run multiple worker instances
2. Increase worker concurrency (not recommended for CPU-intensive tasks)

## Future Enhancements

Potential improvements:
- [ ] Add progress tracking in database
- [ ] Email notifications on completion
- [ ] Batch status endpoint
- [ ] Support for other input formats (AVI, MKV)
- [ ] Quality preset selection
- [ ] Parallel processing with multiple workers

## Related Files

- `src/infrastructure/config/QueueConfig.js` - Queue configuration
- `src/infrastructure/queue/QueueManager.js` - Queue management
- `src/infrastructure/queue/workers/ConversionWorker.js` - Conversion logic
- `src/infrastructure/queue/workers/WorkerManager.js` - Worker orchestration
- `src/infrastructure/media/VideoTranscoder.js` - FFmpeg wrapper
- `scripts/queue-mov-conversions.js` - Queue script
- `worker.js` - Worker entry point

## Support

For issues or questions:
1. Check worker logs
2. Review this documentation
3. Check Redis queue status
4. Verify FFmpeg installation: `ffmpeg -version`


