// @ts-check
// Repository Interface: IVideoLikeRepository
// Defines the contract for video like data access

/**
 * @typedef {import('../entities/VideoLike')} VideoLike
 */

/**
 * VideoLike repository interface
 */
class IVideoLikeRepository {
    /**
     * Save a video like entity
     * @param {VideoLike} videoLike - VideoLike entity to save
     * @returns {Promise<VideoLike>}
     */
    async save(videoLike) {
        throw new Error('Method not implemented');
    }

    /**
     * Find a like by user and video
     * @param {string} userId - User ID
     * @param {string} videoId - Video ID
     * @returns {Promise<VideoLike|null>}
     */
    async findByUserAndVideo(userId, videoId) {
        throw new Error('Method not implemented');
    }

    /**
     * Update a video like
     * @param {VideoLike} videoLike - VideoLike entity to update
     * @returns {Promise<VideoLike>}
     */
    async update(videoLike) {
        throw new Error('Method not implemented');
    }

    /**
     * Delete a like by user and video
     * @param {string} userId - User ID
     * @param {string} videoId - Video ID
     * @returns {Promise<boolean>}
     */
    async deleteByUserAndVideo(userId, videoId) {
        throw new Error('Method not implemented');
    }

    /**
     * Count likes for a video
     * @param {string} videoId - Video ID
     * @returns {Promise<number>}
     */
    async countLikesByVideoId(videoId) {
        throw new Error('Method not implemented');
    }

    /**
     * Count dislikes for a video
     * @param {string} videoId - Video ID
     * @returns {Promise<number>}
     */
    async countDislikesByVideoId(videoId) {
        throw new Error('Method not implemented');
    }

    /**
     * Get like stats for a video
     * @param {string} videoId - Video ID
     * @returns {Promise<{likes: number, dislikes: number}>}
     */
    async getVideoLikeStats(videoId) {
        throw new Error('Method not implemented');
    }
}

module.exports = IVideoLikeRepository;

