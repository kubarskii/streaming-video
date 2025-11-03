// @ts-check
// Presentation: UploadController

const { formidable } = require('formidable');
const path = require('path');
const fs = require('fs');
const { getQueueManager } = require('../../infrastructure/queue/QueueManager');

class UploadController {
    constructor(videoService) {
        this.videoService = videoService;
        this.queueManager = getQueueManager();
    }

    async uploadVideo(req, res) {
        try {
            // Check authentication
            if (!req.user) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Authentication required' }));
            }

            const uploadDir = path.join(process.cwd(), 'videos', 'temp');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const form = formidable({
                uploadDir,
                keepExtensions: true,
                maxFileSize: 5 * 1024 * 1024 * 1024, // 5 GB
                filter: ({ mimetype }) => {
                    // Accept both video and image files
                    return mimetype && (mimetype.startsWith('video/') || mimetype.startsWith('image/'));
                },
            });

            const [fields, files] = await form.parse(req);

            const videoFile = files.video?.[0];
            if (!videoFile) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'No video file provided' }));
            }

            const thumbnailFile = files.thumbnail?.[0];
            const title = fields.title?.[0] || path.basename(videoFile.originalFilename || 'Untitled', path.extname(videoFile.originalFilename || ''));
            const description = fields.description?.[0] || '';

            // Upload video using VideoService
            const video = await this.videoService.uploadVideo({
                filePath: videoFile.filepath,
                fileName: videoFile.originalFilename || 'video.mp4',
                title,
                description,
                mimeType: videoFile.mimetype,
                sizeBytes: videoFile.size,
                userId: req.user.id,
                thumbnailPath: thumbnailFile?.filepath,
                thumbnailMimeType: thumbnailFile?.mimetype,
            });

            // Clean up temp files
            try {
                fs.unlinkSync(videoFile.filepath);
                if (thumbnailFile) {
                    fs.unlinkSync(thumbnailFile.filepath);
                }
            } catch (err) {
                console.error('Failed to delete temp file:', err);
            }

            // Add transcoding job to queue (non-blocking)
            try {
                await this.queueManager.addTranscodingJob({
                    videoId: video.id,
                    storageKey: video.storageKey,
                    userId: req.user.id,
                });
                console.log(`📤 Transcoding job queued for video ${video.id}`);
            } catch (queueError) {
                console.error(`❌ Failed to queue transcoding job:`, queueError.message);
                // Set video to ready so users can still watch the original file
                try {
                    video.status = 'ready';
                    await this.videoService.updateVideoMetadataUseCase.videoRepository.update(video);
                } catch (updateError) {
                    console.error(`❌ Failed to update video status:`, updateError.message);
                }
            }

            // If no thumbnail was uploaded, queue thumbnail generation
            if (!video.thumbnailUrl) {
                try {
                    await this.queueManager.addThumbnailJob({
                        videoId: video.id,
                        storageKey: video.storageKey,
                    });
                    console.log(`📤 Thumbnail job queued for video ${video.id}`);
                } catch (queueError) {
                    console.error(`❌ Failed to queue thumbnail job:`, queueError.message);
                }
            }

            // Convert thumbnail URL to server proxy URL
            const thumbnailUrl = video.thumbnailUrl ? this.convertToServerUrl(video.thumbnailUrl) : null;

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                message: 'Video uploaded successfully',
                video: {
                    id: video.id,
                    title: video.title,
                    description: video.description,
                    playbackUrl: video.getPlaybackUrl(),
                    thumbnailUrl: thumbnailUrl,
                },
            }));
        } catch (error) {
            console.error('Upload error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message || 'Upload failed' }));
        }
    }

    /**
     * Convert B2/CDN URLs to server proxy URLs for private buckets
     */
    convertToServerUrl(url) {
        if (!url) return null;

        // If it's already a server URL, return as-is
        if (url.includes('/video?file=')) {
            return url;
        }

        // Extract filename from B2/CDN URL
        const match = url.match(/\/([^/]+\.(svg|jpg|jpeg|png|gif|webp))$/i);
        if (match) {
            const filename = match[1];
            // Use relative path - works in any environment
            return `/video?file=${filename}`;
        }

        return url;
    }
}

module.exports = UploadController;

