// Infrastructure: B2StorageRepository
// Implementation of IStorageRepository for Backblaze B2

const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
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
            const command = new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: storageKey,
            });

            await this.client.send(command);
            console.log(`Successfully deleted from B2: ${storageKey}`);
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

