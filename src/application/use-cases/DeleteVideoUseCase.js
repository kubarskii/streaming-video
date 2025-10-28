// Application: DeleteVideoUseCase
// Use case for deleting a video

class DeleteVideoUseCase {
    constructor(videoRepository, storageRepository) {
        this.videoRepository = videoRepository;
        this.storageRepository = storageRepository;
    }

    /**
     * Execute the delete video use case
     * @param {string} videoId - Video ID
     * @returns {Promise<boolean>}
     */
    async execute(videoId) {
        if (!videoId) {
            throw new Error('Video ID is required');
        }

        // Get video from database
        const video = await this.videoRepository.findById(videoId);

        if (!video) {
            throw new Error('Video not found');
        }

        // Delete video file from storage
        await this.storageRepository.delete(video.storageKey);

        // Delete thumbnail from storage (if exists)
        if (video.thumbnailUrl) {
            // Extract thumbnail key from URL
            const thumbnailKey = `thumb_${videoId}.jpg`;
            try {
                await this.storageRepository.delete(thumbnailKey);
                console.log(`Deleted thumbnail: ${thumbnailKey}`);
            } catch (error) {
                console.error(`Failed to delete thumbnail ${thumbnailKey}:`, error.message);
            }
        }

        // Delete from database
        const deleted = await this.videoRepository.deleteById(videoId);

        return deleted;
    }
}

module.exports = DeleteVideoUseCase;

