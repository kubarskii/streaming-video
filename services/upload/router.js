// @ts-check
// Upload Service Router
// Routes for upload, auth, and video management

const { URL } = require('url');

class UploadServiceRouter {
    constructor(videoController, authController, uploadController, chunkUploadController, channelController, playlistController, queueController) {
        this.videoController = videoController;
        this.authController = authController;
        this.uploadController = uploadController;
        this.chunkUploadController = chunkUploadController;
        this.channelController = channelController;
        this.playlistController = playlistController;
        this.queueController = queueController;
    }

    async route(req, res) {
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const pathname = urlObj.pathname;
        const queryParams = Object.fromEntries(urlObj.searchParams);

        // ============================================================
        // AUTH ROUTES
        // ============================================================
        if (pathname === '/api/auth/register' && req.method === 'POST') {
            await this.authController.register(req, res);
            return true;
        }

        if (pathname === '/api/auth/login' && req.method === 'POST') {
            await this.authController.login(req, res);
            return true;
        }

        if (pathname === '/api/auth/logout' && req.method === 'POST') {
            await this.authController.logout(req, res);
            return true;
        }

        if (pathname === '/api/auth/me' && req.method === 'GET') {
            await this.authController.me(req, res);
            return true;
        }

        // ============================================================
        // UPLOAD ROUTES
        // ============================================================
        if (pathname === '/api/upload' && req.method === 'POST') {
            await this.uploadController.uploadVideo(req, res);
            return true;
        }

        // Chunked Upload Routes
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
        // VIDEO METADATA ROUTES (No streaming)
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
        // CHANNEL ROUTES
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
        // PLAYLIST ROUTES
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
        // QUEUE ROUTES
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

