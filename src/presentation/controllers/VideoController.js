// Presentation: VideoController
// HTTP request handlers for video operations

class VideoController {
    constructor(videoService) {
        this.videoService = videoService;
    }

    /**
     * Get video by ID
     */
    async getVideo(req, res, videoId) {
        try {
            const video = await this.videoService.getVideo(videoId);

            if (!video) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Video not found' }));
            }

            // Convert thumbnail URL to server proxy URL if it's a B2 URL
            const thumbnailUrl = this.convertToServerUrl(video.thumbnailUrl);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                id: video.id,
                title: video.title,
                description: video.description,
                fileName: video.fileName,
                storageKey: video.storageKey,
                mimeType: video.mimeType,
                sizeBytes: video.sizeBytes,
                durationMs: video.durationMs,
                width: video.width,
                height: video.height,
                status: video.status,
                uploadedAt: video.uploadedAt,
                playbackUrl: video.getPlaybackUrl(),
                thumbnailUrl: thumbnailUrl,
                views: video.views || 0,
                userId: video.userId,
            }));
        } catch (error) {
            console.error('Error getting video:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }

    /**
     * List videos
     */
    async listVideos(req, res, queryParams) {
        try {
            const limit = parseInt(queryParams.limit || '50', 10);
            const offset = parseInt(queryParams.offset || '0', 10);
            const status = queryParams.status;
            const userId = queryParams.userId;

            const result = await this.videoService.listVideos({
                limit,
                offset,
                status,
                userId,
            });

            const videos = result.videos.map(video => ({
                id: video.id,
                title: video.title,
                description: video.description,
                fileName: video.fileName,
                storageKey: video.storageKey,
                mimeType: video.mimeType,
                sizeBytes: video.sizeBytes,
                durationMs: video.durationMs,
                width: video.width,
                height: video.height,
                status: video.status,
                uploadedAt: video.uploadedAt,
                playbackUrl: video.getPlaybackUrl(),
                thumbnailUrl: this.convertToServerUrl(video.thumbnailUrl),
                views: video.views || 0,
            }));

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                videos,
                total: result.total,
                limit: result.limit,
                offset: result.offset,
                hasMore: result.hasMore,
            }));
        } catch (error) {
            console.error('Error listing videos:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }

    /**
     * Delete video
     */
    async deleteVideo(req, res, videoId) {
        try {
            const deleted = await this.videoService.deleteVideo(videoId);

            if (deleted) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Video deleted successfully' }));
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Video not found' }));
            }
        } catch (error) {
            console.error('Error deleting video:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message || 'Internal server error' }));
        }
    }

    /**
     * Update video metadata (title, description)
     */
    async updateVideoMetadata(req, res, videoId) {
        try {
            // Check authentication
            if (!req.user) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Authentication required' }));
            }

            // Parse body
            let body = '';
            for await (const chunk of req) {
                body += chunk;
            }

            const { title, description } = JSON.parse(body);

            if (!title && description === undefined) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'At least one field (title or description) must be provided' }));
            }

            const video = await this.videoService.updateVideoMetadata(
                videoId,
                req.user.id,
                { title, description }
            );

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                message: 'Video updated successfully',
                video: {
                    id: video.id,
                    title: video.title,
                    description: video.description,
                    thumbnailUrl: this.convertToServerUrl(video.thumbnailUrl),
                    playbackUrl: video.getPlaybackUrl(),
                },
            }));
        } catch (error) {
            console.error('Error updating video:', error);
            if (error.message.includes('not found')) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
            } else if (error.message.includes('Unauthorized')) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
            }
            res.end(JSON.stringify({ error: error.message || 'Internal server error' }));
        }
    }

    /**
     * Update video thumbnail
     */
    async updateVideoThumbnail(req, res, videoId) {
        try {
            // Check authentication
            if (!req.user) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Authentication required' }));
            }

            const { formidable } = require('formidable');
            const path = require('path');
            const fs = require('fs');

            const uploadDir = path.join(process.cwd(), 'videos', 'temp');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const form = formidable({
                uploadDir,
                keepExtensions: true,
                maxFileSize: 10 * 1024 * 1024, // 10 MB for thumbnails
                filter: ({ mimetype }) => {
                    return mimetype && mimetype.startsWith('image/');
                },
            });

            const [fields, files] = await form.parse(req);

            const thumbnailFile = files.thumbnail?.[0];
            if (!thumbnailFile) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'No thumbnail file provided' }));
            }

            const video = await this.videoService.updateVideoThumbnail(
                videoId,
                req.user.id,
                thumbnailFile.filepath,
                thumbnailFile.mimetype
            );

            // Clean up temp file
            try {
                fs.unlinkSync(thumbnailFile.filepath);
            } catch (err) {
                console.error('Failed to delete temp file:', err);
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                message: 'Thumbnail updated successfully',
                video: {
                    id: video.id,
                    title: video.title,
                    thumbnailUrl: this.convertToServerUrl(video.thumbnailUrl),
                },
            }));
        } catch (error) {
            console.error('Error updating thumbnail:', error);
            if (error.message.includes('not found')) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
            } else if (error.message.includes('Unauthorized')) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
            }
            res.end(JSON.stringify({ error: error.message || 'Internal server error' }));
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
        // Example: https://f003.backblazeb2.com/file/videos-pub-keks/thumb_xxx.svg
        const match = url.match(/\/([^/]+\.(svg|jpg|jpeg|png|gif|webp))$/i);
        if (match) {
            const filename = match[1];
            const baseUrl = process.env.SERVER_BASE_URL || 'http://localhost:3000';
            return `${baseUrl}/video?file=${filename}`;
        }

        // If we can't parse it, return original
        return url;
    }
}

module.exports = VideoController;

