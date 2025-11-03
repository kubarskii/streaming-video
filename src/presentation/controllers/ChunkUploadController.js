// @ts-check
// Presentation: ChunkUploadController
// Optimized version - streams directly to storage without disk writes

const { formidable } = require('formidable');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const stream = require('stream');
const { promisify } = require('util');
const pipeline = promisify(stream.pipeline);
const { getQueueManager } = require('../../infrastructure/queue/QueueManager');

class ChunkUploadController {
    constructor(chunkUploadService, videoService, storageRepository) {
        this.chunkUploadService = chunkUploadService;
        this.videoService = videoService;
        this.storageRepository = storageRepository;
        this.queueManager = getQueueManager();
    }

    /**
     * Helper to send JSON response
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

            let body = '';
            for await (const chunk of req) {
                body += chunk.toString();
            }
            const { fileName, fileSize, mimeType, totalChunks, title, description } = JSON.parse(body);

            if (!fileName || !fileSize || !mimeType || !totalChunks) {
                return this.sendJson(res, 400, { error: 'Missing required fields' });
            }

            const allowedMimeTypes = [
                'video/mp4',
                'video/webm',
                'video/quicktime',
                'video/x-msvideo',
                'video/mpeg',
                'video/ogg',
                'video/x-matroska',  // MKV
                'video/mkv',         // MKV alternative MIME
            ];
            if (!allowedMimeTypes.includes(mimeType)) {
                return this.sendJson(res, 400, { error: 'Invalid file type' });
            }

            const maxSize = 10 * 1024 * 1024 * 1024; // 10GB
            if (fileSize > maxSize) {
                return this.sendJson(res, 400, { error: 'File size exceeds 10GB limit' });
            }

            const existingSession = await this.chunkUploadService.findIncompleteSession(
                req.user.id,
                fileName,
                fileSize
            );

            let session;
            if (existingSession) {
                session = existingSession;
            } else {
                const ext = path.extname(fileName);
                const videoId = uuidv4();
                const storageKey = `${videoId}${ext}`;

                const b2Upload = await this.storageRepository.startMultipartUpload(storageKey, {
                    contentType: mimeType,
                    originalName: fileName,
                });

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
            }

            return this.sendJson(res, 200, {
                uploadId: session.id,
                resumableChunks: session.uploadedChunks || [],
                chunkSize: 5 * 1024 * 1024,
                expiresAt: session.expiresAt,
            });
        } catch (error) {
            console.error('Initialize upload error:', error);
            return this.sendJson(res, 500, { error: error.message || 'Failed to initialize upload' });
        }
    }

    /**
     * Upload a single chunk - OPTIMIZED VERSION
     * NO DISK WRITES - streams directly to B2
     * POST /api/upload/chunk
     */
    async uploadChunk(req, res) {
        const startTime = Date.now();
        let chunkBuffer = null;

        try {
            if (!req.user) {
                return this.sendJson(res, 401, { error: 'Authentication required' });
            }

            // Parse formdata directly into memory (no disk writes!)
            const form = formidable({
                maxFileSize: 25 * 1024 * 1024, // 25MB per chunk
                multiples: false,
                // Custom file writer that stores in memory
                fileWriteStreamHandler: (file) => {
                    const chunks = [];
                    let totalSize = 0;

                    class MemoryWriteStream extends stream.Writable {
                        constructor() {
                            super();
                            this.buffer = null;
                            this.size = 0;
                        }

                        _write(chunk, encoding, callback) {
                            chunks.push(chunk);
                            totalSize += chunk.length;

                            // Safety check: prevent memory overflow
                            if (totalSize > 25 * 1024 * 1024) {
                                callback(new Error('Chunk size exceeds maximum'));
                                return;
                            }

                            callback();
                        }

                        _final(callback) {
                            this.buffer = Buffer.concat(chunks);
                            this.size = totalSize;
                            // Attach buffer to file object so it's accessible after parsing
                            file.buffer = this.buffer;
                            file.size = this.size;
                            callback();
                        }
                    }

                    return new MemoryWriteStream();
                }
            });

            let fields, files;
            try {
                [fields, files] = await form.parse(req);
            } catch (parseError) {
                console.error('Formidable parse error:', parseError);
                return this.sendJson(res, 400, { error: 'Failed to parse chunk data: ' + parseError.message });
            }

            // Extract chunk buffer from custom stream
            const chunkFile = files.chunk?.[0];
            if (!chunkFile) {
                console.error('No chunk file in request. Available fields:', Object.keys(files));
                return this.sendJson(res, 400, { error: 'Missing chunk file in upload' });
            }

            if (!chunkFile.buffer) {
                console.error('Chunk file has no buffer. File props:', Object.keys(chunkFile));
                return this.sendJson(res, 400, { error: 'Chunk data was not properly buffered' });
            }

            chunkBuffer = chunkFile.buffer;
            const chunkIndex = parseInt(fields.chunkIndex?.[0]);
            const chunkHash = fields.chunkHash?.[0];
            const uploadId = fields.uploadId?.[0];
            const totalChunks = parseInt(fields.totalChunks?.[0]);

            if (isNaN(chunkIndex) || !chunkHash || !uploadId) {
                console.error('Missing required fields:', { chunkIndex, chunkHash, uploadId });
                // Clear buffer
                chunkBuffer = null;
                return this.sendJson(res, 400, { error: 'Missing required fields' });
            }

            // Verify session
            const session = await this.chunkUploadService.getSession(uploadId);
            if (!session || session.userId !== req.user.id) {
                chunkBuffer = null;
                return this.sendJson(res, 404, { error: 'Upload session not found' });
            }

            // Verify chunk hash (on buffer)
            const calculatedHash = crypto
                .createHash('sha256')
                .update(chunkBuffer)
                .digest('hex');

            if (calculatedHash !== chunkHash) {
                chunkBuffer = null;
                return this.sendJson(res, 400, { error: 'Chunk hash mismatch - corrupted data' });
            }

            // Get B2 metadata
            const b2UploadId = session.metadata?.b2UploadId;
            const storageKey = session.metadata?.storageKey;

            if (!b2UploadId || !storageKey) {
                chunkBuffer = null;
                return this.sendJson(res, 500, { error: 'Missing B2 upload metadata' });
            }

            // Upload chunk directly to B2 from memory (NO DISK WRITE!)
            let b2Part;
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount < maxRetries) {
                try {
                    b2Part = await this.storageRepository.uploadPart(
                        storageKey,
                        b2UploadId,
                        chunkIndex + 1,
                        chunkBuffer // Direct buffer upload - no disk I/O!
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

            // Clear buffer immediately after upload
            chunkBuffer = null;

            // Update session with B2 part info
            await this.chunkUploadService.markChunkUploaded(uploadId, chunkIndex, {
                etag: b2Part.etag,
                partNumber: b2Part.partNumber,
            });

            const updatedSession = await this.chunkUploadService.getSession(uploadId);
            const progress = (updatedSession.uploadedChunks.length / totalChunks) * 100;

            const elapsedMs = Date.now() - startTime;

            return this.sendJson(res, 200, {
                chunkIndex,
                received: true,
                hashMatch: true,
                uploadedChunks: updatedSession.uploadedChunks.length,
                totalChunks,
                progress: Math.round(progress * 10) / 10,
                uploadTimeMs: elapsedMs
            });

        } catch (error) {
            console.error('Upload chunk error:', error);
            console.error('Error stack:', error.stack);

            // Clear buffer on error
            chunkBuffer = null;

            return this.sendJson(res, 500, { error: error.message || 'Failed to upload chunk' });
        } finally {
            // Force garbage collection hint
            if (global.gc) {
                global.gc();
            }
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

            let body = '';
            for await (const chunk of req) {
                body += chunk.toString();
            }
            const { uploadId, fileName, title, description } = JSON.parse(body);

            if (!uploadId || !fileName) {
                return this.sendJson(res, 400, { error: 'Missing required fields' });
            }

            const session = await this.chunkUploadService.getSession(uploadId);
            if (!session || session.userId !== req.user.id) {
                return this.sendJson(res, 404, { error: 'Upload session not found' });
            }

            if (session.uploadedChunks.length !== session.totalChunks) {
                return this.sendJson(res, 400, {
                    error: 'Not all chunks uploaded',
                    uploaded: session.uploadedChunks.length,
                    total: session.totalChunks,
                });
            }

            const b2UploadId = session.metadata?.b2UploadId;
            const storageKey = session.metadata?.storageKey;
            const videoId = session.metadata?.videoId;
            const b2Parts = session.metadata?.b2Parts || [];

            if (!b2UploadId || !storageKey || !videoId) {
                return this.sendJson(res, 500, { error: 'Missing B2 upload metadata' });
            }

            // Sort parts by part number
            const sortedParts = b2Parts.sort((a, b) => a.partNumber - b.partNumber);

            // Complete B2 multipart upload
            const { storageUrl, cdnUrl } = await this.storageRepository.completeMultipartUpload(
                storageKey,
                b2UploadId,
                sortedParts
            );

            // Generate thumbnail (same as original controller)
            let thumbnailUrl = null;
            const tempVideoPath = path.join(process.cwd(), 'videos', 'temp', `temp_${videoId}${path.extname(session.fileName)}`);

            try {

                const headCommand = new (require('@aws-sdk/client-s3').HeadObjectCommand)({
                    Bucket: this.storageRepository.bucket,
                    Key: storageKey,
                });
                const headResponse = await this.storageRepository.client.send(headCommand);
                const totalSize = headResponse.ContentLength;

                const downloadSize = Math.min(50 * 1024 * 1024, totalSize);
                const rangeEnd = downloadSize - 1;

                const { stream: videoStream } = await this.storageRepository.getObjectStream(
                    storageKey,
                    `bytes=0-${rangeEnd}`
                );
                const writeStream = fs.createWriteStream(tempVideoPath);

                await pipeline(videoStream, writeStream);

                const ThumbnailGenerator = require('../../infrastructure/media/ThumbnailGenerator');
                const thumbnailGenerator = new ThumbnailGenerator();
                const thumbnailTempPath = path.join(process.cwd(), 'videos', 'temp', `thumb_${videoId}.jpg`);

                let extractTimestamp = '00:00:02.000';
                try {
                    const fullVideoDuration = await thumbnailGenerator.getVideoDuration(tempVideoPath);
                    if (fullVideoDuration && fullVideoDuration > 0) {
                        const estimatedBitrate = (totalSize * 8) / fullVideoDuration;
                        const bytesDownloaded = fs.statSync(tempVideoPath).size;
                        const secondsAvailable = (bytesDownloaded * 8) / estimatedBitrate;

                        if (secondsAvailable > 20) {
                            const safeMiddle = secondsAvailable * 0.5 * 0.8;
                            extractTimestamp = thumbnailGenerator.formatTimestamp(Math.min(safeMiddle, secondsAvailable - 5));
                        } else if (secondsAvailable > 5) {
                            extractTimestamp = '00:00:03.000';
                        }
                    }
                } catch (durationError) {
                    console.warn('⚠️  Could not calculate safe timestamp');
                }

                const generatedThumbnailPath = await thumbnailGenerator.generateFromVideo(
                    tempVideoPath,
                    thumbnailTempPath,
                    { size: '640x360', timestamp: extractTimestamp }
                );

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

                // Clean up temp files
                try {
                    if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
                    if (fs.existsSync(generatedThumbnailPath)) fs.unlinkSync(generatedThumbnailPath);
                } catch (e) { }

            } catch (thumbnailError) {
                console.error('❌ Failed to generate thumbnail:', thumbnailError.message);
            }

            // Create video entity
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
                status: VideoStatus.PROCESSING, // Start as processing since transcoding will be queued
                uploadedAt: new Date(),
                updatedAt: new Date(),
                userId: req.user.id,
                thumbnailUrl: thumbnailUrl,
            });

            // Save to database
            let savedVideo;
            try {
                const videoRepo = this.videoService.uploadVideoUseCase.videoRepository;
                savedVideo = await videoRepo.save(video);
                console.log(`✅ Video saved to DB with ID: ${savedVideo.id}`);

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
            } catch (dbError) {
                console.error('Database save error:', dbError);
                throw dbError;
            }

            // Add transcoding job to queue (non-blocking)
            try {
                await this.queueManager.addTranscodingJob({
                    videoId: savedVideo.id,
                    storageKey: savedVideo.storageKey,
                    userId: savedVideo.userId,
                });
            } catch (queueError) {
                console.error(`❌ Failed to queue transcoding job:`, queueError.message);
                // Set video to ready so users can still watch the original file
                try {
                    savedVideo.status = 'ready';
                    await this.videoService.uploadVideoUseCase.videoRepository.update(savedVideo);
                } catch (updateError) {
                    console.error(`❌ Failed to update video status:`, updateError.message);
                }
            }

            // If no thumbnail, queue thumbnail generation
            if (!savedVideo.thumbnailUrl) {
                try {
                    await this.queueManager.addThumbnailJob({
                        videoId: savedVideo.id,
                        storageKey: savedVideo.storageKey,
                        videoPath: '', // Video is in B2 storage, will be downloaded by worker
                    });
                } catch (queueError) {
                    console.error(`❌ Failed to queue thumbnail job:`, queueError.message);
                }
            }

            // If video is MOV format, queue conversion to WebM
            const isMOV = savedVideo.mimeType === 'video/quicktime' ||
                savedVideo.fileName.toLowerCase().endsWith('.mov');

            if (isMOV) {
                try {
                    await this.queueManager.addMovConversionJob({
                        videoId: savedVideo.id,
                        storageKey: savedVideo.storageKey,
                        fileName: savedVideo.fileName,
                        mimeType: savedVideo.mimeType,
                    });
                    console.log(`📤 MOV conversion job queued for video ${savedVideo.id}`);
                } catch (queueError) {
                    console.error(`❌ Failed to queue MOV conversion job:`, queueError.message);
                }
            }

            // Clean up session
            setImmediate(() => {
                this.chunkUploadService.cleanupSession(uploadId).catch(err => {
                    console.error('Cleanup error:', err);
                });
            });

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

            const b2UploadId = session.metadata?.b2UploadId;
            const storageKey = session.metadata?.storageKey;

            if (b2UploadId && storageKey) {
                try {
                    await this.storageRepository.abortMultipartUpload(storageKey, b2UploadId);
                } catch (abortError) {
                    console.error('Failed to abort B2 multipart upload:', abortError.message);
                }
            }

            await this.chunkUploadService.cancelSession(uploadId);
            await this.chunkUploadService.cleanupSession(uploadId);

            return this.sendJson(res, 200, { message: 'Upload cancelled successfully' });
        } catch (error) {
            console.error('Cancel upload error:', error);
            return this.sendJson(res, 500, { error: error.message || 'Failed to cancel upload' });
        }
    }

    /**
     * Convert B2/CDN URLs to server proxy URLs
     */
    convertToServerUrl(url) {
        if (!url) return null;

        if (url.includes('/video?file=')) {
            return url;
        }

        const match = url.match(/\/([^/]+\.(svg|jpg|jpeg|png|gif|webp))$/i);
        if (match) {
            const filename = match[1];
            return `/video?file=${filename}`;
        }

        return url;
    }
}

module.exports = ChunkUploadController;

