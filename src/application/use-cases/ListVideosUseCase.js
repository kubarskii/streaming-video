// @ts-check
// Application: ListVideosUseCase
// Use case for listing videos

/**
 * @typedef {import('../../domain/entities/Video')} Video
 */

class ListVideosUseCase {
    constructor(videoRepository) {
        this.videoRepository = videoRepository;
    }

    /**
     * Execute the list videos use case
     * @param {Object} [options] - Query options
     * @param {number} [options.limit] - Max number of results (default: 50)
     * @param {number} [options.offset] - Offset for pagination (default: 0)
     * @param {string} [options.status] - Filter by status
     * @param {string} [options.userId] - Filter by user ID
     * @param {string} [options.search] - Search query for video title, description, and channel name
     * @param {string} [options.orderBy] - Order by field (default: 'uploadedAt')
     * @param {string} [options.order] - Order direction: 'asc' or 'desc' (default: 'desc')
     * @returns {Promise<{videos: Video[], total: number, limit: number, offset: number, hasMore: boolean}>}
     */
    async execute(options = {}) {
        const {
            limit = 50,
            offset = 0,
            status,
            userId,
            search,
            orderBy = 'uploadedAt',
            order = 'desc'
        } = options;

        // Get videos
        const videos = await this.videoRepository.findAll({
            limit,
            offset,
            status,
            userId,
            search,
            orderBy,
            order,
        });

        // Get total count
        const total = await this.videoRepository.count({ status, userId, search });

        return {
            videos,
            total,
            limit,
            offset,
            hasMore: offset + videos.length < total,
        };
    }
}

module.exports = ListVideosUseCase;

