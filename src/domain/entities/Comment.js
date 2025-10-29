// @ts-check
// Domain Entity: Comment
// Represents a comment on a video

/**
 * Comment entity
 */
class Comment {
    /**
     * Creates a Comment instance
     * @param {Object} params
     * @param {string} params.id - Comment ID
     * @param {string} params.videoId - Video ID
     * @param {string} params.userId - User ID
     * @param {string} params.content - Comment content
     * @param {Date} params.createdAt - Creation date
     * @param {Date} params.updatedAt - Last update date
     * @param {Object} [params.user] - User object (optional, for includes)
     */
    constructor({
        id,
        videoId,
        userId,
        content,
        createdAt,
        updatedAt,
        user
    }) {
        this.id = id;
        this.videoId = videoId;
        this.userId = userId;
        this.content = content;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.user = user;

        this.validate();
    }

    /**
     * Validate comment data
     */
    validate() {
        if (!this.id) {
            throw new Error('Comment ID is required');
        }
        if (!this.videoId) {
            throw new Error('Video ID is required');
        }
        if (!this.userId) {
            throw new Error('User ID is required');
        }
        if (!this.content || this.content.trim().length === 0) {
            throw new Error('Comment content is required');
        }
        if (this.content.length > 5000) {
            throw new Error('Comment content is too long (max 5000 characters)');
        }
    }

    /**
     * Convert to plain object for persistence
     * @returns {Object}
     */
    toObject() {
        return {
            id: this.id,
            videoId: this.videoId,
            userId: this.userId,
            content: this.content,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    /**
     * Factory method to create from database record
     * @param {Object} dbRecord - Database record
     * @returns {Comment}
     */
    static fromDatabase(dbRecord) {
        return new Comment({
            id: dbRecord.id,
            videoId: dbRecord.videoId,
            userId: dbRecord.userId,
            content: dbRecord.content,
            createdAt: dbRecord.createdAt,
            updatedAt: dbRecord.updatedAt,
            user: dbRecord.user
        });
    }
}

module.exports = Comment;

