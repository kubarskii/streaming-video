// @ts-check
// Upload Service Router
// NO authentication routes (handled by Gateway)
// TODO: Separate channels, playlists, social features into dedicated services

const { URL } = require('url');

class UploadServiceRouter {
    constructor(videoController, chunkUploadController, queueController, channelController, playlistController, videoLikeController, subscriptionController, commentController) {
        this.videoController = videoController;
        this.chunkUploadController = chunkUploadController;
        this.queueController = queueController;
        this.channelController = channelController;
        this.playlistController = playlistController;
        this.videoLikeController = videoLikeController;
        this.subscriptionController = subscriptionController;
        this.commentController = commentController;
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

        // ============================================================
        // CHANNEL ROUTES (TODO: Move to separate service)
        // ============================================================

        if (pathname === '/api/channels' && req.method === 'POST') {
            await this.channelController.createChannel(req, res);
            return true;
        }

        if (pathname === '/api/channels' && req.method === 'GET') {
            await this.channelController.getChannel(req, res, queryParams);
            return true;
        }

        if (pathname === '/api/channels/list' && req.method === 'GET') {
            await this.channelController.listChannels(req, res, queryParams);
            return true;
        }

        if (pathname.match(/^\/api\/channels\/[^/]+$/) && req.method === 'PATCH') {
            const channelId = pathname.split('/')[3];
            await this.channelController.updateChannel(req, res, channelId);
            return true;
        }

        // ============================================================
        // PLAYLIST ROUTES (TODO: Move to separate service)
        // ============================================================

        if (pathname === '/api/playlists' && req.method === 'GET') {
            await this.playlistController.listPlaylists(req, res, queryParams);
            return true;
        }

        if (pathname === '/api/playlists' && req.method === 'POST') {
            await this.playlistController.createPlaylist(req, res);
            return true;
        }

        if (pathname.match(/^\/api\/playlists\/slug\/[^/]+$/) && req.method === 'GET') {
            const slug = decodeURIComponent(pathname.split('/')[4]);
            await this.playlistController.getPlaylistBySlug(req, res, slug);
            return true;
        }

        if (pathname.match(/^\/api\/playlists\/[^/]+$/) && req.method === 'GET') {
            const playlistId = pathname.split('/')[3];
            await this.playlistController.getPlaylist(req, res, playlistId);
            return true;
        }

        if (pathname.match(/^\/api\/playlists\/[^/]+$/) && req.method === 'PATCH') {
            const playlistId = pathname.split('/')[3];
            await this.playlistController.updatePlaylist(req, res, playlistId);
            return true;
        }

        if (pathname.match(/^\/api\/playlists\/[^/]+$/) && req.method === 'DELETE') {
            const playlistId = pathname.split('/')[3];
            await this.playlistController.deletePlaylist(req, res, playlistId);
            return true;
        }

        if (pathname.match(/^\/api\/playlists\/[^/]+\/videos$/) && req.method === 'POST') {
            const playlistId = pathname.split('/')[3];
            await this.playlistController.addVideoToPlaylist(req, res, playlistId);
            return true;
        }

        if (pathname.match(/^\/api\/playlists\/[^/]+\/videos\/[^/]+$/) && req.method === 'DELETE') {
            const [, , , playlistId, , videoId] = pathname.split('/');
            await this.playlistController.removeVideoFromPlaylist(req, res, playlistId, videoId);
            return true;
        }

        if (pathname.match(/^\/api\/playlists\/[^/]+\/videos\/reorder$/) && (req.method === 'POST' || req.method === 'PATCH')) {
            const playlistId = pathname.split('/')[3];
            await this.playlistController.reorderPlaylist(req, res, playlistId);
            return true;
        }

        // ============================================================
        // LIKES ROUTES (TODO: Move to social service)
        // ============================================================

        if (pathname.match(/^\/api\/videos\/[^/]+\/like$/) && req.method === 'POST') {
            const videoId = pathname.split('/')[3];
            await this.videoLikeController.likeVideo(req, res, videoId);
            return true;
        }

        if (pathname.match(/^\/api\/videos\/[^/]+\/like$/) && req.method === 'DELETE') {
            const videoId = pathname.split('/')[3];
            await this.videoLikeController.removeLike(req, res, videoId);
            return true;
        }

        if (pathname.match(/^\/api\/videos\/[^/]+\/likes$/) && req.method === 'GET') {
            const videoId = pathname.split('/')[3];
            await this.videoLikeController.getLikeStats(req, res, videoId);
            return true;
        }

        // ============================================================
        // SUBSCRIPTION ROUTES (TODO: Move to social service)
        // ============================================================

        if (pathname === '/api/subscriptions' && req.method === 'GET') {
            await this.subscriptionController.getUserSubscriptions(req, res);
            return true;
        }

        if (pathname === '/api/subscriptions' && req.method === 'POST') {
            await this.subscriptionController.subscribe(req, res);
            return true;
        }

        if (pathname.match(/^\/api\/subscriptions\/[^/]+$/) && req.method === 'DELETE') {
            const channelId = pathname.split('/')[3];
            await this.subscriptionController.unsubscribe(req, res, channelId);
            return true;
        }

        if (pathname.match(/^\/api\/subscriptions\/[^/]+\/status$/) && req.method === 'GET') {
            const channelId = pathname.split('/')[3];
            await this.subscriptionController.checkStatus(req, res, channelId);
            return true;
        }

        // ============================================================
        // COMMENT ROUTES (TODO: Move to social service)
        // ============================================================

        if (pathname === '/api/comments' && req.method === 'POST') {
            await this.commentController.createComment(req, res);
            return true;
        }

        if (pathname === '/api/comments' && req.method === 'GET') {
            await this.commentController.getComments(req, res, queryParams);
            return true;
        }

        if (pathname.match(/^\/api\/comments\/[^/]+$/) && req.method === 'PATCH') {
            const commentId = pathname.split('/')[3];
            await this.commentController.updateComment(req, res, commentId);
            return true;
        }

        if (pathname.match(/^\/api\/comments\/[^/]+$/) && req.method === 'DELETE') {
            const commentId = pathname.split('/')[3];
            await this.commentController.deleteComment(req, res, commentId);
            return true;
        }

        // Not found
        return false;
    }
}

module.exports = UploadServiceRouter;
