// @ts-check
// Application Layer: Update Comment Use Case
// Handles updating an existing comment

/**
 * Use case for updating a comment
 */
class UpdateCommentUseCase {
    /**
     * Creates an instance of UpdateCommentUseCase
     * @param {import('../../domain/repositories/ICommentRepository')} commentRepository
     */
    constructor(commentRepository) {
        this.commentRepository = commentRepository;
    }

    /**
     * Execute the use case
     * @param {Object} input
     * @param {string} input.commentId - Comment ID
     * @param {string} input.userId - User ID (for authorization)
     * @param {string} input.content - New comment content
     * @returns {Promise<Comment>}
     */
    async execute(input) {
        const { commentId, userId, content } = input;

        // Validate input
        if (!commentId) {
            throw new Error('Comment ID is required');
        }
        if (!userId) {
            throw new Error('User ID is required');
        }
        if (!content || content.trim().length === 0) {
            throw new Error('Comment content is required');
        }

        // Get existing comment
        const comment = await this.commentRepository.findById(commentId);
        if (!comment) {
            throw new Error('Comment not found');
        }

        // Check authorization
        if (comment.userId !== userId) {
            throw new Error('Unauthorized: You can only edit your own comments');
        }

        // Update comment content
        comment.content = content.trim();
        comment.updatedAt = new Date();

        // Save updated comment
        const updatedComment = await this.commentRepository.update(comment);

        return updatedComment;
    }
}

module.exports = UpdateCommentUseCase;

