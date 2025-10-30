// @ts-check
// Presentation: VideoLikeController
// Handles HTTP requests for video like/dislike operations

/**
 * Controller for video like operations
 */
class VideoLikeController {
    /**
     * Creates a VideoLikeController instance
     * @param {import('../../application/use-cases/LikeVideoUseCase')} likeVideoUseCase
     * @param {import('../../application/use-cases/GetVideoLikeStatsUseCase')} getVideoLikeStatsUseCase
     * @param {import('../../application/use-cases/RemoveVideoLikeUseCase')} removeVideoLikeUseCase
     */
    constructor(likeVideoUseCase, getVideoLikeStatsUseCase, removeVideoLikeUseCase) {
        this.likeVideoUseCase = likeVideoUseCase;
        this.getVideoLikeStatsUseCase = getVideoLikeStatsUseCase;
        this.removeVideoLikeUseCase = removeVideoLikeUseCase;
    }

    /**
     * Like or dislike a video
     * POST /api/videos/:videoId/like
     * Body: { isLike: true|false }
     */
    async likeVideo(req, res, videoId) {
        try {
            if (!req.user) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Not authenticated' }));
            }

            const body = await this.parseJSON(req);
            const { isLike } = body;

            if (typeof isLike !== 'boolean') {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'isLike must be a boolean' }));
            }

            const videoLike = await this.likeVideoUseCase.execute({
                videoId,
                userId: req.user.id,
                isLike
            });

            // Get updated stats
            const stats = await this.getVideoLikeStatsUseCase.execute({
                videoId,
                userId: req.user.id
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                videoLike,
                stats
            }));
        } catch (error) {
            console.error('Error liking video:', error);
            const statusCode = error.message.includes('not found') ? 404 : 400;
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    /**
     * Get like statistics for a video
     * GET /api/videos/:videoId/likes
     */
    async getLikeStats(req, res, videoId) {
        try {
            const userId = req.user ? req.user.id : null;

            const stats = await this.getVideoLikeStatsUseCase.execute({
                videoId,
                userId
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(stats));
        } catch (error) {
            console.error('Error getting like stats:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    /**
     * Remove a like/dislike from a video
     * DELETE /api/videos/:videoId/like
     */
    async removeLike(req, res, videoId) {
        try {
            if (!req.user) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Not authenticated' }));
            }

            const deleted = await this.removeVideoLikeUseCase.execute({
                videoId,
                userId: req.user.id
            });

            // Get updated stats
            const stats = await this.getVideoLikeStatsUseCase.execute({
                videoId,
                userId: req.user.id
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: deleted,
                stats
            }));
        } catch (error) {
            console.error('Error removing like:', error);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    /**
     * Parse JSON body from request
     * @param {import('http').IncomingMessage} req
     * @returns {Promise<any>}
     */
    parseJSON(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (error) {
                    reject(new Error('Invalid JSON'));
                }
            });
            req.on('error', reject);
        });
    }
}

module.exports = VideoLikeController;

