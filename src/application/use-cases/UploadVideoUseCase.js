// @ts-check
// Application: UploadVideoUseCase
// Use case for uploading a video

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const Video = require('../../domain/entities/Video');
const VideoStatus = require('../../domain/value-objects/VideoStatus');

class UploadVideoUseCase {
    /**
     * Creates an instance of UploadVideoUseCase.
     * @param {import('../../domain/repositories/IVideoRepository')} videoRepository - Repository for video persistence
     * @param {import('../../domain/repositories/IStorageRepository')} storageRepository - Repository for file storage operations
     * @param {import('../../infrastructure/media/ThumbnailGenerator')} thumbnailGenerator - Service for generating video thumbnails
     * @param {import('../../domain/repositories/IChannelRepository')} channelRepository - Repository for channel operations
     */
    constructor(videoRepository, storageRepository, thumbnailGenerator, channelRepository, videoTranscoder = null) {
        this.videoRepository = videoRepository;
        this.storageRepository = storageRepository;
        this.thumbnailGenerator = thumbnailGenerator;
        this.channelRepository = channelRepository;
        this.videoTranscoder = videoTranscoder;
    }

    /**
     * Determine if an upload should be converted to WebM for compatibility
     * @param {string} mimeType
     * @param {string} extension
     * @returns {boolean}
     */
    shouldConvertToWebm(mimeType, extension) {
        const normalizedMime = (mimeType || '').toLowerCase();
        const normalizedExt = (extension || '').toLowerCase();

        if (normalizedMime === 'video/webm' || normalizedExt === '.webm') {
            return false;
        }
        if (normalizedMime === 'video/mp4' || normalizedExt === '.mp4') {
            return false;
        }

        const convertibleMimes = new Set([
            'video/quicktime',
            'video/x-quicktime',
            'video/x-matroska',
            'video/x-msvideo'
        ]);
        const convertibleExts = new Set(['.mov', '.qt', '.mkv', '.avi']);

        return convertibleMimes.has(normalizedMime) || convertibleExts.has(normalizedExt);
    }

    /**
     * Sanitize file names for safe filesystem usage
     * @param {string} name
     * @returns {string}
     */
    sanitizeFileName(name) {
        const safe = (name || 'video').replace(/[^a-zA-Z0-9._-]+/g, '_');
        return safe.length > 0 ? safe : 'video';
    }

    /**
     * Convert an uploaded file to WebM
     * @param {string} videoId
     * @param {string} inputPath
     * @param {string} originalFileName
     * @returns {Promise<{filePath: string, fileName: string, mimeType: string, sizeBytes: number}>}
     */
    async convertSourceToWebm(videoId, inputPath, originalFileName) {
        if (!this.videoTranscoder || typeof this.videoTranscoder.convertToWebm !== 'function') {
            return null;
        }

        const tempDir = path.join(process.cwd(), 'videos', 'temp', 'converted');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const baseName = this.sanitizeFileName(path.parse(originalFileName).name || videoId);
        const outputPath = path.join(tempDir, `${videoId}_${baseName}.webm`);

        await this.videoTranscoder.convertToWebm(inputPath, outputPath);

        const stats = fs.statSync(outputPath);
        return {
            filePath: outputPath,
            fileName: `${baseName}.webm`,
            mimeType: 'video/webm',
            sizeBytes: stats.size
        };
    }

    /**
     * Execute the upload video use case
     * @param {Object} input - Upload input data
     * @param {string} input.filePath - Local path to video file
     * @param {string} input.fileName - Original file name
     * @param {string} input.title - Video title
     * @param {string} [input.description] - Video description
     * @param {string} input.mimeType - MIME type
     * @param {number} input.sizeBytes - File size in bytes
     * @param {string} [input.userId] - User ID (optional)
     * @param {string} [input.thumbnailPath] - Local path to custom thumbnail (optional)
     * @param {string} [input.thumbnailMimeType] - MIME type of custom thumbnail (optional)
     * @param {number} [input.durationMs] - Video duration in milliseconds (optional)
     * @param {number} [input.width] - Video width (optional)
     * @param {number} [input.height] - Video height (optional)
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

        // Require user to have a channel
        if (!input.userId) {
            throw new Error('You must be logged in to upload videos');
        }

        const channel = await this.channelRepository.findByUserId(input.userId);
        if (!channel) {
            throw new Error('You must create a channel before uploading videos');
        }

        const videoId = uuidv4();
        const tempFilesToCleanup = [];

        try {
            let workingFilePath = input.filePath;
            let workingFileName = input.fileName;
            let workingMimeType = input.mimeType;
            let workingSizeBytes = input.sizeBytes;

            if (this.shouldConvertToWebm(workingMimeType, path.extname(workingFileName))) {
                try {
                    const conversion = await this.convertSourceToWebm(videoId, workingFilePath, workingFileName);
                    if (conversion) {
                        workingFilePath = conversion.filePath;
                        workingFileName = conversion.fileName;
                        workingMimeType = conversion.mimeType;
                        workingSizeBytes = conversion.sizeBytes;
                        tempFilesToCleanup.push(conversion.filePath);
                        console.log('ℹ️  Converted uploaded video to WebM for broader playback support');
                    }
                } catch (conversionError) {
                    console.error('❌ Failed to convert uploaded video to WebM:', conversionError.message);
                }
            }

            const ext = path.extname(workingFileName);
            const storageKey = `${videoId}${ext}`;

            // Upload file to storage (use Large File API for files > 100MB)
            const fileSizeThreshold = 100 * 1024 * 1024; // 100MB
            const useLargeFileAPI = workingSizeBytes > fileSizeThreshold &&
                typeof this.storageRepository.uploadLargeFile === 'function';

            let storageUrl, cdnUrl;

            if (useLargeFileAPI) {
                const result = await this.storageRepository.uploadLargeFile(
                    workingFilePath,
                    storageKey,
                    {
                        contentType: workingMimeType,
                        originalName: workingFileName,
                    },
                    {
                        partSize: 100 * 1024 * 1024 // 100MB parts
                    }
                );
                storageUrl = result.storageUrl;
                cdnUrl = result.cdnUrl;
            } else {
                const result = await this.storageRepository.upload(
                    workingFilePath,
                    storageKey,
                    {
                        contentType: workingMimeType,
                        originalName: workingFileName,
                    }
                );
                storageUrl = result.storageUrl;
                cdnUrl = result.cdnUrl;
            }

            // Handle thumbnail - either user-provided or auto-generated
            let thumbnailUrl = null;

            if (input.thumbnailPath) {
                // User provided custom thumbnail - process it
                const thumbnailKey = `thumb_${videoId}.jpg`;
                const thumbnailTempPath = path.join(process.cwd(), 'videos', 'temp', `thumb_${videoId}.jpg`);

                try {
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
                }
            }

            // Auto-generate thumbnail if no user thumbnail was provided or if upload failed
            if (!thumbnailUrl) {
                try {
                    const thumbnailTempPath = path.join(process.cwd(), 'videos', 'temp', `thumb_${videoId}.jpg`);

                    // Generate thumbnail from video (extracts actual frame using ffmpeg)
                    // Timestamp will be auto-calculated from middle of video
                    const generatedThumbnailPath = await this.thumbnailGenerator.generateFromVideo(
                        workingFilePath,
                        thumbnailTempPath,
                        {
                            size: '640x360'  // Standard thumbnail size
                        }
                    );

                    // Determine content type and storage key based on file extension
                    const fileExt = path.extname(generatedThumbnailPath).toLowerCase();
                    const contentType = fileExt === '.svg' ? 'image/svg+xml' : 'image/jpeg';
                    const thumbnailKey = `thumb_${videoId}${fileExt}`;

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
                    // Continue without thumbnail - video upload should not fail
                }
            }

            // Create video entity
            const video = new Video({
                id: videoId,
                title: input.title,
                description: input.description || null,
                fileName: workingFileName,
                storageKey: storageKey,
                storageUrl: storageUrl,
                cdnUrl: cdnUrl,
                mimeType: workingMimeType,
                sizeBytes: workingSizeBytes,
                durationMs: input.durationMs || null,
                width: input.width || null,
                height: input.height || null,
                status: VideoStatus.PROCESSING, // Start as processing since transcoding will be queued
                uploadedAt: new Date(),
                updatedAt: new Date(),
                userId: input.userId || null,
                thumbnailUrl: thumbnailUrl,
            });

            // Save to database
            const savedVideo = await this.videoRepository.save(video);

            // Increment channel video count
            try {
                await this.channelRepository.update(channel.id, {
                    videoCount: channel.videoCount + 1
                });
            } catch (error) {
                console.error('Failed to update channel video count:', error.message);
                // Don't fail the upload if count update fails
            }

            return savedVideo;
        } finally {
            for (const tempPath of tempFilesToCleanup) {
                try {
                    if (tempPath && fs.existsSync(tempPath)) {
                        fs.unlinkSync(tempPath);
                    }
                } catch (cleanupError) {
                    console.error('Failed to clean up temporary converted file:', cleanupError.message);
                }
            }
        }
    }
}

module.exports = UploadVideoUseCase;

