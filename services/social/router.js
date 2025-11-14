// @ts-check
// Social Service Router
// Handles likes, comments, and subscriptions
// Authentication is handled by Gateway

const { URL } = require('url');

class SocialServiceRouter {
    constructor(videoLikeController, subscriptionController, commentController) {
        this.videoLikeController = videoLikeController;
        this.subscriptionController = subscriptionController;
        this.commentController = commentController;
    }

    async route(req, res) {
        // Parse URL with error handling
        let urlObj, pathname, queryParams;
        try {
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
            res.end(JSON.stringify({ 
                success: false,
                error: { 
                    message: 'Invalid URL',
                    code: 'INVALID_URL'
                }
            }));
            return false;
        }

        // ============================================================
        // LIKES ROUTES
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
            console.log(`[Social Router] GET /api/videos/${videoId}/likes`);
            await this.videoLikeController.getLikeStats(req, res, videoId);
            return true;
        }

        // ============================================================
        // SUBSCRIPTION ROUTES
        // ============================================================

        if (pathname === '/api/subscriptions' && req.method === 'GET') {
            await this.subscriptionController.getSubscriptions(req, res, queryParams);
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
        // COMMENT ROUTES
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

module.exports = SocialServiceRouter;

