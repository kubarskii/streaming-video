// @ts-check
// Repository Interface: ICommentRepository
// Defines the contract for comment data access

/**
 * @typedef {import('../entities/Comment')} Comment
 */

/**
 * Comment repository interface
 */
class ICommentRepository {
    /**
     * Save a comment entity
     * @param {Comment} comment - Comment entity to save
     * @returns {Promise<Comment>}
     */
    async save(comment) {
        throw new Error('Method not implemented');
    }

    /**
     * Find a comment by ID
     * @param {string} id - Comment ID
     * @returns {Promise<Comment|null>}
     */
    async findById(id) {
        throw new Error('Method not implemented');
    }

    /**
     * Find all comments for a video
     * @param {string} videoId - Video ID
     * @param {Object} options - Query options (limit, offset)
     * @returns {Promise<Comment[]>}
     */
    async findByVideoId(videoId, options = {}) {
        throw new Error('Method not implemented');
    }

    /**
     * Find all comments by a user
     * @param {string} userId - User ID
     * @param {Object} options - Query options (limit, offset)
     * @returns {Promise<Comment[]>}
     */
    async findByUserId(userId, options = {}) {
        throw new Error('Method not implemented');
    }

    /**
     * Update a comment
     * @param {Comment} comment - Comment entity to update
     * @returns {Promise<Comment>}
     */
    async update(comment) {
        throw new Error('Method not implemented');
    }

    /**
     * Delete a comment by ID
     * @param {string} id - Comment ID
     * @returns {Promise<boolean>}
     */
    async deleteById(id) {
        throw new Error('Method not implemented');
    }

    /**
     * Count comments for a video
     * @param {string} videoId - Video ID
     * @returns {Promise<number>}
     */
    async countByVideoId(videoId) {
        throw new Error('Method not implemented');
    }
}

module.exports = ICommentRepository;

