// @ts-check
// Domain Entity: Subscription
// Represents a user's subscription to a channel

class Subscription {
    constructor({
        id,
        userId,
        channelId,
        subscribedAt
    }) {
        this.id = id;
        this.userId = userId;
        this.channelId = channelId;
        this.subscribedAt = subscribedAt;

        this.validate();
    }

    validate() {
        if (!this.id) {
            throw new Error('Subscription ID is required');
        }
        if (!this.userId) {
            throw new Error('User ID is required');
        }
        if (!this.channelId) {
            throw new Error('Channel ID is required');
        }
    }

    toObject() {
        return {
            id: this.id,
            userId: this.userId,
            channelId: this.channelId,
            subscribedAt: this.subscribedAt
        };
    }

    static fromDatabase(dbRecord) {
        return new Subscription({
            id: dbRecord.id,
            userId: dbRecord.userId,
            channelId: dbRecord.channelId,
            subscribedAt: dbRecord.subscribedAt
        });
    }
}

module.exports = Subscription;

