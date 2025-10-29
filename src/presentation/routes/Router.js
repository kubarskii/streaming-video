// @ts-check
// Presentation: Router
// Routes HTTP requests to appropriate controllers

const { URL } = require('url');

class Router {
    constructor(videoController, streamController, authController, uploadController, channelController, subscriptionController, commentController) {
        this.videoController = videoController;
        this.streamController = streamController;
        this.authController = authController;
        this.uploadController = uploadController;
        this.channelController = channelController;
        this.subscriptionController = subscriptionController;
        this.commentController = commentController;
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

        // Upload Route
        if (pathname === '/api/upload' && req.method === 'POST') {
            return await this.uploadController.uploadVideo(req, res);
        }

        // Video API Routes
        if (pathname === '/api/videos' && req.method === 'GET') {
            return await this.videoController.listVideos(req, res, queryParams);
        }

        if (pathname.startsWith('/api/videos/') && req.method === 'GET') {
            const videoId = pathname.split('/')[3];
            return await this.videoController.getVideo(req, res, videoId);
        }

        if (pathname.startsWith('/api/videos/') && req.method === 'DELETE') {
            const videoId = pathname.split('/')[3];
            return await this.videoController.deleteVideo(req, res, videoId);
        }

        // Update video metadata (PATCH)
        if (pathname.match(/^\/api\/videos\/[^/]+$/) && req.method === 'PATCH') {
            const videoId = pathname.split('/')[3];
            return await this.videoController.updateVideoMetadata(req, res, videoId);
        }

        // Update video thumbnail (PUT)
        if (pathname.match(/^\/api\/videos\/[^/]+\/thumbnail$/) && req.method === 'PUT') {
            const videoId = pathname.split('/')[3];
            return await this.videoController.updateVideoThumbnail(req, res, videoId);
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

