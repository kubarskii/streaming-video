// @ts-check
// Application: UpdateVideoMetadataUseCase
// Updates video title and description

const ContentSanitizer = require('../../infrastructure/security/ContentSanitizer');

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

        // Update metadata with sanitization
        if (title !== undefined) {
            const sanitizedTitle = ContentSanitizer.sanitizeTitle(title, 'title');
            if (!sanitizedTitle || sanitizedTitle.length === 0) {
                throw new Error('Title cannot be empty');
            }
            video.title = sanitizedTitle;
        }
        if (description !== undefined) {
            video.description = ContentSanitizer.sanitizeDescription(description, 'description');
        }
        video.updatedAt = new Date();

        // Save and return
        const updatedVideo = await this.videoRepository.update(video);
        return updatedVideo;
    }
}

module.exports = UpdateVideoMetadataUseCase;

