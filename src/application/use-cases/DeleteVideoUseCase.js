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

        // Track deletion errors but don't fail the entire operation
        const errors = [];

        // 1. Delete video file from storage FIRST
        try {
            console.log(`Deleting video file from storage: ${video.storageKey}`);
            await this.storageRepository.delete(video.storageKey);
        } catch (error) {
            console.error(`Failed to delete video file ${video.storageKey}:`, error.message);
            errors.push(`Video file: ${error.message}`);
            // Don't throw - continue with database deletion even if storage fails
        }

        // 2. Delete thumbnail from storage (if exists)
        if (video.thumbnailUrl) {
            // Extract thumbnail key from URL
            const thumbnailKey = `thumb_${videoId}.jpg`;
            try {
                console.log(`Deleting thumbnail from storage: ${thumbnailKey}`);
                await this.storageRepository.delete(thumbnailKey);
            } catch (error) {
                console.error(`Failed to delete thumbnail ${thumbnailKey}:`, error.message);
                errors.push(`Thumbnail: ${error.message}`);
                // Don't throw - continue with database deletion
            }
        }

        // 3. Delete from database (always attempt this)
        try {
            const deleted = await this.videoRepository.deleteById(videoId);

            if (!deleted) {
                throw new Error('Failed to delete video from database');
            }

            // If there were storage errors, log warning
            if (errors.length > 0) {
                console.warn(`Video ${videoId} deleted from database, but storage deletion had errors:`, errors.join(', '));
            } else {
                console.log(`Video ${videoId} successfully deleted from storage and database`);
            }

            return true;
        } catch (error) {
            console.error(`Failed to delete video from database:`, error.message);
            throw new Error(`Database deletion failed: ${error.message}`);
        }
    }
}

module.exports = DeleteVideoUseCase;

