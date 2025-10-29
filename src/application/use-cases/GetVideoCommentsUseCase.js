// @ts-check
// Application Layer: Get Video Comments Use Case
// Retrieves all comments for a video

/**
 * Use case for getting comments for a video
 */
class GetVideoCommentsUseCase {
    /**
     * Creates an instance of GetVideoCommentsUseCase
     * @param {import('../../domain/repositories/ICommentRepository')} commentRepository
     */
    constructor(commentRepository) {
        this.commentRepository = commentRepository;
    }

    /**
     * Execute the use case
     * @param {Object} input
     * @param {string} input.videoId - Video ID
     * @param {number} [input.limit=50] - Maximum comments to return
     * @param {number} [input.offset=0] - Offset for pagination
     * @returns {Promise<{comments: Array, total: number, hasMore: boolean}>}
     */
    async execute(input) {
        const { videoId, limit = 50, offset = 0 } = input;

        if (!videoId) {
            throw new Error('Video ID is required');
        }

        // Get comments
        const comments = await this.commentRepository.findByVideoId(videoId, {
            limit,
            offset
        });

        // Get total count
        const total = await this.commentRepository.countByVideoId(videoId);

        return {
            comments,
            total,
            hasMore: offset + comments.length < total
        };
    }
}

module.exports = GetVideoCommentsUseCase;

