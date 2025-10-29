// @ts-check
// Use Case: Subscribe to a channel

const { randomUUID } = require('crypto');
const Subscription = require('../../domain/entities/Subscription');

class SubscribeToChannelUseCase {
    constructor(subscriptionRepository, channelRepository) {
        this.subscriptionRepository = subscriptionRepository;
        this.channelRepository = channelRepository;
    }

    async execute({ userId, channelId }) {
        // Check if channel exists
        const channel = await this.channelRepository.findById(channelId);
        if (!channel) {
            throw new Error('Channel not found');
        }

        // Prevent users from subscribing to their own channel
        if (channel.userId === userId) {
            throw new Error('Cannot subscribe to your own channel');
        }

        // Check if already subscribed
        const existing = await this.subscriptionRepository.findByUserAndChannel(userId, channelId);
        if (existing) {
            throw new Error('Already subscribed to this channel');
        }

        // Create subscription
        const subscription = new Subscription({
            id: randomUUID(),
            userId,
            channelId,
            subscribedAt: new Date()
        });

        // Save subscription and increment subscriber count
        await this.subscriptionRepository.create(subscription);
        await this.channelRepository.incrementSubscriberCount(channelId);

        return subscription;
    }
}

module.exports = SubscribeToChannelUseCase;

