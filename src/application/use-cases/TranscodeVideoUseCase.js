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

        let tempDir = null;
        let sourceVideoPath = null;

        try {
            // Download or get local path to source video
            sourceVideoPath = await this.getSourceVideoPath(video);

            const validation = await this.validateSourceVideo(video, sourceVideoPath);
            sourceVideoPath = validation.sourcePath;

            // Extract source video metadata if not already available
            let sourceMetadata = validation.metadata;
            if (!video.width || !video.height) {
                
                // Update video record with metadata
                video.width = sourceMetadata.width;
                video.height = sourceMetadata.height;
                video.durationMs = sourceMetadata.duration ? Math.round(sourceMetadata.duration * 1000) : null;
                await this.videoRepository.update(video);
            } else {
                sourceMetadata = {
                    width: video.width,
                    height: video.height,
                    duration: video.durationMs ? video.durationMs / 1000 : sourceMetadata?.duration || null,
                    bitrate: sourceMetadata?.bitrate || null
                };
            }

            // Create temp directory for transcoded videos
            tempDir = path.join(process.cwd(), 'videos', 'temp', `transcode_${videoId}`);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Transcode to multiple qualities
            const baseFileName = path.parse(video.fileName).name;
            let transcodedVideos = [];

            try {
                // Generate both MP4 and HLS streams
                // HLS enables adaptive bitrate streaming for better user experience
                // Always generate HLS for adaptive streaming support
                const generateHLS = true; // Always enabled
                transcodedVideos = await this.videoTranscoder.transcodeToMultipleQualities(
                    sourceVideoPath,
                    tempDir,
                    baseFileName,
                    null, // Progress callback removed for performance
                    generateHLS
                );
            } catch (transcodeError) {
                console.error(`❌ Transcoding failed:`, transcodeError.message);
                // If transcoding completely fails, we'll still try to save the original
                console.log(`⚠️  Transcoding failed, video will be marked as ready with original quality only`);
            }

            // Upload transcoded videos and save to database
            const qualityVariants = [];

            // Process each transcoded quality with individual error handling
            for (const transcoded of transcodedVideos) {
                try {
                    const qualityId = uuidv4();
                    const ext = path.extname(transcoded.path);
                    const storageKey = `${videoId}_${transcoded.quality}${ext}`;

                    // Verify file exists and has size
                    if (!fs.existsSync(transcoded.path)) {
                        console.error(`❌ Transcoded file not found: ${transcoded.path}`);
                        continue;
                    }

                    const fileSize = fs.statSync(transcoded.path).size;
                    if (fileSize === 0) {
                        console.error(`❌ Transcoded file is empty: ${transcoded.path}`);
                        continue;
                    }

                    // Determine content type based on file extension
                    let contentType = 'video/mp4';
                    if (ext === '.m3u8' || ext === '.m3u') {
                        contentType = 'application/vnd.apple.mpegurl';
                    } else if (ext === '.ts') {
                        contentType = 'video/mp2t';
                    }

                    // Upload to storage with retry logic
                    let uploadResult;
                    let uploadAttempts = 0;
                    const maxUploadAttempts = 3;

                    while (uploadAttempts < maxUploadAttempts) {
                        try {
                            uploadResult = await this.storageRepository.upload(
                                transcoded.path,
                                storageKey,
                                {
                                    contentType: contentType,
                                    originalName: path.basename(transcoded.path)
                                }
                            );
                            break; // Success
                        } catch (uploadError) {
                            uploadAttempts++;
                            console.error(`❌ Upload attempt ${uploadAttempts} failed for ${transcoded.quality}:`, uploadError.message);

                            if (uploadAttempts >= maxUploadAttempts) {
                                throw uploadError;
                            }

                            // Wait before retry (exponential backoff)
                            await new Promise(resolve => setTimeout(resolve, 1000 * uploadAttempts));
                        }
                    }

                    // Save quality variant to database (only for MP4 files, not HLS playlists)
                    if (ext !== '.m3u8' && ext !== '.m3u' && ext !== '.ts') {
                        const qualityVariant = {
                            id: qualityId,
                            videoId: videoId,
                            quality: transcoded.quality,
                            storageKey: storageKey,
                            storageUrl: uploadResult.storageUrl,
                            cdnUrl: uploadResult.cdnUrl,
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
                    } else {
                        console.log(`✅ HLS ${transcoded.quality} file uploaded: ${storageKey}`);
                    }

                    // Clean up temp file
                    if (fs.existsSync(transcoded.path)) {
                        fs.unlinkSync(transcoded.path);
                    }
                } catch (qualityError) {
                    console.error(`❌ Failed to process ${transcoded.quality}:`, qualityError.message);
                    // Continue with other qualities even if one fails
                    // Clean up temp file on error
                    try {
                        if (transcoded.path && fs.existsSync(transcoded.path)) {
                            fs.unlinkSync(transcoded.path);
                        }
                    } catch (cleanupError) {
                        console.error(`⚠️  Failed to cleanup temp file:`, cleanupError.message);
                    }
                }
            }

            // Upload HLS quality playlists, master playlist, and segments if HLS was generated
            if (tempDir && fs.existsSync(tempDir)) {
                try {
                    const fs = require('fs');
                    const files = fs.readdirSync(tempDir);
                    console.log(`📁 Checking tempDir for HLS files: ${tempDir}`);
                    console.log(`📁 Files in tempDir: ${files.join(', ')}`);
                    
                    // Find master playlist
                    const masterPlaylist = files.find(f => f === 'master.m3u8' && fs.statSync(path.join(tempDir, f)).isFile());
                    if (masterPlaylist) {
                        try {
                            const masterPath = path.join(tempDir, masterPlaylist);
                            const masterStorageKey = `${videoId}_hls.m3u8`;
                            
                            console.log(`📤 Uploading HLS master playlist: ${masterPlaylist} -> ${masterStorageKey}`);
                            
                            const masterUploadResult = await this.storageRepository.upload(
                                masterPath,
                                masterStorageKey,
                                {
                                    contentType: 'application/vnd.apple.mpegurl',
                                    originalName: masterPlaylist
                                }
                            );
                            
                            console.log(`✅ HLS master playlist uploaded: ${masterStorageKey}`);
                            
                            // Update video storage key to point to master playlist if not already set
                            if (!video.storageKey.endsWith('_hls.m3u8')) {
                                video.storageKey = masterStorageKey;
                                video.storageUrl = masterUploadResult.storageUrl;
                                video.cdnUrl = masterUploadResult.cdnUrl;
                                video.mimeType = 'application/vnd.apple.mpegurl';
                                await this.videoRepository.update(video);
                                console.log(`✅ Updated video storage key to master playlist: ${masterStorageKey}`);
                            }
                        } catch (masterError) {
                            console.error(`❌ Failed to upload HLS master playlist:`, masterError);
                        }
                    } else {
                        console.log(`⚠️  Master playlist not found in ${tempDir}`);
                    }
                    
                    // Find all quality playlists (e.g., 240p.m3u8, 360p.m3u8)
                    const qualityPlaylists = files.filter(f => 
                        f.match(/^\d+p\.m3u8$/) && fs.statSync(path.join(tempDir, f)).isFile()
                    );
                    
                    console.log(`📋 Found ${qualityPlaylists.length} quality playlists: ${qualityPlaylists.join(', ')}`);
                    
                    for (const playlistFile of qualityPlaylists) {
                        try {
                            const playlistPath = path.join(tempDir, playlistFile);
                            
                            // Verify file exists and has content
                            if (!fs.existsSync(playlistPath)) {
                                console.error(`❌ Playlist file not found: ${playlistPath}`);
                                continue;
                            }
                            
                            const fileSize = fs.statSync(playlistPath).size;
                            if (fileSize === 0) {
                                console.error(`❌ Playlist file is empty: ${playlistPath}`);
                                continue;
                            }
                            
                            const quality = playlistFile.replace('.m3u8', '');
                            const storageKey = `${videoId}_${playlistFile}`;
                            
                            console.log(`📤 Uploading HLS quality playlist: ${playlistFile} (${fileSize} bytes) -> ${storageKey}`);
                            
                            const uploadResult = await this.storageRepository.upload(
                                playlistPath,
                                storageKey,
                                {
                                    contentType: 'application/vnd.apple.mpegurl',
                                    originalName: playlistFile
                                }
                            );
                            
                            console.log(`✅ HLS quality playlist uploaded: ${storageKey} -> ${uploadResult.storageUrl || uploadResult.cdnUrl}`);
                        } catch (playlistError) {
                            console.error(`❌ Failed to upload HLS playlist ${playlistFile}:`, playlistError);
                            console.error(`   Error stack:`, playlistError.stack);
                        }
                    }
                    
                    // Find all HLS segments (e.g., 240p_000.ts, 240p_001.ts)
                    const segments = files.filter(f => 
                        f.match(/^\d+p_\d+\.ts$/) && fs.statSync(path.join(tempDir, f)).isFile()
                    );
                    
                    console.log(`📦 Found ${segments.length} HLS segments`);
                    
                    // Upload segments in batches to avoid overwhelming the storage
                    const batchSize = 10;
                    for (let i = 0; i < segments.length; i += batchSize) {
                        const batch = segments.slice(i, i + batchSize);
                        await Promise.all(batch.map(async (segmentFile) => {
                            try {
                                const segmentPath = path.join(tempDir, segmentFile);
                                const storageKey = `${videoId}_${segmentFile}`;
                                
                                await this.storageRepository.upload(
                                    segmentPath,
                                    storageKey,
                                    {
                                        contentType: 'video/mp2t',
                                        originalName: segmentFile
                                    }
                                );
                            } catch (segmentError) {
                                console.error(`❌ Failed to upload HLS segment ${segmentFile}:`, segmentError.message);
                            }
                        }));
                        
                        console.log(`📤 Uploaded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(segments.length / batchSize)} (${Math.min(i + batchSize, segments.length)}/${segments.length} segments)`);
                    }
                    
                    if (segments.length > 0) {
                        console.log(`✅ Uploaded ${segments.length} HLS segments`);
                    }
                } catch (hlsUploadError) {
                    console.error(`⚠️  Failed to upload HLS files:`, hlsUploadError);
                    console.error(`   Error stack:`, hlsUploadError.stack);
                    // Continue - HLS is optional
                }
            } else {
                console.log(`⚠️  TempDir does not exist or is not accessible: ${tempDir}`);
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

            // Update video status based on results
            // If we have at least one quality variant OR the original is playable, mark as ready
            const hasPlayableContent = qualityVariants.length > 0 ||
                (video.storageUrl && (video.mimeType?.includes('mp4') || video.mimeType?.includes('webm')));

            if (hasPlayableContent) {
                video.status = 'ready';
                console.log(`✅ Video ${videoId} marked as ready with ${qualityVariants.length} quality variant(s)`);
            } else {
                video.status = 'failed';
                console.error(`❌ Video ${videoId} marked as failed: no playable content available`);
            }

            video.updatedAt = new Date();
            await this.videoRepository.update(video);

            console.log(`✅ Transcoding complete: ${videoId} (${qualityVariants.length} variants)`);

            return qualityVariants;

        } catch (error) {
            console.error(`❌ Transcoding failed for video ${videoId}:`, error);
            console.error(`   Error details:`, error.stack);

            // Update video status to failed
            try {
                video.status = 'failed';
                await this.videoRepository.update(video);
            } catch (dbUpdateError) {
                console.error(`❌ Failed to update video status to failed:`, dbUpdateError.message);
            }

            throw error;
        } finally {
            // ALWAYS clean up temp files, even if errors occurred
            try {
                if (tempDir && fs.existsSync(tempDir)) {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                }
                // Clean up source video if it was downloaded
                if (sourceVideoPath && sourceVideoPath.includes('temp') && fs.existsSync(sourceVideoPath)) {
                    fs.unlinkSync(sourceVideoPath);
                }
            } catch (cleanupError) {
                console.warn('⚠️  Failed to cleanup temp files:', cleanupError.message);
            }
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
                const stats = fs.statSync(localPath);
                if (stats.size === 0) {
                    throw new Error(`Local source file is empty: ${localPath}`);
                }

                console.log(`📂 Using local storage file: ${localPath}`);
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

        console.log(`📥 Downloading video from cloud storage...`);
        const url = video.cdnUrl || video.storageUrl;

        if (!url) {
            throw new Error('Video has no storage URL');
        }

        const https = require('https');
        const http = require('http');
        const protocol = url.startsWith('https') ? https : http;

        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(tempPath);
            let downloadedBytes = 0;

            const request = protocol.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download video: HTTP ${response.statusCode}`));
                    return;
                }

                const totalBytes = parseInt(response.headers['content-length'] || '0');
                console.log(`📥 Downloading ${(totalBytes / 1024 / 1024).toFixed(2)} MB...`);

                response.on('data', (chunk) => {
                    downloadedBytes += chunk.length;
                });

                response.pipe(file);

                file.on('finish', () => {
                    file.close();

                    // Validate download completeness
                    if (downloadedBytes === 0) {
                        fs.unlinkSync(tempPath);
                        return reject(new Error('Downloaded source video is empty'));
                    }

                    if (totalBytes > 0 && downloadedBytes !== totalBytes) {
                        fs.unlinkSync(tempPath);
                        return reject(new Error(`Download incomplete: expected ${totalBytes} bytes, received ${downloadedBytes}`));
                    }

                    console.log(`✅ Download complete: ${(downloadedBytes / 1024 / 1024).toFixed(2)} MB`);
                    resolve(tempPath);
                });

                file.on('error', (err) => {
                    fs.unlinkSync(tempPath);
                    reject(err);
                });
            });

            request.on('error', (err) => {
                try {
                    if (fs.existsSync(tempPath)) {
                        fs.unlinkSync(tempPath);
                    }
                } catch (cleanupError) {
                    console.error('Failed to cleanup after download error:', cleanupError);
                }
                reject(new Error(`Download failed: ${err.message}`));
            });

            // Set timeout for download (30 minutes for large files)
            request.setTimeout(30 * 60 * 1000, () => {
                request.destroy();
                reject(new Error('Download timeout: file too large or connection too slow'));
            });
        });
    }

    /**
     * Validate a source video is readable by ffprobe and retry download once if it is a temporary source
     * @param {Object} video - Video entity
     * @param {string} sourceVideoPath - Path to the downloaded or local source video
     * @param {boolean} [allowRetry=true] - Whether to attempt a single re-download on failure
     * @returns {Promise<{sourcePath: string, metadata: {width: number, height: number, duration: number, bitrate: number | null}}>} Validation result
     */
    async validateSourceVideo(video, sourceVideoPath, allowRetry = true) {
        if (!sourceVideoPath || !fs.existsSync(sourceVideoPath)) {
            throw new Error(`Source video not found locally at ${sourceVideoPath}`);
        }

        const stats = fs.statSync(sourceVideoPath);
        if (stats.size === 0) {
            throw new Error(`Source video is empty: ${sourceVideoPath}`);
        }

        try {
            const metadata = await this.videoTranscoder.getVideoMetadata(sourceVideoPath);
            return { sourcePath: sourceVideoPath, metadata };
        } catch (error) {
            const isTempSource = sourceVideoPath.includes(`${path.sep}videos${path.sep}temp${path.sep}`);

            if (allowRetry && isTempSource) {
                console.warn(`⚠️  Failed to read source video (${error.message}). Retrying download once...`);

                try {
                    fs.unlinkSync(sourceVideoPath);
                } catch (cleanupError) {
                    console.warn(`⚠️  Failed to delete corrupted source before retry: ${cleanupError.message}`);
                }

                const redownloadedPath = await this.getSourceVideoPath(video);
                return this.validateSourceVideo(video, redownloadedPath, false);
            }

            throw error;
        }
    }
}

module.exports = TranscodeVideoUseCase;

