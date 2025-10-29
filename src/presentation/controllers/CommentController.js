// @ts-check
// Presentation: CommentController
// Handles HTTP requests for comment operations

/**
 * Controller for comment operations
 */
class CommentController {
    /**
     * Creates a CommentController instance
     * @param {import('../../application/use-cases/CreateCommentUseCase')} createCommentUseCase
     * @param {import('../../application/use-cases/GetVideoCommentsUseCase')} getVideoCommentsUseCase
     * @param {import('../../application/use-cases/UpdateCommentUseCase')} updateCommentUseCase
     * @param {import('../../application/use-cases/DeleteCommentUseCase')} deleteCommentUseCase
     */
    constructor(createCommentUseCase, getVideoCommentsUseCase, updateCommentUseCase, deleteCommentUseCase) {
        this.createCommentUseCase = createCommentUseCase;
        this.getVideoCommentsUseCase = getVideoCommentsUseCase;
        this.updateCommentUseCase = updateCommentUseCase;
        this.deleteCommentUseCase = deleteCommentUseCase;
    }

    /**
     * Create a new comment
     * POST /api/comments
     */
    async createComment(req, res) {
        try {
            if (!req.user) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Not authenticated' }));
            }

            const body = await this.parseJSON(req);
            const { videoId, content } = body;

            const comment = await this.createCommentUseCase.execute({
                videoId,
                userId: req.user.id,
                content
            });

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ comment }));
        } catch (error) {
            console.error('Error creating comment:', error);
            const statusCode = error.message.includes('not found') ? 404 : 400;
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    /**
     * Get comments for a video
     * GET /api/comments?videoId=xxx&limit=50&offset=0
     */
    async getComments(req, res, queryParams) {
        try {
            const videoId = queryParams.get('videoId');
            const limit = parseInt(queryParams.get('limit') || '50', 10);
            const offset = parseInt(queryParams.get('offset') || '0', 10);

            if (!videoId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Video ID is required' }));
            }

            const result = await this.getVideoCommentsUseCase.execute({
                videoId,
                limit,
                offset
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (error) {
            console.error('Error getting comments:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    /**
     * Update a comment
     * PATCH /api/comments/:commentId
     */
    async updateComment(req, res, commentId) {
        try {
            if (!req.user) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Not authenticated' }));
            }

            const body = await this.parseJSON(req);
            const { content } = body;

            const comment = await this.updateCommentUseCase.execute({
                commentId,
                userId: req.user.id,
                content
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ comment }));
        } catch (error) {
            console.error('Error updating comment:', error);
            const statusCode = error.message.includes('Unauthorized') ? 403 :
                error.message.includes('not found') ? 404 : 400;
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    /**
     * Delete a comment
     * DELETE /api/comments/:commentId
     */
    async deleteComment(req, res, commentId) {
        try {
            if (!req.user) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Not authenticated' }));
            }

            const deleted = await this.deleteCommentUseCase.execute({
                commentId,
                userId: req.user.id
            });

            if (deleted) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to delete comment' }));
            }
        } catch (error) {
            console.error('Error deleting comment:', error);
            const statusCode = error.message.includes('Unauthorized') ? 403 :
                error.message.includes('not found') ? 404 : 400;
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
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

module.exports = CommentController;

