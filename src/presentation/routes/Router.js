// @ts-check
// Presentation: Router
// Routes HTTP requests to appropriate controllers

const { URL } = require('url');

class Router {
    constructor(videoController, streamController, authController, channelController, subscriptionController, commentController, chunkUploadController, videoLikeController, playlistController, queueController) {
        this.videoController = videoController;
        this.streamController = streamController;
        this.authController = authController;
        this.channelController = channelController;
        this.subscriptionController = subscriptionController;
        this.commentController = commentController;
        this.chunkUploadController = chunkUploadController;
        this.videoLikeController = videoLikeController;
        this.playlistController = playlistController;
        this.queueController = queueController;
    }

    /**
     * Route incoming request to appropriate handler
     */
    async route(req, res) {
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const pathname = urlObj.pathname;
        const queryParams = Object.fromEntries(urlObj.searchParams);

        // Auth Routes
        if (pathname === '/api/auth/register' && req.method === 'POST') {
            return await this.authController.register(req, res);
        }

        if (pathname === '/api/auth/login' && req.method === 'POST') {
            return await this.authController.login(req, res);
        }

        if (pathname === '/api/auth/logout' && req.method === 'POST') {
            return await this.authController.logout(req, res);
        }

        if (pathname === '/api/auth/me' && req.method === 'GET') {
            return await this.authController.me(req, res);
        }

        // Chunked Upload Routes (All uploads use chunked API)
        if (pathname === '/api/upload/init' && req.method === 'POST') {
            return await this.chunkUploadController.initializeUpload(req, res);
        }

        if (pathname === '/api/upload/chunk' && req.method === 'POST') {
            return await this.chunkUploadController.uploadChunk(req, res);
        }

        if (pathname === '/api/upload/finalize' && req.method === 'POST') {
            return await this.chunkUploadController.finalizeUpload(req, res);
        }

        if (pathname.match(/^\/api\/upload\/status\/[^/]+$/) && req.method === 'GET') {
            const uploadId = pathname.split('/')[4];
            return await this.chunkUploadController.getUploadStatus(req, res, uploadId);
        }

        if (pathname.match(/^\/api\/upload\/[^/]+$/) && req.method === 'DELETE') {
            const uploadId = pathname.split('/')[3];
            return await this.chunkUploadController.cancelUpload(req, res, uploadId);
        }

        // Video API Routes
        if (pathname === '/api/videos' && req.method === 'GET') {
            return await this.videoController.listVideos(req, res, queryParams);
        }

        // Playlist Routes
        if (pathname === '/api/playlists' && req.method === 'GET') {
            return await this.playlistController.listPlaylists(req, res, queryParams);
        }

        if (pathname === '/api/playlists' && req.method === 'POST') {
            return await this.playlistController.createPlaylist(req, res);
        }

        if (pathname.match(/^\/api\/playlists\/slug\/[^/]+$/) && req.method === 'GET') {
            const slug = decodeURIComponent(pathname.split('/')[4]);
            return await this.playlistController.getPlaylistBySlug(req, res, slug);
        }

        if (pathname.match(/^\/api\/playlists\/[^/]+\/videos\/[^/]+$/) && req.method === 'DELETE') {
            const [, , , playlistId, , videoId] = pathname.split('/');
            return await this.playlistController.removeVideoFromPlaylist(req, res, playlistId, videoId);
        }

        if (pathname.match(/^\/api\/playlists\/[^/]+\/videos$/) && req.method === 'POST') {
            const playlistId = pathname.split('/')[3];
            return await this.playlistController.addVideoToPlaylist(req, res, playlistId);
        }

        if (pathname.match(/^\/api\/playlists\/[^/]+\/videos\/reorder$/) && (req.method === 'POST' || req.method === 'PATCH')) {
            const playlistId = pathname.split('/')[3];
            return await this.playlistController.reorderPlaylist(req, res, playlistId);
        }

        if (pathname.match(/^\/api\/playlists\/[^/]+$/) && req.method === 'GET') {
            const playlistId = pathname.split('/')[3];
            return await this.playlistController.getPlaylist(req, res, playlistId);
        }

        if (pathname.match(/^\/api\/playlists\/[^/]+$/) && req.method === 'PATCH') {
            const playlistId = pathname.split('/')[3];
            return await this.playlistController.updatePlaylist(req, res, playlistId);
        }

        if (pathname.match(/^\/api\/playlists\/[^/]+$/) && req.method === 'DELETE') {
            const playlistId = pathname.split('/')[3];
            return await this.playlistController.deletePlaylist(req, res, playlistId);
        }

        // Get video qualities (GET) - MUST come before generic getVideo route
        if (pathname.match(/^\/api\/videos\/[^/]+\/qualities$/) && req.method === 'GET') {
            const videoId = pathname.split('/')[3];
            return await this.videoController.getVideoQualities(req, res, videoId);
        }

        // Trigger video transcoding (POST) - MUST come before generic video routes
        if (pathname.match(/^\/api\/videos\/[^/]+\/transcode$/) && req.method === 'POST') {
            const videoId = pathname.split('/')[3];
            return await this.videoController.transcodeVideo(req, res, videoId);
        }

        // Update video thumbnail (PUT) - MUST come before generic video routes
        if (pathname.match(/^\/api\/videos\/[^/]+\/thumbnail$/) && req.method === 'PUT') {
            const videoId = pathname.split('/')[3];
            return await this.videoController.updateVideoThumbnail(req, res, videoId);
        }

        // Like/Dislike video routes - MUST come before generic video routes
        // Get video like stats (GET /api/videos/:videoId/likes)
        if (pathname.match(/^\/api\/videos\/[^/]+\/likes$/) && req.method === 'GET') {
            const videoId = pathname.split('/')[3];
            return await this.videoLikeController.getLikeStats(req, res, videoId);
        }

        // Like/Dislike video (POST /api/videos/:videoId/like)
        if (pathname.match(/^\/api\/videos\/[^/]+\/like$/) && req.method === 'POST') {
            const videoId = pathname.split('/')[3];
            return await this.videoLikeController.likeVideo(req, res, videoId);
        }

        // Remove like/dislike (DELETE /api/videos/:videoId/like)
        if (pathname.match(/^\/api\/videos\/[^/]+\/like$/) && req.method === 'DELETE') {
            const videoId = pathname.split('/')[3];
            return await this.videoLikeController.removeLike(req, res, videoId);
        }

        // Increment video views (POST /api/videos/:videoId/views)
        if (pathname.match(/^\/api\/videos\/[^/]+\/views$/) && req.method === 'POST') {
            const videoId = pathname.split('/')[3];
            return await this.videoController.incrementVideoViews(req, res, videoId);
        }

        // Get video processing status (GET /api/videos/:videoId/processing-status)
        if (pathname.match(/^\/api\/videos\/[^/]+\/processing-status$/) && req.method === 'GET') {
            const videoId = pathname.split('/')[3];
            return await this.queueController.getVideoProcessingStatus(req, res, videoId);
        }

        // Get single video by ID (GET /api/videos/:id)
        if (pathname.startsWith('/api/videos/') && req.method === 'GET') {
            const videoId = pathname.split('/')[3];
            return await this.videoController.getVideo(req, res, videoId);
        }

        // Delete video (DELETE /api/videos/:id)
        if (pathname.startsWith('/api/videos/') && req.method === 'DELETE') {
            const videoId = pathname.split('/')[3];
            return await this.videoController.deleteVideo(req, res, videoId);
        }

        // Update video metadata (PATCH /api/videos/:id)
        if (pathname.match(/^\/api\/videos\/[^/]+$/) && req.method === 'PATCH') {
            const videoId = pathname.split('/')[3];
            return await this.videoController.updateVideoMetadata(req, res, videoId);
        }

        // Video streaming route
        if (pathname === '/video') {
            const fileName = queryParams.file;
            if (!fileName) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                return res.end('Missing ?file parameter');
            }
            return await this.streamController.streamVideo(req, res, fileName);
        }

        // Channel Routes
        if (pathname === '/api/channels' && req.method === 'POST') {
            return await this.channelController.createChannel(req, res);
        }

        if (pathname === '/api/channels' && req.method === 'GET') {
            return await this.channelController.getChannel(req, res, queryParams);
        }

        if (pathname === '/api/channels/list' && req.method === 'GET') {
            return await this.channelController.listChannels(req, res, queryParams);
        }

        if (pathname.match(/^\/api\/channels\/[^/]+$/) && req.method === 'PATCH') {
            const channelId = pathname.split('/')[3];
            return await this.channelController.updateChannel(req, res, channelId);
        }

        // Subscription Routes
        if (pathname === '/api/subscriptions' && req.method === 'POST') {
            return await this.subscriptionController.subscribe(req, res);
        }

        if (pathname === '/api/subscriptions' && req.method === 'GET') {
            return await this.subscriptionController.getSubscriptions(req, res, queryParams);
        }

        if (pathname.match(/^\/api\/subscriptions\/[^/]+$/) && req.method === 'DELETE') {
            const channelId = pathname.split('/')[3];
            return await this.subscriptionController.unsubscribe(req, res, channelId);
        }

        if (pathname.match(/^\/api\/subscriptions\/[^/]+\/status$/) && req.method === 'GET') {
            const channelId = pathname.split('/')[3];
            return await this.subscriptionController.checkStatus(req, res, channelId);
        }

        // Queue Routes
        if (pathname === '/api/queues/metrics' && req.method === 'GET') {
            return await this.queueController.getQueueMetrics(req, res);
        }

        if (pathname === '/api/queues/health' && req.method === 'GET') {
            return await this.queueController.getQueueHealth(req, res);
        }

        if (pathname.match(/^\/api\/queues\/[^/]+\/jobs\/[^/]+\/retry$/) && req.method === 'POST') {
            const [, , , queueName, , jobId] = pathname.split('/');
            return await this.queueController.retryJob(req, res, queueName, jobId);
        }

        // Comment Routes
        if (pathname === '/api/comments' && req.method === 'POST') {
            return await this.commentController.createComment(req, res);
        }

        if (pathname === '/api/comments' && req.method === 'GET') {
            return await this.commentController.getComments(req, res, urlObj.searchParams);
        }

        if (pathname.match(/^\/api\/comments\/[^/]+$/) && req.method === 'PATCH') {
            const commentId = pathname.split('/')[3];
            return await this.commentController.updateComment(req, res, commentId);
        }

        if (pathname.match(/^\/api\/comments\/[^/]+$/) && req.method === 'DELETE') {
            const commentId = pathname.split('/')[3];
            return await this.commentController.deleteComment(req, res, commentId);
        }

        // Not found
        return null; // Let the main server handle it
    }
}

module.exports = Router;

