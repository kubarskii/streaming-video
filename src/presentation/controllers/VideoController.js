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
                thumbnailUrl: video.thumbnailUrl,
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
                thumbnailUrl: video.thumbnailUrl,
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
}

module.exports = VideoController;

