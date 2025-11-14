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
        // Check if headers already sent
        if (res.headersSent) {
            console.warn('⚠️  Attempted to send response after headers were already sent');
            return;
        }

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
            let { fileName, fileSize, mimeType, totalChunks, title, description } = JSON.parse(body);

            if (!fileName || !fileSize || !mimeType || !totalChunks) {
                return this.sendJson(res, 400, { error: 'Missing required fields' });
            }

            const allowedMimeTypes = [
                'video/mp4',
                'video/webm',
                'video/quicktime',
                'video/x-msvideo',    // AVI (standard)
                'video/avi',          // AVI (alternative)
                'video/msvideo',      // AVI (older)
                'video/mpeg',
                'video/ogg',
                'video/x-matroska',   // MKV
                'video/mkv',          // MKV alternative MIME
            ];

            // Fallback: Check file extension if MIME type is missing or generic
            const fileExtension = fileName.toLowerCase().split('.').pop();
            const videoExtensions = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'mpeg', 'mpg', 'ogg'];

            // Normalize MIME type from extension if needed
            if (!mimeType || mimeType === 'application/octet-stream' || !allowedMimeTypes.includes(mimeType)) {
                const mimeTypeMap = {
                    'avi': 'video/x-msvideo',
                    'mp4': 'video/mp4',
                    'webm': 'video/webm',
                    'mov': 'video/quicktime',
                    'mkv': 'video/x-matroska',
                    'mpeg': 'video/mpeg',
                    'mpg': 'video/mpeg',
                    'ogg': 'video/ogg'
                };
                if (mimeTypeMap[fileExtension]) {
                    const originalMimeType = mimeType;
                    mimeType = mimeTypeMap[fileExtension];
                    console.log(`📝 Normalized MIME type: ${originalMimeType || 'empty'} → ${mimeType} (from extension .${fileExtension})`);
                }
            }

            // Allow if MIME type is in allowed list OR file extension is valid video format
            const isValidMimeType = allowedMimeTypes.includes(mimeType);
            const isValidExtension = videoExtensions.includes(fileExtension);
            const isGenericTypeForVideo = (!mimeType || mimeType === 'application/octet-stream') && isValidExtension;

            if (!isValidMimeType && !isGenericTypeForVideo) {
                console.log(`❌ Invalid file type: ${mimeType || 'unknown'} (extension: .${fileExtension || 'unknown'})`);
                return this.sendJson(res, 400, {
                    error: 'Invalid file type',
                    details: `MIME type: ${mimeType || 'unknown'}, Extension: .${fileExtension || 'unknown'}`
                });
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
            try {
                console.log(`💾 Marking chunk ${chunkIndex} as uploaded for session ${uploadId}...`);
                await this.chunkUploadService.markChunkUploaded(uploadId, chunkIndex, {
                    etag: b2Part.etag,
                    partNumber: b2Part.partNumber,
                });
                console.log(`✅ Chunk ${chunkIndex} marked as uploaded successfully`);
            } catch (markError) {
                console.error(`❌ Failed to mark chunk ${chunkIndex} as uploaded:`, markError);
                // Re-throw to ensure error is handled
                throw markError;
            }

            // Verify chunk was saved by reading session
            const updatedSession = await this.chunkUploadService.getSession(uploadId);
            if (!updatedSession.uploadedChunks.includes(chunkIndex)) {
                console.error(`⚠️  WARNING: Chunk ${chunkIndex} was not found in session after marking as uploaded!`);
                console.error(`   Session has chunks: [${updatedSession.uploadedChunks.join(', ')}]`);
            }

            const progress = (updatedSession.uploadedChunks.length / totalChunks) * 100;

            const elapsedMs = Date.now() - startTime;

            console.log(`📊 Chunk ${chunkIndex} upload complete: ${updatedSession.uploadedChunks.length}/${totalChunks} chunks uploaded`);

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

            // Enhanced logging for debugging
            console.log(`🔍 Finalize check for ${uploadId}:`, {
                uploadedChunks: session.uploadedChunks.length,
                totalChunks: session.totalChunks,
                uploadedChunksArray: session.uploadedChunks,
                b2PartsCount: session.metadata?.b2Parts?.length || 0
            });

            if (session.uploadedChunks.length !== session.totalChunks) {
                const missingCount = session.totalChunks - session.uploadedChunks.length;
                const uploadedSet = new Set(session.uploadedChunks);
                const missingChunks = [];
                for (let i = 0; i < session.totalChunks; i++) {
                    if (!uploadedSet.has(i)) {
                        missingChunks.push(i);
                    }
                }

                console.error(`❌ Chunk count mismatch:`, {
                    uploaded: session.uploadedChunks.length,
                    total: session.totalChunks,
                    missing: missingCount,
                    missingChunkIndices: missingChunks.slice(0, 20) // Log first 20 missing chunks
                });

                return this.sendJson(res, 400, {
                    error: 'Not all chunks uploaded',
                    uploaded: session.uploadedChunks.length,
                    total: session.totalChunks,
                    missing: missingCount,
                    missingChunkIndices: missingChunks
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

            // Thumbnail generation will be handled by the queue AFTER transcoding
            let thumbnailUrl = null;

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
                thumbnailUrl: null, // Will be generated during transcoding
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

            // Processing flow:
            // 1. If MOV → Queue conversion job (converts MOV to WebM)
            // 2. After conversion (or if not MOV) → Queue transcoding job (creates quality variants)
            // 3. After transcoding → Queue thumbnail job if needed

            const isMOV = savedVideo.mimeType === 'video/quicktime' ||
                savedVideo.fileName.toLowerCase().endsWith('.mov');

            try {
                if (isMOV) {
                    // Step 1: Convert MOV to WebM first
                    await this.queueManager.addMovConversionJob({
                        videoId: savedVideo.id,
                        storageKey: savedVideo.storageKey,
                        fileName: savedVideo.fileName,
                        mimeType: savedVideo.mimeType,
                    });
                    console.log(`📤 MOV conversion job queued for video ${savedVideo.id} (will transcode after conversion)`);
                } else {
                    // Not MOV, proceed directly to transcoding
                    await this.queueManager.addTranscodingJob({
                        videoId: savedVideo.id,
                        storageKey: savedVideo.storageKey,
                        userId: savedVideo.userId,
                    });
                    console.log(`📤 Transcoding job queued for video ${savedVideo.id}`);
                }
            } catch (queueError) {
                console.error(`❌ Failed to queue processing job:`, queueError.message);
                // Set video to ready so users can still watch the original file
                try {
                    savedVideo.status = 'ready';
                    await this.videoService.uploadVideoUseCase.videoRepository.update(savedVideo);
                } catch (updateError) {
                    console.error(`❌ Failed to update video status:`, updateError.message);
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
                fileSize: typeof session.fileSize === 'bigint' ? session.fileSize.toString() : String(session.fileSize || 0),
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

