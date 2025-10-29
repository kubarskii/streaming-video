// @ts-check
// Application: UpdateVideoThumbnailUseCase
// Updates video thumbnail

const fs = require('fs');
const path = require('path');

class UpdateVideoThumbnailUseCase {
    constructor(videoRepository, storageRepository) {
        this.videoRepository = videoRepository;
        this.storageRepository = storageRepository;
    }

    async execute(videoId, userId, thumbnailPath, thumbnailMimeType) {
        // Retrieve the video
        const video = await this.videoRepository.findById(videoId);

        if (!video) {
            throw new Error('Video not found');
        }

        // Verify ownership
        if (video.userId !== userId) {
            throw new Error('Unauthorized: You can only edit your own videos');
        }

        // Delete old thumbnail if it exists
        if (video.thumbnailUrl) {
            try {
                const oldThumbnailKey = this.extractStorageKeyFromUrl(video.thumbnailUrl);
                if (oldThumbnailKey) {
                    await this.storageRepository.delete(oldThumbnailKey);
                }
            } catch (error) {
                console.warn('Failed to delete old thumbnail:', error);
            }
        }

        // Upload new thumbnail
        const thumbnailExt = path.extname(thumbnailPath);
        const thumbnailFileName = `thumb_${videoId}_${Date.now()}${thumbnailExt}`;

        // Upload the thumbnail file
        const uploadResult = await this.storageRepository.upload(
            thumbnailPath,
            thumbnailFileName,
            {
                contentType: thumbnailMimeType || 'image/jpeg',
                originalName: `thumbnail${thumbnailExt}`
            }
        );

        const thumbnailUrl = uploadResult.cdnUrl || uploadResult.storageUrl;

        // Update video
        video.thumbnailUrl = thumbnailUrl;
        video.updatedAt = new Date();

        // Save and return
        const updatedVideo = await this.videoRepository.update(video);
        return updatedVideo;
    }

    extractStorageKeyFromUrl(url) {
        // Extract storage key from URL
        // For local storage: /video?file=filename.jpg -> filename.jpg
        // For B2: https://cdn.example.com/filename.jpg -> filename.jpg
        if (url.includes('?file=')) {
            const urlObj = new URL(url);
            return urlObj.searchParams.get('file');
        } else {
            // Extract filename from URL path
            return path.basename(new URL(url).pathname);
        }
    }
}

module.exports = UpdateVideoThumbnailUseCase;

