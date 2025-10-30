// @ts-check
// Presentation: ChunkUploadController
// Handles chunked file uploads for large videos

const { formidable } = require('formidable');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class ChunkUploadController {
    constructor(chunkUploadService, videoService, storageRepository) {
        this.chunkUploadService = chunkUploadService;
        this.videoService = videoService;
        this.storageRepository = storageRepository;
    }

    /**
     * Helper to send JSON response (native Node.js HTTP)
     */
    sendJson(res, statusCode, data) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }

    /**
     * Initialize a new chunked upload session
     * POST /api/upload/init
     */
    async initializeUpload(req, res) {
        try {
            if (!req.user) {
                return this.sendJson(res, 401, { error: 'Authentication required' });
            }

            // Parse JSON body
            let body = '';
            for await (const chunk of req) {
                body += chunk.toString();
            }
            const { fileName, fileSize, mimeType, totalChunks, title, description } = JSON.parse(body);

            // Validation
            if (!fileName || !fileSize || !mimeType || !totalChunks) {
                return this.sendJson(res, 400, { error: 'Missing required fields' });
            }

            // Validate file type
            const allowedMimeTypes = [
                'video/mp4',
                'video/webm',
                'video/quicktime',
                'video/x-msvideo',
                'video/mpeg',
                'video/ogg',
            ];
            if (!allowedMimeTypes.includes(mimeType)) {
                return this.sendJson(res, 400, { error: 'Invalid file type' });
            }

            // Validate file size (10GB max)
            const maxSize = 10 * 1024 * 1024 * 1024;
            if (fileSize > maxSize) {
                return this.sendJson(res, 400, { error: 'File size exceeds 10GB limit' });
            }

            // Check for existing incomplete upload
            const existingSession = await this.chunkUploadService.findIncompleteSession(
                req.user.id,
                fileName,
                fileSize
            );

            let session;
            if (existingSession) {
                // Resume existing session
                session = existingSession;
                console.log(`♻️  Resuming upload session ${session.id}`);
            } else {
                // Generate storage key for the final file
                const ext = path.extname(fileName);
                const videoId = uuidv4();
                const storageKey = `${videoId}${ext}`;

                // Start B2 multipart upload
                console.log(`🚀 Starting B2 multipart upload for ${storageKey}`);
                const b2Upload = await this.storageRepository.startMultipartUpload(storageKey, {
                    contentType: mimeType,
                    originalName: fileName,
                });

                console.log(`✅ B2 multipart upload initiated: ${b2Upload.uploadId}`);

                // Create new session with B2 metadata
                session = await this.chunkUploadService.createSession({
                    userId: req.user.id,
                    fileName,
                    fileSize,
                    mimeType,
                    totalChunks,
                    metadata: {
                        title,
                        description,
                        b2UploadId: b2Upload.uploadId,
                        storageKey: storageKey,
                        videoId: videoId,
                    },
                });
                console.log(`📝 Created upload session ${session.id}`);
            }

            return this.sendJson(res, 200, {
                uploadId: session.id,
                resumableChunks: session.uploadedChunks || [],
                chunkSize: 5 * 1024 * 1024, // 5MB
                expiresAt: session.expiresAt,
            });
        } catch (error) {
            console.error('Initialize upload error:', error);
            return this.sendJson(res, 500, { error: error.message || 'Failed to initialize upload' });
        }
    }

    /**
     * Upload a single chunk
     * POST /api/upload/chunk
     */
    async uploadChunk(req, res) {
        try {
            if (!req.user) {
                return this.sendJson(res, 401, { error: 'Authentication required' });
            }

            const uploadDir = path.join(process.cwd(), 'videos', 'temp', 'chunks');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const form = formidable({
                uploadDir,
                keepExtensions: false,
                maxFileSize: 10 * 1024 * 1024, // 10MB per chunk
                multiples: false,
            });

            let fields, files;
            try {
                [fields, files] = await form.parse(req);
            } catch (parseError) {
                console.error('Formidable parse error:', parseError);
                return this.sendJson(res, 400, { error: 'Failed to parse chunk data: ' + parseError.message });
            }

            const chunkFile = files.chunk?.[0];
            const chunkIndex = parseInt(fields.chunkIndex?.[0]);
            const chunkHash = fields.chunkHash?.[0];
            const uploadId = fields.uploadId?.[0];
            const totalChunks = parseInt(fields.totalChunks?.[0]);

            console.log(`📦 Chunk ${chunkIndex}/${totalChunks - 1} received for upload ${uploadId}`);

            if (!chunkFile || isNaN(chunkIndex) || !chunkHash || !uploadId) {
                console.error('Missing required fields:', { chunkFile: !!chunkFile, chunkIndex, chunkHash, uploadId });
                // Clean up temp file if it exists
                if (chunkFile?.filepath && fs.existsSync(chunkFile.filepath)) {
                    try {
                        fs.unlinkSync(chunkFile.filepath);
                    } catch (e) { }
                }
                return this.sendJson(res, 400, { error: 'Missing required fields' });
            }

            // Verify session exists and belongs to user
            const session = await this.chunkUploadService.getSession(uploadId);
            if (!session || session.userId !== req.user.id) {
                return this.sendJson(res, 404, { error: 'Upload session not found' });
            }

            // Verify chunk hash
            const calculatedHash = await this.calculateFileHash(chunkFile.filepath);
            if (calculatedHash !== chunkHash) {
                try {
                    fs.unlinkSync(chunkFile.filepath);
                } catch (e) { }
                return this.sendJson(res, 400, { error: 'Chunk hash mismatch - corrupted data' });
            }

            // Get B2 metadata from session
            const b2UploadId = session.metadata?.b2UploadId;
            const storageKey = session.metadata?.storageKey;

            if (!b2UploadId || !storageKey) {
                try {
                    fs.unlinkSync(chunkFile.filepath);
                } catch (e) { }
                return this.sendJson(res, 500, { error: 'Missing B2 upload metadata' });
            }

            // Upload chunk directly to B2 as a part (with retry)
            // Read chunk as stream to avoid memory bloat
            let b2Part;
            let retryCount = 0;
            const maxRetries = 3;
            let chunkData = null;

            try {
                while (retryCount < maxRetries) {
                    try {
                        // Read chunk data (lazy - only when needed)
                        if (!chunkData) {
                            chunkData = fs.readFileSync(chunkFile.filepath);
                        }

                        b2Part = await this.storageRepository.uploadPart(
                            storageKey,
                            b2UploadId,
                            chunkIndex + 1, // B2 part numbers are 1-indexed
                            chunkData
                        );
                        break; // Success
                    } catch (uploadError) {
                        retryCount++;
                        console.error(`   B2 part ${chunkIndex + 1} upload attempt ${retryCount} failed:`, uploadError.message);

                        if (retryCount === maxRetries) {
                            throw uploadError;
                        }

                        // Wait before retry (exponential backoff)
                        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                    }
                }
            } finally {
                // Force garbage collection of chunk data
                chunkData = null;

                // Clean up temp chunk file
                try {
                    if (fs.existsSync(chunkFile.filepath)) {
                        fs.unlinkSync(chunkFile.filepath);
                    }
                } catch (e) {
                    console.error('Failed to delete temp chunk file:', e);
                }
            }

            // Update session with B2 part info
            await this.chunkUploadService.markChunkUploaded(uploadId, chunkIndex, {
                etag: b2Part.etag,
                partNumber: b2Part.partNumber,
            });

            const updatedSession = await this.chunkUploadService.getSession(uploadId);
            const progress = (updatedSession.uploadedChunks.length / totalChunks) * 100;

            console.log(`✅ Chunk ${chunkIndex} saved. Progress: ${Math.round(progress)}% (${updatedSession.uploadedChunks.length}/${totalChunks})`);

            return this.sendJson(res, 200, {
                chunkIndex,
                received: true,
                hashMatch: true,
                uploadedChunks: updatedSession.uploadedChunks.length,
                totalChunks,
                progress: Math.round(progress * 10) / 10,
            });
        } catch (error) {
            console.error('Upload chunk error:', error);
            console.error('Error stack:', error.stack);
            return this.sendJson(res, 500, { error: error.message || 'Failed to upload chunk' });
        }
    }

    /**
     * Finalize upload by merging chunks
     * POST /api/upload/finalize
     */
    async finalizeUpload(req, res) {
        try {
            if (!req.user) {
                return this.sendJson(res, 401, { error: 'Authentication required' });
            }

            // Parse JSON body
            let body = '';
            for await (const chunk of req) {
                body += chunk.toString();
            }
            const { uploadId, fileName, title, description } = JSON.parse(body);

            if (!uploadId || !fileName) {
                return this.sendJson(res, 400, { error: 'Missing required fields' });
            }

            // Verify session
            const session = await this.chunkUploadService.getSession(uploadId);
            if (!session || session.userId !== req.user.id) {
                return this.sendJson(res, 404, { error: 'Upload session not found' });
            }

            // Verify all chunks uploaded
            if (session.uploadedChunks.length !== session.totalChunks) {
                return this.sendJson(res, 400, {
                    error: 'Not all chunks uploaded',
                    uploaded: session.uploadedChunks.length,
                    total: session.totalChunks,
                });
            }

            // Get B2 metadata
            const b2UploadId = session.metadata?.b2UploadId;
            const storageKey = session.metadata?.storageKey;
            const videoId = session.metadata?.videoId;
            const b2Parts = session.metadata?.b2Parts || [];

            if (!b2UploadId || !storageKey || !videoId) {
                return this.sendJson(res, 500, { error: 'Missing B2 upload metadata' });
            }

            console.log(`🔗 Completing B2 multipart upload: ${storageKey}`);
            console.log(`   Total parts: ${b2Parts.length}`);

            // Sort parts by part number (required by B2)
            const sortedParts = b2Parts.sort((a, b) => a.partNumber - b.partNumber);

            // Complete B2 multipart upload
            const { storageUrl, cdnUrl } = await this.storageRepository.completeMultipartUpload(
                storageKey,
                b2UploadId,
                sortedParts
            );

            console.log(`✅ B2 multipart upload completed: ${storageKey}`);

            // Generate thumbnail by downloading video temporarily
            let thumbnailUrl = null;
            const tempVideoPath = path.join(process.cwd(), 'videos', 'temp', `temp_${videoId}${path.extname(session.fileName)}`);

            try {
                console.log('🎬 Generating thumbnail...');

                // Download only first 10MB of video for thumbnail generation
                const rangeSize = 10 * 1024 * 1024; // 10MB
                const { stream: videoStream } = await this.storageRepository.getObjectStream(
                    storageKey,
                    `bytes=0-${rangeSize - 1}`
                );
                const writeStream = fs.createWriteStream(tempVideoPath);

                await new Promise((resolve, reject) => {
                    videoStream.pipe(writeStream);
                    videoStream.on('error', (err) => reject(err));
                    writeStream.on('finish', () => resolve());
                    writeStream.on('error', (err) => reject(err));
                });

                console.log('   First 10MB downloaded for thumbnail generation');

                // Generate thumbnail
                const ThumbnailGenerator = require('../../infrastructure/media/ThumbnailGenerator');
                const thumbnailGenerator = new ThumbnailGenerator();
                const thumbnailTempPath = path.join(process.cwd(), 'videos', 'temp', `thumb_${videoId}.jpg`);

                const generatedThumbnailPath = await thumbnailGenerator.generateFromVideo(
                    tempVideoPath,
                    thumbnailTempPath,
                    { size: '640x360' }
                );

                // Upload thumbnail to B2
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

                thumbnailUrl = thumbnailUpload.cdnUrl || thumbnailUpload.storageUrl;
                console.log(`✅ Thumbnail generated and uploaded: ${thumbnailUrl}`);

                // Clean up temp files
                try {
                    if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
                    if (fs.existsSync(generatedThumbnailPath)) fs.unlinkSync(generatedThumbnailPath);
                } catch (e) { }

            } catch (thumbnailError) {
                console.error('❌ Failed to generate thumbnail:', thumbnailError.message);
                // Continue without thumbnail - video upload should not fail
                console.log('⚠️  Video will be saved without thumbnail, transcoding will try again');

                // Clean up temp video if it exists
                try {
                    if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
                } catch (e) { }
            }

            // Create video entity directly in database
            const Video = require('../../domain/entities/Video');
            const VideoStatus = require('../../domain/value-objects/VideoStatus');

            const video = new Video({
                id: videoId,
                title: title || session.metadata?.title || session.fileName,
                description: description || session.metadata?.description || '',
                fileName: session.fileName,
                storageKey: storageKey,
                storageUrl: storageUrl,
                cdnUrl: cdnUrl,
                mimeType: session.mimeType,
                sizeBytes: session.fileSize,
                durationMs: null,
                width: null,
                height: null,
                status: VideoStatus.READY,
                uploadedAt: new Date(),
                updatedAt: new Date(),
                userId: req.user.id,
                thumbnailUrl: thumbnailUrl,
            });

            // Save to database using shared repositories from server
            // Access through videoService to reuse existing Prisma connection
            let savedVideo;
            try {
                // Create a temporary file path (not used, but required by uploadVideo signature)
                // We set the storage data directly in the Video entity
                const tempPath = path.join(process.cwd(), 'videos', 'temp', `.placeholder_${videoId}`);

                // Write a tiny placeholder file
                fs.writeFileSync(tempPath, 'placeholder');

                // Use VideoService's repositories (reuses Prisma connection)
                const PrismaVideoRepository = require('../../infrastructure/persistence/PrismaVideoRepository');
                const PrismaChannelRepository = require('../../infrastructure/persistence/PrismaChannelRepository');

                // Get shared Prisma instance from videoService (via uploadVideoUseCase)
                // This prevents creating new connections
                const videoRepo = this.videoService.uploadVideoUseCase.videoRepository;
                savedVideo = await videoRepo.save(video);

                console.log(`✅ Video record created: ${savedVideo.id}`);

                // Update channel video count
                try {
                    const channelRepo = this.videoService.uploadVideoUseCase.channelRepository;
                    const channel = await channelRepo.findByUserId(req.user.id);
                    if (channel) {
                        await channelRepo.update(channel.id, {
                            videoCount: channel.videoCount + 1
                        });
                    }
                } catch (error) {
                    console.error('Failed to update channel video count:', error);
                }

                // Clean up placeholder
                try {
                    if (fs.existsSync(tempPath)) {
                        fs.unlinkSync(tempPath);
                    }
                } catch (e) { }
            } catch (dbError) {
                console.error('Database save error:', dbError);
                throw dbError;
            }

            // Trigger transcoding asynchronously (don't wait for it)
            this.videoService.transcodeVideo(savedVideo.id)
                .then(() => {
                    console.log(`✅ Transcoding complete for video ${savedVideo.id}`);
                })
                .catch(err => {
                    console.error(`❌ Transcoding failed for video ${savedVideo.id}:`, err.message);
                });

            // Clean up session asynchronously
            setImmediate(() => {
                this.chunkUploadService.cleanupSession(uploadId).catch(err => {
                    console.error('Cleanup error:', err);
                });
            });

            // Convert thumbnail URL to server proxy URL
            thumbnailUrl = savedVideo.thumbnailUrl ? this.convertToServerUrl(savedVideo.thumbnailUrl) : null;

            return this.sendJson(res, 201, {
                message: 'Video uploaded successfully',
                video: {
                    id: savedVideo.id,
                    title: savedVideo.title,
                    description: savedVideo.description,
                    playbackUrl: savedVideo.getPlaybackUrl(),
                    thumbnailUrl: thumbnailUrl,
                },
            });
        } catch (error) {
            console.error('Finalize upload error:', error);
            return this.sendJson(res, 500, { error: error.message || 'Failed to finalize upload' });
        }
    }

    /**
     * Get upload session status
     * GET /api/upload/status/:uploadId
     */
    async getUploadStatus(req, res, uploadId) {
        try {
            if (!req.user) {
                return this.sendJson(res, 401, { error: 'Authentication required' });
            }

            const session = await this.chunkUploadService.getSession(uploadId);
            if (!session || session.userId !== req.user.id) {
                return this.sendJson(res, 404, { error: 'Upload session not found' });
            }

            const progress = (session.uploadedChunks.length / session.totalChunks) * 100;

            return this.sendJson(res, 200, {
                uploadId: session.id,
                fileName: session.fileName,
                fileSize: session.fileSize,
                totalChunks: session.totalChunks,
                uploadedChunks: session.uploadedChunks.length,
                progress: Math.round(progress * 10) / 10,
                status: session.status,
                createdAt: session.createdAt,
                expiresAt: session.expiresAt,
            });
        } catch (error) {
            console.error('Get status error:', error);
            return this.sendJson(res, 500, { error: error.message || 'Failed to get upload status' });
        }
    }

    /**
     * Cancel upload session
     * DELETE /api/upload/:uploadId
     */
    async cancelUpload(req, res, uploadId) {
        try {
            if (!req.user) {
                return this.sendJson(res, 401, { error: 'Authentication required' });
            }

            const session = await this.chunkUploadService.getSession(uploadId);
            if (!session || session.userId !== req.user.id) {
                return this.sendJson(res, 404, { error: 'Upload session not found' });
            }

            // Abort B2 multipart upload to free storage
            const b2UploadId = session.metadata?.b2UploadId;
            const storageKey = session.metadata?.storageKey;

            if (b2UploadId && storageKey) {
                try {
                    console.log(`🗑️  Aborting B2 multipart upload: ${storageKey}`);
                    await this.storageRepository.abortMultipartUpload(storageKey, b2UploadId);
                    console.log(`✅ B2 multipart upload aborted`);
                } catch (abortError) {
                    console.error('Failed to abort B2 multipart upload:', abortError.message);
                    // Continue anyway to clean up session
                }
            }

            // Clean up session
            await this.chunkUploadService.cancelSession(uploadId);
            await this.chunkUploadService.cleanupSession(uploadId);

            return this.sendJson(res, 200, { message: 'Upload cancelled successfully' });
        } catch (error) {
            console.error('Cancel upload error:', error);
            return this.sendJson(res, 500, { error: error.message || 'Failed to cancel upload' });
        }
    }

    /**
     * Calculate SHA-256 hash of file
     */
    async calculateFileHash(filePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = fs.createReadStream(filePath);

            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }

    /**
     * Convert B2/CDN URLs to server proxy URLs for private buckets
     */
    convertToServerUrl(url) {
        if (!url) return null;

        // If it's already a server URL, return as-is
        if (url.includes('/video?file=')) {
            return url;
        }

        // Extract filename from B2/CDN URL
        const match = url.match(/\/([^/]+\.(svg|jpg|jpeg|png|gif|webp))$/i);
        if (match) {
            const filename = match[1];
            // Use relative path - works in any environment
            return `/video?file=${filename}`;
        }

        return url;
    }
}

module.exports = ChunkUploadController;

