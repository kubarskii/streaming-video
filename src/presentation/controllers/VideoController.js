// @ts-check
// Presentation: VideoController
// HTTP request handlers for video operations

const { z } = require('zod');
const {
    updateVideoMetadataSchema,
    listVideosQuerySchema,
    uuidSchema
} = require('../../infrastructure/validation/schemas');
const {
    validateQuery,
    validateParams,
    parseAndValidateBody,
    sendValidationError
} = require('../../infrastructure/validation/validator');

class VideoController {
    constructor(videoService) {
        this.videoService = videoService;
    }

    /**
     * Get video by ID
     */
    async getVideo(req, res, videoId) {
        try {
            // Validate video ID
            const validation = validateParams(z.object({ id: uuidSchema }), { id: videoId });
            if (validation.success === false) {
                return sendValidationError(res, validation.error, 400);
            }

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
            // Validate query parameters
            const validation = validateQuery(listVideosQuerySchema, queryParams);
            if (validation.success === false) {
                return sendValidationError(res, validation.error, 400);
            }

            const { limit, offset, status, userId, search } = validation.data;

            const result = await this.videoService.listVideos({
                limit,
                offset,
                status,
                userId,
                search
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
                userId: video.userId,
                user: video.user ? {
                    id: video.user.id,
                    username: video.user.username,
                    email: video.user.email,
                    channel: video.user.channel ? {
                        id: video.user.channel.id,
                        name: video.user.channel.name,
                    } : null,
                } : null,
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

            // Validate video ID
            const idValidation = validateParams(z.object({ id: uuidSchema }), { id: videoId });
            if (idValidation.success === false) {
                return sendValidationError(res, idValidation.error, 400);
            }

            // Validate and parse request body
            const validatedData = await parseAndValidateBody(req, updateVideoMetadataSchema);

            const video = await this.videoService.updateVideoMetadata(
                videoId,
                req.user.id,
                validatedData
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
     * Get available quality variants for a video
     */
    async getVideoQualities(req, res, videoId) {
        try {
            console.log(`[VideoController] getVideoQualities called for video: ${videoId}`);

            // Validate video ID
            const validation = validateParams(z.object({ id: uuidSchema }), { id: videoId });
            if (validation.success === false) {
                return sendValidationError(res, validation.error, 400);
            }

            const qualities = await this.videoService.getVideoQualities(videoId);
            console.log(`[VideoController] Found ${qualities.length} qualities:`, qualities);

            const response = {
                videoId,
                count: qualities.length,
                qualities: qualities.map(q => ({
                    id: q.id,
                    quality: q.quality,
                    label: q.label,
                    width: q.width,
                    height: q.height,
                    sizeBytes: q.sizeBytes,
                    bitrate: q.bitrate,
                    status: q.status,
                    playbackUrl: `/video?file=${q.storageKey}`
                }))
            };

            console.log(`[VideoController] Sending response:`, JSON.stringify(response, null, 2));

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
        } catch (error) {
            console.error('Error getting video qualities:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }

    /**
     * Trigger transcoding for a video
     */
    async transcodeVideo(req, res, videoId) {
        try {
            // Check authentication
            // @ts-ignore - user property added by auth middleware
            if (!req.user) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Authentication required' }));
                return;
            }

            // Validate video ID
            const validation = validateParams(z.object({ id: uuidSchema }), { id: videoId });
            if (validation.success === false) {
                return sendValidationError(res, validation.error, 400);
            }

            // Start transcoding (async - don't wait)
            this.videoService.transcodeVideo(videoId)
                .then(() => console.log(`✅ Transcoding complete for video ${videoId}`))
                .catch(err => console.error(`❌ Transcoding failed for video ${videoId}:`, err));

            res.writeHead(202, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                message: 'Transcoding started. This may take several minutes.',
                videoId,
                checkStatusAt: `/api/videos/${videoId}/qualities`
            }));
        } catch (error) {
            console.error('Error starting transcoding:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
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
            // Use relative path - works in any environment
            return `/video?file=${filename}`;
        }

        // If we can't parse it, return original
        return url;
    }
}

module.exports = VideoController;

