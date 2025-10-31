// Direct Upload Controller - Browser uploads directly to B2
const { v4: uuidv4 } = require('uuid');
const path = require('path');

class DirectUploadController {
    constructor(storageRepository) {
        this.storageRepository = storageRepository;
    }

    sendJson(res, statusCode, data) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }

    /**
     * Initialize direct upload - returns pre-signed URLs for each chunk
     * POST /api/upload/direct/init
     */
    async initializeDirectUpload(req, res) {
        try {
            if (!req.user) {
                return this.sendJson(res, 401, { error: 'Authentication required' });
            }

            let body = '';
            for await (const chunk of req) {
                body += chunk.toString();
            }
            const { fileName, fileSize, mimeType, totalChunks } = JSON.parse(body);

            if (!fileName || !fileSize || !mimeType || !totalChunks) {
                return this.sendJson(res, 400, { error: 'Missing required fields' });
            }

            const ext = path.extname(fileName);
            const videoId = uuidv4();
            const storageKey = `${videoId}${ext}`;

            // Start B2 multipart upload
            const { uploadId } = await this.storageRepository.startMultipartUpload(storageKey, {
                contentType: mimeType,
                originalName: fileName,
            });

            console.log(`✅ Direct upload initialized: ${uploadId}`);

            return this.sendJson(res, 200, {
                uploadId,
                videoId,
                storageKey,
                totalChunks,
                // Note: Pre-signed URLs will be generated per-chunk on demand
                message: 'Ready for direct upload'
            });

        } catch (error) {
            console.error('Initialize direct upload error:', error);
            return this.sendJson(res, 500, { error: error.message });
        }
    }

    /**
     * Get pre-signed URL for a specific chunk
     * POST /api/upload/direct/url
     */
    async getUploadUrl(req, res) {
        try {
            if (!req.user) {
                return this.sendJson(res, 401, { error: 'Authentication required' });
            }

            let body = '';
            for await (const chunk of req) {
                body += chunk.toString();
            }
            const { uploadId, storageKey, partNumber } = JSON.parse(body);

            if (!uploadId || !storageKey || !partNumber) {
                return this.sendJson(res, 400, { error: 'Missing required fields' });
            }

            // Get pre-signed URL from B2 for this part
            const uploadUrl = await this.storageRepository.getPartUploadUrl(
                storageKey,
                uploadId,
                partNumber
            );

            return this.sendJson(res, 200, {
                uploadUrl,
                partNumber,
                expiresIn: 3600 // 1 hour
            });

        } catch (error) {
            console.error('Get upload URL error:', error);
            return this.sendJson(res, 500, { error: error.message });
        }
    }

    /**
     * Finalize direct upload
     * POST /api/upload/direct/finalize
     */
    async finalizeDirectUpload(req, res) {
        try {
            if (!req.user) {
                return this.sendJson(res, 401, { error: 'Authentication required' });
            }

            let body = '';
            for await (const chunk of req) {
                body += chunk.toString();
            }
            const { uploadId, storageKey, videoId, parts, title, description } = JSON.parse(body);

            if (!uploadId || !storageKey || !videoId || !parts) {
                return this.sendJson(res, 400, { error: 'Missing required fields' });
            }

            // Complete multipart upload on B2
            const { storageUrl, cdnUrl } = await this.storageRepository.completeMultipartUpload(
                storageKey,
                uploadId,
                parts
            );

            console.log(`✅ Direct upload completed: ${videoId}`);

            // Create video entity (similar to regular upload)
            // ... (same video creation logic as ChunkUploadController)

            return this.sendJson(res, 201, {
                message: 'Direct upload complete',
                video: {
                    id: videoId,
                    title: title || 'Untitled',
                    storageUrl,
                    cdnUrl
                }
            });

        } catch (error) {
            console.error('Finalize direct upload error:', error);
            return this.sendJson(res, 500, { error: error.message });
        }
    }
}

module.exports = DirectUploadController;

