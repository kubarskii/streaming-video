// @ts-check
// Domain: IVideoQualityRepository
// Interface for video quality persistence operations

class IVideoQualityRepository {
    /**
     * Save a video quality variant
     * @param {Object} quality - Quality data to save
     * @returns {Promise<Object>}
     */
    async save(quality) {
        throw new Error('Method not implemented');
    }

    /**
     * Find a quality variant by ID
     * @param {string} id - Quality ID
     * @returns {Promise<Object|null>}
     */
    async findById(id) {
        throw new Error('Method not implemented');
    }

    /**
     * Find all quality variants for a video
     * @param {string} videoId - Video ID
     * @returns {Promise<Array<Object>>}
     */
    async findByVideoId(videoId) {
        throw new Error('Method not implemented');
    }

    /**
     * Find a specific quality variant for a video
     * @param {string} videoId - Video ID
     * @param {string} quality - Quality level (e.g., "720p")
     * @returns {Promise<Object|null>}
     */
    async findByVideoIdAndQuality(videoId, quality) {
        throw new Error('Method not implemented');
    }

    /**
     * Find quality by storage key
     * @param {string} storageKey - Storage key
     * @returns {Promise<Object|null>}
     */
    async findByStorageKey(storageKey) {
        throw new Error('Method not implemented');
    }

    /**
     * Update a quality variant
     * @param {string} id - Quality ID
     * @param {Object} data - Data to update
     * @returns {Promise<Object>}
     */
    async update(id, data) {
        throw new Error('Method not implemented');
    }

    /**
     * Delete a quality variant
     * @param {string} id - Quality ID
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        throw new Error('Method not implemented');
    }

    /**
     * Delete all quality variants for a video
     * @param {string} videoId - Video ID
     * @returns {Promise<number>} Number of deleted qualities
     */
    async deleteByVideoId(videoId) {
        throw new Error('Method not implemented');
    }
}

module.exports = IVideoQualityRepository;


