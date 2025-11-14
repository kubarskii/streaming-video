// @ts-check
// Upload Service Router
// Handles video uploads, video metadata CRUD, and queue management
// Authentication is handled by Gateway
// Note: Channels, playlists, likes, comments, and subscriptions are handled by separate services

const { URL } = require('url');

class UploadServiceRouter {
    constructor(videoController, chunkUploadController, queueController) {
        this.videoController = videoController;
        this.chunkUploadController = chunkUploadController;
        this.queueController = queueController;
    }

    async route(req, res) {
        // Parse URL with error handling
        let urlObj, pathname, queryParams;
        try {
            // Sanitize URL - handle double slashes and empty paths
            let sanitizedUrl = req.url || '/';
            if (sanitizedUrl === '//' || sanitizedUrl === '') {
                sanitizedUrl = '/';
            }

            urlObj = new URL(sanitizedUrl, `http://${req.headers.host}`);
            pathname = urlObj.pathname;
            queryParams = Object.fromEntries(urlObj.searchParams);
        } catch (error) {
            console.error(`❌ Invalid URL: "${req.url}"`, error.message);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid URL' }));
            return false;
        }

        // ============================================================
        // CHUNKED UPLOAD ROUTES
        // ============================================================

        if (pathname === '/api/upload/init' && req.method === 'POST') {
            await this.chunkUploadController.initializeUpload(req, res);
            return true;
        }

        if (pathname === '/api/upload/chunk' && req.method === 'POST') {
            await this.chunkUploadController.uploadChunk(req, res);
            return true;
        }

        if (pathname === '/api/upload/finalize' && req.method === 'POST') {
            await this.chunkUploadController.finalizeUpload(req, res);
            return true;
        }

        if (pathname.match(/^\/api\/upload\/status\/[^/]+$/) && req.method === 'GET') {
            const uploadId = pathname.split('/')[4];
            await this.chunkUploadController.getUploadStatus(req, res, uploadId);
            return true;
        }

        if (pathname.match(/^\/api\/upload\/[^/]+$/) && req.method === 'DELETE') {
            const uploadId = pathname.split('/')[3];
            await this.chunkUploadController.cancelUpload(req, res, uploadId);
            return true;
        }

        // ============================================================
        // VIDEO METADATA ROUTES
        // ============================================================

        if (pathname === '/api/videos' && req.method === 'GET') {
            await this.videoController.listVideos(req, res, queryParams);
            return true;
        }

        if (pathname.match(/^\/api\/videos\/[^/]+\/processing-status$/) && req.method === 'GET') {
            const videoId = pathname.split('/')[3];
            await this.queueController.getVideoProcessingStatus(req, res, videoId);
            return true;
        }

        if (pathname.match(/^\/api\/videos\/[^/]+\/thumbnail$/) && req.method === 'PUT') {
            const videoId = pathname.split('/')[3];
            await this.videoController.updateVideoThumbnail(req, res, videoId);
            return true;
        }

        if (pathname.match(/^\/api\/videos\/[^/]+$/) && req.method === 'GET') {
            const videoId = pathname.split('/')[3];
            await this.videoController.getVideo(req, res, videoId);
            return true;
        }

        if (pathname.match(/^\/api\/videos\/[^/]+$/) && req.method === 'DELETE') {
            const videoId = pathname.split('/')[3];
            await this.videoController.deleteVideo(req, res, videoId);
            return true;
        }

        if (pathname.match(/^\/api\/videos\/[^/]+$/) && req.method === 'PATCH') {
            const videoId = pathname.split('/')[3];
            await this.videoController.updateVideoMetadata(req, res, videoId);
            return true;
        }

        // ============================================================
        // QUEUE MANAGEMENT ROUTES
        // ============================================================

        if (pathname === '/api/queues/metrics' && req.method === 'GET') {
            await this.queueController.getQueueMetrics(req, res);
            return true;
        }

        if (pathname === '/api/queues/health' && req.method === 'GET') {
            await this.queueController.getQueueHealth(req, res);
            return true;
        }

        if (pathname.match(/^\/api\/queues\/[^/]+\/jobs\/[^/]+\/retry$/) && req.method === 'POST') {
            const [, , , queueName, , jobId] = pathname.split('/');
            await this.queueController.retryJob(req, res, queueName, jobId);
            return true;
        }


        // Not found
        return false;
    }
}

module.exports = UploadServiceRouter;
