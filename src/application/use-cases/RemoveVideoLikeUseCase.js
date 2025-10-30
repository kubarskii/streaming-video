// @ts-check
// Application Layer: Remove Video Like Use Case
// Handles removing a like/dislike from a video

/**
 * Use case for removing a like/dislike from a video
 */
class RemoveVideoLikeUseCase {
    /**
     * Creates an instance of RemoveVideoLikeUseCase
     * @param {import('../../domain/repositories/IVideoLikeRepository')} videoLikeRepository
     */
    constructor(videoLikeRepository) {
        this.videoLikeRepository = videoLikeRepository;
    }

    /**
     * Execute the use case
     * @param {Object} input
     * @param {string} input.videoId - Video ID
     * @param {string} input.userId - User ID
     * @returns {Promise<boolean>}
     */
    async execute(input) {
        const { videoId, userId } = input;

        // Validate input
        if (!videoId) {
            throw new Error('Video ID is required');
        }
        if (!userId) {
            throw new Error('User ID is required');
        }

        // Delete the like/dislike
        return await this.videoLikeRepository.deleteByUserAndVideo(userId, videoId);
    }
}

module.exports = RemoveVideoLikeUseCase;

