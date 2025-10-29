// @ts-check
// Domain Entity: Channel
// Represents a user's channel where they publish videos

class Channel {
    constructor({
        id,
        userId,
        name,
        description,
        avatarUrl,
        bannerUrl,
        subscriberCount,
        videoCount,
        createdAt,
        updatedAt
    }) {
        this.id = id;
        this.userId = userId;
        this.name = name;
        this.description = description;
        this.avatarUrl = avatarUrl;
        this.bannerUrl = bannerUrl;
        this.subscriberCount = subscriberCount || 0;
        this.videoCount = videoCount || 0;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;

        this.validate();
    }

    validate() {
        if (!this.id) {
            throw new Error('Channel ID is required');
        }
        if (!this.userId) {
            throw new Error('User ID is required');
        }
        if (!this.name) {
            throw new Error('Channel name is required');
        }
        if (this.name.length < 3 || this.name.length > 50) {
            throw new Error('Channel name must be between 3 and 50 characters');
        }
        if (this.description && this.description.length > 500) {
            throw new Error('Channel description must be less than 500 characters');
        }
    }

    // Business logic methods
    incrementSubscriberCount() {
        this.subscriberCount += 1;
        this.updatedAt = new Date();
    }

    decrementSubscriberCount() {
        if (this.subscriberCount > 0) {
            this.subscriberCount -= 1;
            this.updatedAt = new Date();
        }
    }

    incrementVideoCount() {
        this.videoCount += 1;
        this.updatedAt = new Date();
    }

    decrementVideoCount() {
        if (this.videoCount > 0) {
            this.videoCount -= 1;
            this.updatedAt = new Date();
        }
    }

    updateInfo({ name, description, avatarUrl, bannerUrl }) {
        if (name !== undefined) this.name = name;
        if (description !== undefined) this.description = description;
        if (avatarUrl !== undefined) this.avatarUrl = avatarUrl;
        if (bannerUrl !== undefined) this.bannerUrl = bannerUrl;
        this.updatedAt = new Date();
        this.validate();
    }

    toObject() {
        return {
            id: this.id,
            userId: this.userId,
            name: this.name,
            description: this.description,
            avatarUrl: this.avatarUrl,
            bannerUrl: this.bannerUrl,
            subscriberCount: this.subscriberCount,
            videoCount: this.videoCount,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    static fromDatabase(dbRecord) {
        // Handle missing or invalid name field from database
        let name = dbRecord.name;
        if (!name || name.trim().length === 0) {
            // Fallback: use username if available, otherwise generate a name
            if (dbRecord.user && dbRecord.user.username) {
                name = dbRecord.user.username;
            } else {
                name = `Channel_${dbRecord.id.substring(0, 8)}`;
            }
            console.warn(`Channel ${dbRecord.id} missing name, using fallback: ${name}`);
        }
        
        return new Channel({
            id: dbRecord.id,
            userId: dbRecord.userId,
            name: name,
            description: dbRecord.description,
            avatarUrl: dbRecord.avatarUrl,
            bannerUrl: dbRecord.bannerUrl,
            subscriberCount: dbRecord.subscriberCount,
            videoCount: dbRecord.videoCount,
            createdAt: dbRecord.createdAt,
            updatedAt: dbRecord.updatedAt
        });
    }
}

module.exports = Channel;

