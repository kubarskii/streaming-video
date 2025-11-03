// @ts-check
// Streaming Service Router
// Routes for video streaming, quality variants, views, likes, comments

const { URL } = require('url');

class StreamingServiceRouter {
    constructor(streamController, videoController, videoLikeController, subscriptionController, commentController) {
        this.streamController = streamController;
        this.videoController = videoController;
        this.videoLikeController = videoLikeController;
        this.subscriptionController = subscriptionController;
        this.commentController = commentController;
    }

    async route(req, res) {
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const pathname = urlObj.pathname;
        const queryParams = Object.fromEntries(urlObj.searchParams);

        // ============================================================
        // VIDEO STREAMING
        // ============================================================
        if (pathname === '/video') {
            const fileName = queryParams.file;
            if (!fileName) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Missing ?file parameter');
                return true;
            }
            await this.streamController.streamVideo(req, res, fileName);
            return true;
        }

        // ============================================================
        // QUALITY VARIANTS
        // ============================================================
        if (pathname.match(/^\/api\/videos\/[^/]+\/qualities$/) && req.method === 'GET') {
            const videoId = pathname.split('/')[3];
            await this.videoController.getVideoQualities(req, res, videoId);
            return true;
        }

        if (pathname.match(/^\/api\/videos\/[^/]+\/transcode$/) && req.method === 'POST') {
            const videoId = pathname.split('/')[3];
            await this.videoController.transcodeVideo(req, res, videoId);
            return true;
        }

        // ============================================================
        // VIEW COUNTING
        // ============================================================
        if (pathname.match(/^\/api\/videos\/[^/]+\/views$/) && req.method === 'POST') {
            const videoId = pathname.split('/')[3];
            await this.videoController.incrementVideoViews(req, res, videoId);
            return true;
        }

        // ============================================================
        // VIDEO LIKES/DISLIKES
        // ============================================================
        if (pathname.match(/^\/api\/videos\/[^/]+\/likes$/) && req.method === 'GET') {
            const videoId = pathname.split('/')[3];
            await this.videoLikeController.getLikeStats(req, res, videoId);
            return true;
        }

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

        // ============================================================
        // SUBSCRIPTIONS
        // ============================================================
        if (pathname === '/api/subscriptions' && req.method === 'POST') {
            await this.subscriptionController.subscribe(req, res);
            return true;
        }

        if (pathname === '/api/subscriptions' && req.method === 'GET') {
            await this.subscriptionController.getSubscriptions(req, res, queryParams);
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
        // COMMENTS
        // ============================================================
        if (pathname === '/api/comments' && req.method === 'POST') {
            await this.commentController.createComment(req, res);
            return true;
        }

        if (pathname === '/api/comments' && req.method === 'GET') {
            await this.commentController.getComments(req, res, urlObj.searchParams);
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

module.exports = StreamingServiceRouter;

