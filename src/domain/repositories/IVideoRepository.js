// @ts-check
// Repository Interface: IVideoRepository
// Defines the contract for video data access

/**
 * @typedef {import('../entities/Video')} Video
 */

class IVideoRepository {
    /**
     * Save a video entity
     * @param {Video} video - Video entity to save
     * @returns {Promise<Video>}
     */
    async save(video) {
        throw new Error('Method not implemented');
    }

    /**
     * Find a video by ID
     * @param {string} id - Video ID
     * @returns {Promise<Video|null>}
     */
    async findById(id) {
        throw new Error('Method not implemented');
    }

    /**
     * Find a video by storage key
     * @param {string} storageKey - Storage key
     * @returns {Promise<Video|null>}
     */
    async findByStorageKey(storageKey) {
        throw new Error('Method not implemented');
    }

    /**
     * Find a video by file name
     * @param {string} fileName - File name
     * @returns {Promise<Video|null>}
     */
    async findByFileName(fileName) {
        throw new Error('Method not implemented');
    }

    /**
     * Find all videos
     * @param {Object} options - Query options (limit, offset, status, userId)
     * @returns {Promise<Video[]>}
     */
    async findAll(options = {}) {
        throw new Error('Method not implemented');
    }

    /**
     * Update a video
     * @param {Video} video - Video entity to update
     * @returns {Promise<Video>}
     */
    async update(video) {
        throw new Error('Method not implemented');
    }

    /**
     * Delete a video by ID
     * @param {string} id - Video ID
     * @returns {Promise<boolean>}
     */
    async deleteById(id) {
        throw new Error('Method not implemented');
    }

    /**
     * Count videos
     * @param {Object} filter - Filter options
     * @returns {Promise<number>}
     */
    async count(filter = {}) {
        throw new Error('Method not implemented');
    }
}

module.exports = IVideoRepository;

