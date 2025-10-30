// @ts-check
// Application Layer: Increment Video Views Use Case
// Increments view count when a video is watched

/**
 * Use case for incrementing video views
 */
class IncrementVideoViewsUseCase {
    /**
     * Creates an instance of IncrementVideoViewsUseCase.
     * @param {import('../../domain/repositories/IVideoRepository')} videoRepository - Repository for video persistence
     */
    constructor(videoRepository) {
        this.videoRepository = videoRepository;
    }

    /**
     * Increment views for a video
     * @param {string} videoId - Video ID
     * @returns {Promise<number>} Updated view count
     */
    async execute(videoId) {
        if (!videoId) {
            throw new Error('Video ID is required');
        }

        try {
            // Get the video
            const video = await this.videoRepository.findById(videoId);

            if (!video) {
                throw new Error('Video not found');
            }

            // Increment views in the database directly for performance
            // This avoids loading and saving the entire video entity
            const views = await this.videoRepository.incrementViews(videoId);

            return views;
        } catch (error) {
            console.error('Error incrementing video views:', error);
            throw error;
        }
    }
}

module.exports = IncrementVideoViewsUseCase;

