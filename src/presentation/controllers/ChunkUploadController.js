// @ts-check
// Presentation: ChunkUploadController
// Handles chunked file uploads for large videos

const { formidable } = require('formidable');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class ChunkUploadController {
    constructor(chunkUploadService) {
        this.chunkUploadService = chunkUploadService;
    }

    /**
     * Initialize a new chunked upload session
     * POST /api/upload/init
     */
    async initializeUpload(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const { fileName, fileSize, mimeType, totalChunks, title, description } = req.body;

            // Validation
            if (!fileName || !fileSize || !mimeType || !totalChunks) {
                return res.status(400).json({ error: 'Missing required fields' });
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
                return res.status(400).json({ error: 'Invalid file type' });
            }

            // Validate file size (10GB max)
            const maxSize = 10 * 1024 * 1024 * 1024;
            if (fileSize > maxSize) {
                return res.status(400).json({ error: 'File size exceeds 10GB limit' });
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
                console.log(`Resuming upload session ${session.id}`);
            } else {
                // Create new session
                session = await this.chunkUploadService.createSession({
                    userId: req.user.id,
                    fileName,
                    fileSize,
                    mimeType,
                    totalChunks,
                    metadata: { title, description },
                });
                console.log(`Created new upload session ${session.id}`);
            }

            res.status(200).json({
                uploadId: session.id,
                resumableChunks: session.uploadedChunks || [],
                chunkSize: 5 * 1024 * 1024, // 5MB
                expiresAt: session.expiresAt,
            });
        } catch (error) {
            console.error('Initialize upload error:', error);
            res.status(500).json({ error: error.message || 'Failed to initialize upload' });
        }
    }

    /**
     * Upload a single chunk
     * POST /api/upload/chunk
     */
    async uploadChunk(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const uploadDir = path.join(process.cwd(), 'videos', 'temp', 'chunks');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const form = formidable({
                uploadDir,
                keepExtensions: false,
                maxFileSize: 10 * 1024 * 1024, // 10MB per chunk
            });

            const [fields, files] = await form.parse(req);

            const chunkFile = files.chunk?.[0];
            const chunkIndex = parseInt(fields.chunkIndex?.[0]);
            const chunkHash = fields.chunkHash?.[0];
            const uploadId = fields.uploadId?.[0];
            const totalChunks = parseInt(fields.totalChunks?.[0]);

            if (!chunkFile || isNaN(chunkIndex) || !chunkHash || !uploadId) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Verify session exists and belongs to user
            const session = await this.chunkUploadService.getSession(uploadId);
            if (!session || session.userId !== req.user.id) {
                return res.status(404).json({ error: 'Upload session not found' });
            }

            // Verify chunk hash
            const calculatedHash = await this.calculateFileHash(chunkFile.filepath);
            if (calculatedHash !== chunkHash) {
                fs.unlinkSync(chunkFile.filepath);
                return res.status(400).json({ error: 'Chunk hash mismatch - corrupted data' });
            }

            // Store chunk with proper naming
            const chunkDir = path.join(process.cwd(), 'videos', 'temp', 'chunks', uploadId);
            if (!fs.existsSync(chunkDir)) {
                fs.mkdirSync(chunkDir, { recursive: true });
            }

            const chunkPath = path.join(chunkDir, `chunk_${chunkIndex.toString().padStart(6, '0')}`);
            fs.renameSync(chunkFile.filepath, chunkPath);

            // Update session
            await this.chunkUploadService.markChunkUploaded(uploadId, chunkIndex);

            const updatedSession = await this.chunkUploadService.getSession(uploadId);
            const progress = (updatedSession.uploadedChunks.length / totalChunks) * 100;

            res.status(200).json({
                chunkIndex,
                received: true,
                hashMatch: true,
                uploadedChunks: updatedSession.uploadedChunks.length,
                totalChunks,
                progress: Math.round(progress * 10) / 10,
            });
        } catch (error) {
            console.error('Upload chunk error:', error);
            res.status(500).json({ error: error.message || 'Failed to upload chunk' });
        }
    }

    /**
     * Finalize upload by merging chunks
     * POST /api/upload/finalize
     */
    async finalizeUpload(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const { uploadId, fileName, title, description } = req.body;

            if (!uploadId || !fileName) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Verify session
            const session = await this.chunkUploadService.getSession(uploadId);
            if (!session || session.userId !== req.user.id) {
                return res.status(404).json({ error: 'Upload session not found' });
            }

            // Verify all chunks uploaded
            if (session.uploadedChunks.length !== session.totalChunks) {
                return res.status(400).json({
                    error: 'Not all chunks uploaded',
                    uploaded: session.uploadedChunks.length,
                    total: session.totalChunks,
                });
            }

            // Merge chunks into final file
            const mergedFilePath = await this.chunkUploadService.mergeChunks(uploadId, fileName);

            // Upload to storage and create video record (use existing VideoService)
            const videoData = {
                filePath: mergedFilePath,
                fileName: session.fileName,
                title: title || session.metadata?.title || session.fileName,
                description: description || session.metadata?.description || '',
                mimeType: session.mimeType,
                sizeBytes: session.fileSize,
                userId: req.user.id,
            };

            // This would integrate with your existing VideoService
            // For now, return success with file info
            res.status(200).json({
                message: 'Upload completed successfully',
                file: {
                    path: mergedFilePath,
                    size: session.fileSize,
                    mimeType: session.mimeType,
                },
                nextStep: 'Process with VideoService',
            });

            // Clean up session and chunks asynchronously
            this.chunkUploadService.cleanupSession(uploadId).catch(err => {
                console.error('Cleanup error:', err);
            });
        } catch (error) {
            console.error('Finalize upload error:', error);
            res.status(500).json({ error: error.message || 'Failed to finalize upload' });
        }
    }

    /**
     * Get upload session status
     * GET /api/upload/status/:uploadId
     */
    async getUploadStatus(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const { uploadId } = req.params;

            const session = await this.chunkUploadService.getSession(uploadId);
            if (!session || session.userId !== req.user.id) {
                return res.status(404).json({ error: 'Upload session not found' });
            }

            const progress = (session.uploadedChunks.length / session.totalChunks) * 100;

            res.status(200).json({
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
            res.status(500).json({ error: error.message || 'Failed to get upload status' });
        }
    }

    /**
     * Cancel upload session
     * DELETE /api/upload/:uploadId
     */
    async cancelUpload(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const { uploadId } = req.params;

            const session = await this.chunkUploadService.getSession(uploadId);
            if (!session || session.userId !== req.user.id) {
                return res.status(404).json({ error: 'Upload session not found' });
            }

            await this.chunkUploadService.cancelSession(uploadId);
            await this.chunkUploadService.cleanupSession(uploadId);

            res.status(200).json({ message: 'Upload cancelled successfully' });
        } catch (error) {
            console.error('Cancel upload error:', error);
            res.status(500).json({ error: error.message || 'Failed to cancel upload' });
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
}

module.exports = ChunkUploadController;

