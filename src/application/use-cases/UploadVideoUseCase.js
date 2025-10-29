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

        // Handle thumbnail - either user-provided or auto-generated
        let thumbnailUrl = null;
        const fs = require('fs');

        if (input.thumbnailPath) {
            // User provided custom thumbnail - process it
            const thumbnailKey = `thumb_${videoId}.jpg`;
            const thumbnailTempPath = path.join(process.cwd(), 'videos', 'temp', `thumb_${videoId}.jpg`);

            try {
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
                        contentType: input.thumbnailMimeType || 'image/jpeg',
                        originalName: `${videoId}_thumbnail.jpg`,
                    }
                );

                thumbnailUrl = thumbnailUpload.cdnUrl || thumbnailUpload.storageUrl;

                // Clean up temp thumbnail
                if (fs.existsSync(thumbnailPath)) {
                    fs.unlinkSync(thumbnailPath);
                }

                console.log('✅ User thumbnail uploaded successfully');
            } catch (error) {
                console.error('Failed to upload user thumbnail:', error.message);
                // Continue to auto-generate instead
                console.log('Falling back to auto-generated thumbnail...');
            }
        }

        // Auto-generate thumbnail if no user thumbnail was provided or if upload failed
        if (!thumbnailUrl) {
            try {
                console.log('🎬 Auto-generating thumbnail from video...');
                const thumbnailTempPath = path.join(process.cwd(), 'videos', 'temp', `thumb_${videoId}.jpg`);

                // Generate thumbnail from video (extracts actual frame using ffmpeg)
                // Timestamp will be auto-calculated from middle of video
                const generatedThumbnailPath = await this.thumbnailGenerator.generateFromVideo(
                    input.filePath,
                    thumbnailTempPath,
                    {
                        size: '640x360'  // Standard thumbnail size
                    }
                );

                // Determine content type and storage key based on file extension
                const fileExt = path.extname(generatedThumbnailPath).toLowerCase();
                const contentType = fileExt === '.svg' ? 'image/svg+xml' : 'image/jpeg';
                const thumbnailKey = `thumb_${videoId}${fileExt}`;

                console.log(`📤 Uploading ${fileExt.toUpperCase()} thumbnail to storage...`);

                // Upload generated thumbnail to storage (B2/S3 or local)
                const thumbnailUpload = await this.storageRepository.upload(
                    generatedThumbnailPath,
                    thumbnailKey,
                    {
                        contentType: contentType,
                        originalName: `${videoId}_thumbnail${fileExt}`,
                    }
                );

                thumbnailUrl = thumbnailUpload.cdnUrl || thumbnailUpload.storageUrl;

                // Clean up temp thumbnail file
                if (fs.existsSync(generatedThumbnailPath)) {
                    fs.unlinkSync(generatedThumbnailPath);
                }

                console.log(`✅ Thumbnail saved to storage: ${thumbnailUrl}`);
            } catch (error) {
                console.error('❌ Failed to auto-generate thumbnail:', error.message);
                console.error('Stack:', error.stack);
                // Continue without thumbnail - video upload should not fail
                console.log('⚠️  Video will be saved without thumbnail');
            }
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

