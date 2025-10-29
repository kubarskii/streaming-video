// @ts-check
// Infrastructure: B2StorageRepository
// Implementation of IStorageRepository for Backblaze B2

const {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
    GetObjectCommand,
    CreateMultipartUploadCommand,
    UploadPartCommand,
    CompleteMultipartUploadCommand,
    AbortMultipartUploadCommand
} = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const IStorageRepository = require('../../domain/repositories/IStorageRepository');

class B2StorageRepository extends IStorageRepository {
    constructor(config) {
        super();
        this.bucket = config.bucket;
        this.cdnBaseUrl = config.cdnBaseUrl;
        this.endpoint = config.endpoint; // Store endpoint URL for direct URL construction

        this.client = new S3Client({
            endpoint: config.endpoint,
            region: config.region,
            credentials: {
                accessKeyId: config.keyId,
                secretAccessKey: config.keySecret,
            },
        });
    }

    // Sanitize metadata values to only include valid ASCII characters
    sanitizeMetadata(value) {
        if (!value) return '';
        // Remove or replace invalid characters for HTTP headers
        // Only allow ASCII printable characters (32-126)
        return value.replace(/[^\x20-\x7E]/g, '_');
    }

    async upload(filePath, storageKey, metadata = {}) {
        const fileStream = fs.createReadStream(filePath);
        const stats = fs.statSync(filePath);

        const originalName = metadata.originalName || path.basename(filePath);

        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: storageKey,
            Body: fileStream,
            ContentType: metadata.contentType || 'application/octet-stream',
            ContentLength: stats.size,
            Metadata: {
                originalName: this.sanitizeMetadata(originalName),
                uploadedAt: new Date().toISOString(),
            },
        });

        await this.client.send(command);

        const storageUrl = `${this.endpoint}/${this.bucket}/${storageKey}`;
        const cdnUrl = this.cdnBaseUrl ? `${this.cdnBaseUrl}/${storageKey}` : null;

        return { storageUrl, cdnUrl };
    }

    /**
     * Start a multipart upload session
     * @param {string} storageKey - Storage key for the file
     * @param {object} metadata - File metadata
     * @returns {Promise<{uploadId: string, storageKey: string}>}
     */
    async startMultipartUpload(storageKey, metadata = {}) {
        const originalName = metadata.originalName || storageKey;

        const createCommand = new CreateMultipartUploadCommand({
            Bucket: this.bucket,
            Key: storageKey,
            ContentType: metadata.contentType || 'application/octet-stream',
            Metadata: {
                originalName: this.sanitizeMetadata(originalName),
                uploadedAt: new Date().toISOString(),
            },
        });

        const { UploadId } = await this.client.send(createCommand);

        return {
            uploadId: UploadId,
            storageKey: storageKey,
        };
    }

    /**
     * Upload a single part in a multipart upload
     * @param {string} storageKey - Storage key
     * @param {string} uploadId - B2 upload ID
     * @param {number} partNumber - Part number (1-indexed)
     * @param {Buffer} data - Part data
     * @returns {Promise<{etag: string, partNumber: number}>}
     */
    async uploadPart(storageKey, uploadId, partNumber, data) {
        const uploadPartCommand = new UploadPartCommand({
            Bucket: this.bucket,
            Key: storageKey,
            PartNumber: partNumber,
            UploadId: uploadId,
            Body: data,
        });

        const { ETag } = await this.client.send(uploadPartCommand);

        return {
            etag: ETag,
            partNumber: partNumber,
        };
    }

    /**
     * Complete a multipart upload
     * @param {string} storageKey - Storage key
     * @param {string} uploadId - B2 upload ID
     * @param {Array<{etag: string, partNumber: number}>} parts - Uploaded parts
     * @returns {Promise<{storageUrl: string, cdnUrl: string|null}>}
     */
    async completeMultipartUpload(storageKey, uploadId, parts) {
        const completeCommand = new CompleteMultipartUploadCommand({
            Bucket: this.bucket,
            Key: storageKey,
            UploadId: uploadId,
            MultipartUpload: {
                Parts: parts.map(part => ({
                    ETag: part.etag,
                    PartNumber: part.partNumber,
                })),
            },
        });

        await this.client.send(completeCommand);

        const storageUrl = `${this.endpoint}/${this.bucket}/${storageKey}`;
        const cdnUrl = this.cdnBaseUrl ? `${this.cdnBaseUrl}/${storageKey}` : null;

        return { storageUrl, cdnUrl };
    }

    /**
     * Abort a multipart upload
     * @param {string} storageKey - Storage key
     * @param {string} uploadId - B2 upload ID
     */
    async abortMultipartUpload(storageKey, uploadId) {
        const abortCommand = new AbortMultipartUploadCommand({
            Bucket: this.bucket,
            Key: storageKey,
            UploadId: uploadId,
        });

        await this.client.send(abortCommand);
    }

    /**
     * Upload large file using multipart upload (B2 Large File API)
     * Recommended for files > 100MB
     * @param {string} filePath - Path to file
     * @param {string} storageKey - Storage key
     * @param {object} metadata - File metadata
     * @param {object} options - Upload options
     * @returns {Promise<{storageUrl: string, cdnUrl: string|null}>}
     */
    async uploadLargeFile(filePath, storageKey, metadata = {}, options = {}) {
        const stats = fs.statSync(filePath);
        const fileSize = stats.size;

        // Part size: minimum 5MB (B2 requirement), recommended 100MB for large files
        const partSize = options.partSize || Math.max(
            5 * 1024 * 1024, // 5MB minimum
            Math.min(100 * 1024 * 1024, Math.ceil(fileSize / 10000)) // Max 10000 parts
        );

        console.log(`📤 Starting multipart upload for ${storageKey} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`   Part size: ${(partSize / 1024 / 1024).toFixed(2)} MB`);

        const originalName = metadata.originalName || path.basename(filePath);

        // Step 1: Initialize multipart upload
        const createCommand = new CreateMultipartUploadCommand({
            Bucket: this.bucket,
            Key: storageKey,
            ContentType: metadata.contentType || 'application/octet-stream',
            Metadata: {
                originalName: this.sanitizeMetadata(originalName),
                uploadedAt: new Date().toISOString(),
            },
        });

        const { UploadId } = await this.client.send(createCommand);
        console.log(`✅ Multipart upload initiated: ${UploadId}`);

        const uploadedParts = [];
        let partNumber = 1;
        let uploadedBytes = 0;

        try {
            // Step 2: Upload parts
            const fileHandle = fs.openSync(filePath, 'r');

            while (uploadedBytes < fileSize) {
                const remainingBytes = fileSize - uploadedBytes;
                const currentPartSize = Math.min(partSize, remainingBytes);

                // Read part from file
                const buffer = Buffer.alloc(currentPartSize);
                const bytesRead = fs.readSync(fileHandle, buffer, 0, currentPartSize, uploadedBytes);

                if (bytesRead === 0) break;

                // Upload part with retry
                let partUploaded = false;
                let retryCount = 0;
                const maxRetries = 3;

                while (!partUploaded && retryCount < maxRetries) {
                    try {
                        const uploadPartCommand = new UploadPartCommand({
                            Bucket: this.bucket,
                            Key: storageKey,
                            PartNumber: partNumber,
                            UploadId,
                            Body: buffer.slice(0, bytesRead),
                        });

                        const { ETag } = await this.client.send(uploadPartCommand);

                        uploadedParts.push({
                            ETag,
                            PartNumber: partNumber,
                        });

                        partUploaded = true;
                        uploadedBytes += bytesRead;

                        const progress = ((uploadedBytes / fileSize) * 100).toFixed(1);
                        console.log(`   Part ${partNumber} uploaded: ${progress}% (${(uploadedBytes / 1024 / 1024).toFixed(2)} MB / ${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

                    } catch (error) {
                        retryCount++;
                        console.error(`   Part ${partNumber} failed (attempt ${retryCount}/${maxRetries}):`, error.message);

                        if (retryCount === maxRetries) {
                            throw error;
                        }

                        // Wait before retry
                        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                    }
                }

                partNumber++;
            }

            fs.closeSync(fileHandle);

            // Step 3: Complete multipart upload
            const completeCommand = new CompleteMultipartUploadCommand({
                Bucket: this.bucket,
                Key: storageKey,
                UploadId,
                MultipartUpload: {
                    Parts: uploadedParts,
                },
            });

            await this.client.send(completeCommand);
            console.log(`✅ Multipart upload completed: ${storageKey}`);

            const storageUrl = `${this.endpoint}/${this.bucket}/${storageKey}`;
            const cdnUrl = this.cdnBaseUrl ? `${this.cdnBaseUrl}/${storageKey}` : null;

            return { storageUrl, cdnUrl };

        } catch (error) {
            // Abort multipart upload on error
            console.error(`❌ Multipart upload failed, aborting:`, error.message);

            try {
                const abortCommand = new AbortMultipartUploadCommand({
                    Bucket: this.bucket,
                    Key: storageKey,
                    UploadId,
                });
                await this.client.send(abortCommand);
                console.log(`🗑️  Aborted multipart upload: ${UploadId}`);
            } catch (abortError) {
                console.error(`Failed to abort multipart upload:`, abortError.message);
            }

            throw error;
        }
    }

    async uploadBuffer(buffer, storageKey, metadata = {}) {
        const originalName = metadata.originalName || storageKey;

        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: storageKey,
            Body: buffer,
            ContentType: metadata.contentType || 'application/octet-stream',
            ContentLength: buffer.length,
            Metadata: {
                originalName: this.sanitizeMetadata(originalName),
                uploadedAt: new Date().toISOString(),
            },
        });

        await this.client.send(command);

        const storageUrl = `${this.endpoint}/${this.bucket}/${storageKey}`;
        const cdnUrl = this.cdnBaseUrl ? `${this.cdnBaseUrl}/${storageKey}` : null;

        return { storageUrl, cdnUrl };
    }

    async getUrl(storageKey, options = {}) {
        // If CDN is configured, use CDN URL (public access via Cloudflare)
        if (this.cdnBaseUrl) {
            return `${this.cdnBaseUrl}/${storageKey}`;
        }

        // Otherwise use direct B2 URL
        return `${this.endpoint}/${this.bucket}/${storageKey}`;
    }

    async delete(storageKey) {
        try {
            // Note: With B2 versioning enabled, this creates a "hide marker"
            // The file is hidden but not permanently deleted
            // To permanently delete, you need to:
            // 1. Configure lifecycle rules in B2 to clean up hidden files, OR
            // 2. Manually delete all versions using B2 native API

            const command = new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: storageKey,
            });

            await this.client.send(command);
            console.log(`Successfully deleted from B2: ${storageKey} (hidden, not permanently deleted if versioning enabled)`);
            return true;
        } catch (error) {
            // If file doesn't exist (NoSuchKey), consider it already deleted (success)
            if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') {
                console.log(`File not found in B2 (already deleted): ${storageKey}`);
                return true;
            }
            // For any other error, throw it so the use case can handle it
            console.error(`Error deleting from B2 (${storageKey}):`, error);
            throw new Error(`Failed to delete file from storage: ${error.message}`);
        }
    }

    async exists(storageKey) {
        try {
            const command = new HeadObjectCommand({
                Bucket: this.bucket,
                Key: storageKey,
            });

            await this.client.send(command);
            return true;
        } catch (error) {
            return false;
        }
    }

    async getMetadata(storageKey) {
        const command = new HeadObjectCommand({
            Bucket: this.bucket,
            Key: storageKey,
        });

        const response = await this.client.send(command);

        return {
            contentType: response.ContentType,
            contentLength: response.ContentLength,
            lastModified: response.LastModified,
            metadata: response.Metadata,
        };
    }

    /**
     * Get object stream with authentication (for private buckets)
     * Supports range requests for video streaming
     */
    async getObjectStream(storageKey, range = null) {
        const commandParams = {
            Bucket: this.bucket,
            Key: storageKey,
        };

        // Add range header if provided
        if (range) {
            commandParams.Range = range;
        }

        const command = new GetObjectCommand(commandParams);
        const response = await this.client.send(command);

        return {
            stream: response.Body,
            contentType: response.ContentType,
            contentLength: response.ContentLength,
            contentRange: response.ContentRange,
            acceptRanges: response.AcceptRanges,
            statusCode: range ? 206 : 200,
        };
    }
}

module.exports = B2StorageRepository;

