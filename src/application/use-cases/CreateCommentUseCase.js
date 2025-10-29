// @ts-check
// Application Layer: Create Comment Use Case
// Handles creating a new comment on a video

const Comment = require('../../domain/entities/Comment');
const { randomUUID } = require('crypto');

/**
 * Use case for creating a comment
 */
class CreateCommentUseCase {
    /**
     * Creates an instance of CreateCommentUseCase
     * @param {import('../../domain/repositories/ICommentRepository')} commentRepository
     * @param {import('../../domain/repositories/IVideoRepository')} videoRepository
     */
    constructor(commentRepository, videoRepository) {
        this.commentRepository = commentRepository;
        this.videoRepository = videoRepository;
    }

    /**
     * Execute the use case
     * @param {Object} input
     * @param {string} input.videoId - Video ID
     * @param {string} input.userId - User ID
     * @param {string} input.content - Comment content
     * @returns {Promise<Comment>}
     */
    async execute(input) {
        const { videoId, userId, content } = input;

        // Validate input
        if (!videoId) {
            throw new Error('Video ID is required');
        }
        if (!userId) {
            throw new Error('User ID is required');
        }
        if (!content || content.trim().length === 0) {
            throw new Error('Comment content is required');
        }

        // Verify video exists
        const video = await this.videoRepository.findById(videoId);
        if (!video) {
            throw new Error('Video not found');
        }

        // Create comment entity
        const comment = new Comment({
            id: randomUUID(),
            videoId,
            userId,
            content: content.trim(),
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Save comment
        const savedComment = await this.commentRepository.save(comment);

        return savedComment;
    }
}

module.exports = CreateCommentUseCase;

