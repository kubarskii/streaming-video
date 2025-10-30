// @ts-check
// Domain Entity: VideoLike
// Represents a like or dislike on a video

class VideoLike {
    constructor({
        id,
        videoId,
        userId,
        isLike,
        createdAt,
        updatedAt
    }) {
        this.id = id;
        this.videoId = videoId;
        this.userId = userId;
        this.isLike = isLike;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;

        this.validate();
    }

    validate() {
        if (!this.id) {
            throw new Error('VideoLike ID is required');
        }
        if (!this.videoId) {
            throw new Error('Video ID is required');
        }
        if (!this.userId) {
            throw new Error('User ID is required');
        }
        if (typeof this.isLike !== 'boolean') {
            throw new Error('isLike must be a boolean');
        }
    }

    // Convert to plain object for persistence
    toObject() {
        return {
            id: this.id,
            videoId: this.videoId,
            userId: this.userId,
            isLike: this.isLike,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    // Factory method to create from database record
    static fromDatabase(dbRecord) {
        return new VideoLike({
            id: dbRecord.id,
            videoId: dbRecord.videoId,
            userId: dbRecord.userId,
            isLike: dbRecord.isLike,
            createdAt: dbRecord.createdAt,
            updatedAt: dbRecord.updatedAt
        });
    }
}

module.exports = VideoLike;

