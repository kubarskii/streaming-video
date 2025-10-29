// @ts-check
// Application: GetVideoQualitiesUseCase
// Use case for retrieving available quality variants for a video

class GetVideoQualitiesUseCase {
    /**
     * @param {import('../../domain/repositories/IVideoQualityRepository')} videoQualityRepository
     */
    constructor(videoQualityRepository) {
        this.videoQualityRepository = videoQualityRepository;
    }

    /**
     * Execute - get all available qualities for a video
     * @param {string} videoId - Video ID
     * @returns {Promise<Array<Object>>} Array of quality variants
     */
    async execute(videoId) {
        const qualities = await this.videoQualityRepository.findByVideoId(videoId);

        // Filter only ready qualities and sort by height
        const readyQualities = qualities
            .filter(q => q.status === 'ready')
            .sort((a, b) => a.height - b.height);

        // Format for frontend consumption
        return readyQualities.map(q => ({
            id: q.id,
            quality: q.quality,
            label: this.getQualityLabel(q.quality),
            storageKey: q.storageKey,
            width: q.width,
            height: q.height,
            sizeBytes: q.sizeBytes,
            bitrate: q.bitrate
        }));
    }

    /**
     * Get a user-friendly label for a quality
     * @param {string} quality - Quality identifier (e.g., "720p", "1080p")
     * @returns {string}
     */
    getQualityLabel(quality) {
        // Simply uppercase the quality label (360p -> 360P, 1080p -> 1080P)
        return quality.toUpperCase();
    }
}

module.exports = GetVideoQualitiesUseCase;


