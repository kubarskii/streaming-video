// Application: UpdateVideoMetadataUseCase
// Updates video title and description

class UpdateVideoMetadataUseCase {
    constructor(videoRepository) {
        this.videoRepository = videoRepository;
    }

    async execute(videoId, userId, { title, description }) {
        // Retrieve the video
        const video = await this.videoRepository.findById(videoId);

        if (!video) {
            throw new Error('Video not found');
        }

        // Verify ownership
        if (video.userId !== userId) {
            throw new Error('Unauthorized: You can only edit your own videos');
        }

        // Update metadata
        if (title !== undefined) {
            video.title = title;
        }
        if (description !== undefined) {
            video.description = description;
        }
        video.updatedAt = new Date();

        // Save and return
        const updatedVideo = await this.videoRepository.update(video);
        return updatedVideo;
    }
}

module.exports = UpdateVideoMetadataUseCase;

