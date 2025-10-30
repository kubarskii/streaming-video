// @ts-check
// Application Layer: Get Video Like Stats Use Case
// Retrieves like/dislike counts for a video

/**
 * Use case for getting video like statistics
 */
class GetVideoLikeStatsUseCase {
    /**
     * Creates an instance of GetVideoLikeStatsUseCase
     * @param {import('../../domain/repositories/IVideoLikeRepository')} videoLikeRepository
     */
    constructor(videoLikeRepository) {
        this.videoLikeRepository = videoLikeRepository;
    }

    /**
     * Execute the use case
     * @param {Object} input
     * @param {string} input.videoId - Video ID
     * @param {string} [input.userId] - Optional user ID to check if user liked/disliked
     * @returns {Promise<{likes: number, dislikes: number, userLike: boolean|null}>}
     */
    async execute(input) {
        const { videoId, userId } = input;

        // Validate input
        if (!videoId) {
            throw new Error('Video ID is required');
        }

        // Get like stats
        const stats = await this.videoLikeRepository.getVideoLikeStats(videoId);

        // Check if user has liked/disliked
        let userLike = null;
        if (userId) {
            const userLikeRecord = await this.videoLikeRepository.findByUserAndVideo(userId, videoId);
            if (userLikeRecord) {
                userLike = userLikeRecord.isLike;
            }
        }

        return {
            likes: stats.likes,
            dislikes: stats.dislikes,
            userLike
        };
    }
}

module.exports = GetVideoLikeStatsUseCase;

