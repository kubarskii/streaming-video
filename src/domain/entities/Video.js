// Domain Entity: Video
// Represents a video in our domain with business rules

class Video {
    constructor({
        id,
        title,
        description,
        fileName,
        storageKey,
        storageUrl,
        cdnUrl,
        mimeType,
        sizeBytes,
        durationMs,
        width,
        height,
        status,
        uploadedAt,
        updatedAt,
        userId,
        thumbnailUrl
    }) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.fileName = fileName;
        this.storageKey = storageKey;
        this.storageUrl = storageUrl;
        this.cdnUrl = cdnUrl;
        this.mimeType = mimeType;
        this.sizeBytes = sizeBytes;
        this.durationMs = durationMs;
        this.width = width;
        this.height = height;
        this.status = status;
        this.uploadedAt = uploadedAt;
        this.updatedAt = updatedAt;
        this.userId = userId;
        this.thumbnailUrl = thumbnailUrl;

        this.validate();
    }

    validate() {
        if (!this.id) {
            throw new Error('Video ID is required');
        }
        if (!this.title) {
            throw new Error('Video title is required');
        }
        if (!this.fileName) {
            throw new Error('Video fileName is required');
        }
        if (!this.storageKey) {
            throw new Error('Video storageKey is required');
        }
        if (!this.mimeType) {
            throw new Error('Video mimeType is required');
        }
        if (this.sizeBytes === undefined || this.sizeBytes === null) {
            throw new Error('Video sizeBytes is required');
        }
    }

    // Business logic methods
    isReady() {
        return this.status === 'ready';
    }

    isPending() {
        return this.status === 'pending';
    }

    isProcessing() {
        return this.status === 'processing';
    }

    isFailed() {
        return this.status === 'failed';
    }

    markAsProcessing() {
        this.status = 'processing';
        this.updatedAt = new Date();
    }

    markAsReady() {
        this.status = 'ready';
        this.updatedAt = new Date();
    }

    markAsFailed() {
        this.status = 'failed';
        this.updatedAt = new Date();
    }

    getPlaybackUrl() {
        // Always return server streaming endpoint for security and control
        const baseUrl = process.env.SERVER_BASE_URL || 'http://localhost:3000';
        return `${baseUrl}/video?file=${this.storageKey}`;
    }

    // Convert to plain object for persistence
    toObject() {
        return {
            id: this.id,
            title: this.title,
            description: this.description,
            fileName: this.fileName,
            storageKey: this.storageKey,
            storageUrl: this.storageUrl,
            cdnUrl: this.cdnUrl,
            mimeType: this.mimeType,
            sizeBytes: this.sizeBytes,
            durationMs: this.durationMs,
            width: this.width,
            height: this.height,
            status: this.status,
            uploadedAt: this.uploadedAt,
            updatedAt: this.updatedAt,
            userId: this.userId,
            thumbnailUrl: this.thumbnailUrl
        };
    }

    // Factory method to create from database record
    static fromDatabase(dbRecord) {
        return new Video({
            id: dbRecord.id,
            title: dbRecord.title,
            description: dbRecord.description,
            fileName: dbRecord.fileName,
            storageKey: dbRecord.storageKey,
            storageUrl: dbRecord.storageUrl,
            cdnUrl: dbRecord.cdnUrl,
            mimeType: dbRecord.mimeType,
            sizeBytes: Number(dbRecord.sizeBytes),
            durationMs: dbRecord.durationMs,
            width: dbRecord.width,
            height: dbRecord.height,
            status: dbRecord.status,
            uploadedAt: dbRecord.uploadedAt,
            updatedAt: dbRecord.updatedAt,
            userId: dbRecord.userId,
            thumbnailUrl: dbRecord.thumbnailUrl
        });
    }
}

module.exports = Video;

