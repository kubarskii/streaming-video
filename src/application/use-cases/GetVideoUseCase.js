// Application: GetVideoUseCase
// Use case for getting a video by ID

class GetVideoUseCase {
    constructor(videoRepository) {
        this.videoRepository = videoRepository;
    }

    /**
     * Execute the get video use case
     * @param {string} videoId - Video ID
     * @returns {Promise<Video|null>}
     */
    async execute(videoId) {
        if (!videoId) {
            throw new Error('Video ID is required');
        }

        const video = await this.videoRepository.findById(videoId);

        if (!video) {
            return null;
        }

        return video;
    }

    /**
     * Get video by file name
     * @param {string} fileName - File name
     * @returns {Promise<Video|null>}
     */
    async executeByFileName(fileName) {
        if (!fileName) {
            throw new Error('File name is required');
        }

        const video = await this.videoRepository.findByFileName(fileName);

        if (!video) {
            return null;
        }

        return video;
    }

    /**
     * Get video by storage key
     * @param {string} storageKey - Storage key
     * @returns {Promise<Video|null>}
     */
    async executeByStorageKey(storageKey) {
        if (!storageKey) {
            throw new Error('Storage key is required');
        }

        const video = await this.videoRepository.findByStorageKey(storageKey);

        if (!video) {
            return null;
        }

        return video;
    }
}

module.exports = GetVideoUseCase;

