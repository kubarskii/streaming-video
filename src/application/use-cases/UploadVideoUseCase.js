// Application: UploadVideoUseCase
// Use case for uploading a video

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const Video = require('../../domain/entities/Video');
const VideoStatus = require('../../domain/value-objects/VideoStatus');

class UploadVideoUseCase {
    constructor(videoRepository, storageRepository, thumbnailGenerator) {
        this.videoRepository = videoRepository;
        this.storageRepository = storageRepository;
        this.thumbnailGenerator = thumbnailGenerator;
    }

    /**
     * Execute the upload video use case
     * @param {Object} input - Upload input data
     * @param {string} input.filePath - Local path to video file
     * @param {string} input.fileName - Original file name
     * @param {string} input.title - Video title
     * @param {string} input.description - Video description
     * @param {string} input.mimeType - MIME type
     * @param {number} input.sizeBytes - File size in bytes
     * @param {string} input.userId - User ID (optional)
     * @param {string} input.thumbnailPath - Local path to custom thumbnail (optional)
     * @returns {Promise<Video>}
     */
    async execute(input) {
        // Validate input
        if (!input.filePath) {
            throw new Error('File path is required');
        }
        if (!input.fileName) {
            throw new Error('File name is required');
        }
        if (!input.title) {
            throw new Error('Title is required');
        }
        if (!input.mimeType) {
            throw new Error('MIME type is required');
        }
        if (!input.sizeBytes) {
            throw new Error('File size is required');
        }

        // Generate unique ID and storage key
        const videoId = uuidv4();
        const ext = path.extname(input.fileName);
        const storageKey = `${videoId}${ext}`;

        // Upload file to storage
        const { storageUrl, cdnUrl } = await this.storageRepository.upload(
            input.filePath,
            storageKey,
            {
                contentType: input.mimeType,
                originalName: input.fileName,
            }
        );

        // Handle thumbnail upload (only if user provides one)
        let thumbnailUrl = null;

        if (input.thumbnailPath) {
            const thumbnailKey = `thumb_${videoId}.jpg`;
            const thumbnailTempPath = path.join(process.cwd(), 'videos', 'temp', `thumb_${videoId}.jpg`);

            try {
                // User provided custom thumbnail - process it
                console.log('Processing user-provided thumbnail...');
                const thumbnailPath = await this.thumbnailGenerator.processUploadedThumbnail(
                    input.thumbnailPath,
                    thumbnailTempPath
                );

                // Upload thumbnail to storage
                const thumbnailUpload = await this.storageRepository.upload(
                    thumbnailPath,
                    thumbnailKey,
                    {
                        contentType: 'image/jpeg',
                        originalName: `${videoId}_thumbnail.jpg`,
                    }
                );

                thumbnailUrl = thumbnailUpload.cdnUrl || thumbnailUpload.storageUrl;

                // Clean up temp thumbnail
                const fs = require('fs');
                if (fs.existsSync(thumbnailPath)) {
                    fs.unlinkSync(thumbnailPath);
                }

                console.log('✅ Thumbnail uploaded successfully');
            } catch (error) {
                console.error('Failed to upload thumbnail:', error.message);
                // Continue without thumbnail - not a critical error
            }
        } else {
            console.log('No custom thumbnail provided - video will have no thumbnail');
        }

        // Create video entity
        const video = new Video({
            id: videoId,
            title: input.title,
            description: input.description || null,
            fileName: input.fileName,
            storageKey: storageKey,
            storageUrl: storageUrl,
            cdnUrl: cdnUrl,
            mimeType: input.mimeType,
            sizeBytes: input.sizeBytes,
            durationMs: input.durationMs || null,
            width: input.width || null,
            height: input.height || null,
            status: VideoStatus.READY,
            uploadedAt: new Date(),
            updatedAt: new Date(),
            userId: input.userId || null,
            thumbnailUrl: thumbnailUrl,
        });

        // Save to database
        const savedVideo = await this.videoRepository.save(video);

        return savedVideo;
    }
}

module.exports = UploadVideoUseCase;

