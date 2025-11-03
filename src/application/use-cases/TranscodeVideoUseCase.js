// @ts-check
// Application: TranscodeVideoUseCase
// Use case for transcoding videos into multiple quality levels

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

class TranscodeVideoUseCase {
    /**
     * @param {import('../../domain/repositories/IVideoRepository')} videoRepository
     * @param {import('../../domain/repositories/IVideoQualityRepository')} videoQualityRepository
     * @param {import('../../domain/repositories/IStorageRepository')} storageRepository
     * @param {import('../../infrastructure/media/VideoTranscoder')} videoTranscoder
     */
    constructor(videoRepository, videoQualityRepository, storageRepository, videoTranscoder) {
        this.videoRepository = videoRepository;
        this.videoQualityRepository = videoQualityRepository;
        this.storageRepository = storageRepository;
        this.videoTranscoder = videoTranscoder;
    }

    /**
     * Execute video transcoding
     * @param {string} videoId - Video ID to transcode
     * @returns {Promise<Array<Object>>} Array of created quality variants
     */
    async execute(videoId) {
        console.log(`🔍 Looking up video in database: ${videoId}`);

        // Get video from database
        const video = await this.videoRepository.findById(videoId);
        if (!video) {
            console.error(`❌ Video ${videoId} not found in database`);
            throw new Error('Video not found');
        }

        console.log(`✅ Found video: ${video.title} (${video.fileName})`);


        // Delete existing quality variants if any (to avoid unique constraint errors on re-transcode)
        const existingCount = await this.videoQualityRepository.deleteByVideoId(videoId);
        if (existingCount > 0) {
            // Deleted existing quality variants for re-transcoding
        }

        // Update video status to processing
        video.status = 'processing';
        await this.videoRepository.update(video);

        try {
            // Download or get local path to source video
            const sourceVideoPath = await this.getSourceVideoPath(video);

            // Extract source video metadata if not already available
            let sourceMetadata;
            if (!video.width || !video.height) {
                sourceMetadata = await this.videoTranscoder.getVideoMetadata(sourceVideoPath);

                // Update video record with metadata
                video.width = sourceMetadata.width;
                video.height = sourceMetadata.height;
                video.durationMs = sourceMetadata.duration ? Math.round(sourceMetadata.duration * 1000) : null;
                await this.videoRepository.update(video);
            } else {
                sourceMetadata = {
                    width: video.width,
                    height: video.height,
                    duration: video.durationMs ? video.durationMs / 1000 : null,
                    bitrate: null
                };
            }

            // Create temp directory for transcoded videos
            const tempDir = path.join(process.cwd(), 'videos', 'temp', `transcode_${videoId}`);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Transcode to multiple qualities
            const baseFileName = path.parse(video.fileName).name;
            const transcodedVideos = await this.videoTranscoder.transcodeToMultipleQualities(
                sourceVideoPath,
                tempDir,
                baseFileName,
                null // Progress callback removed for performance
            );

            // Transcoding complete, generated qualities

            // Upload transcoded videos and save to database
            const qualityVariants = [];

            for (const transcoded of transcodedVideos) {
                const qualityId = uuidv4();
                const ext = path.extname(transcoded.path);
                const storageKey = `${videoId}_${transcoded.quality}${ext}`;


                // Upload to storage
                const { storageUrl, cdnUrl } = await this.storageRepository.upload(
                    transcoded.path,
                    storageKey,
                    {
                        contentType: 'video/mp4',
                        originalName: path.basename(transcoded.path)
                    }
                );

                // Save quality variant to database
                const qualityVariant = {
                    id: qualityId,
                    videoId: videoId,
                    quality: transcoded.quality,
                    storageKey: storageKey,
                    storageUrl: storageUrl,
                    cdnUrl: cdnUrl,
                    width: transcoded.width,
                    height: transcoded.height,
                    sizeBytes: transcoded.sizeBytes,
                    bitrate: parseInt(transcoded.bitrate) || null,
                    status: 'ready',
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                const savedQuality = await this.videoQualityRepository.save(qualityVariant);
                qualityVariants.push(savedQuality);
                console.log(`✅ ${transcoded.quality} saved to DB and available for playback`);

                // Clean up temp file
                if (fs.existsSync(transcoded.path)) {
                    fs.unlinkSync(transcoded.path);
                }
            }

            // Generate thumbnail from the source video if video doesn't have one
            if (!video.thumbnailUrl && sourceVideoPath && typeof sourceVideoPath === 'string' && fs.existsSync(sourceVideoPath)) {
                try {
                    const ThumbnailGenerator = require('../../infrastructure/media/ThumbnailGenerator');
                    const thumbnailGenerator = new ThumbnailGenerator();
                    const thumbnailTempPath = path.join(process.cwd(), 'videos', 'temp', `thumb_${videoId}.jpg`);

                    const generatedThumbnailPath = await thumbnailGenerator.generateFromVideo(
                        sourceVideoPath,
                        thumbnailTempPath,
                        { size: '640x360' }
                    );

                    // Upload thumbnail to storage
                    const fileExt = path.extname(generatedThumbnailPath).toLowerCase();
                    const contentType = fileExt === '.svg' ? 'image/svg+xml' : 'image/jpeg';
                    const thumbnailKey = `thumb_${videoId}${fileExt}`;

                    const thumbnailUpload = await this.storageRepository.upload(
                        generatedThumbnailPath,
                        thumbnailKey,
                        {
                            contentType: contentType,
                            originalName: `${videoId}_thumbnail${fileExt}`,
                        }
                    );

                    video.thumbnailUrl = thumbnailUpload.cdnUrl || thumbnailUpload.storageUrl;

                    // Clean up temp thumbnail
                    if (fs.existsSync(generatedThumbnailPath)) {
                        fs.unlinkSync(generatedThumbnailPath);
                    }
                } catch (thumbnailError) {
                    console.error('❌ Failed to generate thumbnail during transcoding:', thumbnailError.message);
                    // Continue without thumbnail
                }
            }

            const sourceFileExt = path.extname(video.storageKey || '').toLowerCase();
            const sourceIsMp4 = (video.mimeType || '').toLowerCase() === 'video/mp4'
                || sourceFileExt === '.mp4';

            if (sourceIsMp4) {
                // Save the original video as a quality variant with its actual resolution
                const originalHeight = sourceMetadata.height;
                let originalQualityLabel = `${originalHeight}p`;

                // If original matches a standard quality, use that label
                if (originalHeight === 240) originalQualityLabel = '240p';
                else if (originalHeight === 360) originalQualityLabel = '360p';
                else if (originalHeight === 480) originalQualityLabel = '480p';
                else if (originalHeight === 720) originalQualityLabel = '720p';
                else if (originalHeight === 1080) originalQualityLabel = '1080p';
                else if (originalHeight === 1440) originalQualityLabel = '1440p';
                else if (originalHeight === 2160) originalQualityLabel = '2160p'; // 4K

                const originalQuality = {
                    id: uuidv4(),
                    videoId: videoId,
                    quality: originalQualityLabel,
                    storageKey: video.storageKey,
                    storageUrl: video.storageUrl,
                    cdnUrl: video.cdnUrl,
                    width: sourceMetadata.width,
                    height: sourceMetadata.height,
                    sizeBytes: video.sizeBytes,
                    bitrate: sourceMetadata.bitrate,
                    status: 'ready',
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                const savedOriginal = await this.videoQualityRepository.save(originalQuality);
                qualityVariants.push(savedOriginal);

                // Original quality saved
            } else {
                // Skipping original non-MP4 file
            }

            // Prefer MP4 variant for primary playback
            const mp4Variants = qualityVariants
                .filter(variant => path.extname(variant.storageKey).toLowerCase() === '.mp4')
                .sort((a, b) => a.height - b.height);

            const highestMp4Variant = mp4Variants[mp4Variants.length - 1];

            if (highestMp4Variant) {
                const shouldReplacePrimary = !sourceIsMp4;

                if (shouldReplacePrimary) {
                    // Updating primary playback source to MP4 variant

                    const previousStorageKey = video.storageKey;

                    video.storageKey = highestMp4Variant.storageKey;
                    video.storageUrl = highestMp4Variant.storageUrl || highestMp4Variant.cdnUrl || video.storageUrl;
                    video.cdnUrl = highestMp4Variant.cdnUrl || null;
                    video.mimeType = 'video/mp4';
                    video.width = highestMp4Variant.width;
                    video.height = highestMp4Variant.height;
                    if (typeof highestMp4Variant.sizeBytes === 'number') {
                        video.sizeBytes = highestMp4Variant.sizeBytes;
                    }

                    // Best-effort cleanup of the original incompatible file
                    if (previousStorageKey && previousStorageKey !== highestMp4Variant.storageKey) {
                        try {
                            await this.storageRepository.delete(previousStorageKey);
                        } catch (cleanupError) {
                            console.warn(`⚠️  Failed to delete original file ${previousStorageKey}:`, cleanupError.message);
                        }
                    }
                }
            } else {
                console.warn('⚠️  No MP4 variants generated; original file retained for playback');
            }

            // Clean up temp directory
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }

            // Clean up source video if it was downloaded
            if (sourceVideoPath && sourceVideoPath.includes('temp') && fs.existsSync(sourceVideoPath)) {
                fs.unlinkSync(sourceVideoPath);
            }

            // Update video status back to ready
            video.status = 'ready';
            video.updatedAt = new Date();
            await this.videoRepository.update(video);

            console.log(`✅ Transcoding complete: ${videoId} (${qualityVariants.length} variants)`);

            return qualityVariants;

        } catch (error) {
            console.error(`❌ Transcoding failed for video ${videoId}:`, error);

            // Update video status to failed
            video.status = 'failed';
            await this.videoRepository.update(video);

            throw error;
        }
    }

    /**
     * Get local path to source video (download if needed)
     * @param {Object} video - Video entity
     * @returns {Promise<string>} Local path to video file
     */
    async getSourceVideoPath(video) {
        // Check if using local storage
        if (this.storageRepository.getFilePath) {
            const localPath = this.storageRepository.getFilePath(video.storageKey);
            if (fs.existsSync(localPath)) {
                return localPath;
            }
        }

        // For cloud storage, download video temporarily
        const tempPath = path.join(process.cwd(), 'videos', 'temp', `source_${video.id}${path.extname(video.fileName)}`);

        // Ensure temp directory exists
        const tempDir = path.dirname(tempPath);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Download the video
        const url = video.cdnUrl || video.storageUrl;
        const https = require('https');
        const http = require('http');
        const protocol = url.startsWith('https') ? https : http;

        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(tempPath);

            protocol.get(url, (response) => {
                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    resolve(tempPath);
                });
            }).on('error', (err) => {
                fs.unlinkSync(tempPath);
                reject(err);
            });
        });
    }
}

module.exports = TranscodeVideoUseCase;

