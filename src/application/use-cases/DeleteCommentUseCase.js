// @ts-check
// Application Layer: Delete Comment Use Case
// Handles deleting a comment

/**
 * Use case for deleting a comment
 */
class DeleteCommentUseCase {
    /**
     * Creates an instance of DeleteCommentUseCase
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
     * @returns {Promise<boolean>}
     */
    async execute(input) {
        const { commentId, userId } = input;

        // Validate input
        if (!commentId) {
            throw new Error('Comment ID is required');
        }
        if (!userId) {
            throw new Error('User ID is required');
        }

        // Get existing comment
        const comment = await this.commentRepository.findById(commentId);
        if (!comment) {
            throw new Error('Comment not found');
        }

        // Check authorization
        if (comment.userId !== userId) {
            throw new Error('Unauthorized: You can only delete your own comments');
        }

        // Delete comment
        const deleted = await this.commentRepository.deleteById(commentId);

        return deleted;
    }
}

module.exports = DeleteCommentUseCase;

