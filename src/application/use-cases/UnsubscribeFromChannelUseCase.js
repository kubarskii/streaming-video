// @ts-check
// Use Case: Unsubscribe from a channel

class UnsubscribeFromChannelUseCase {
    constructor(subscriptionRepository, channelRepository) {
        this.subscriptionRepository = subscriptionRepository;
        this.channelRepository = channelRepository;
    }

    async execute({ userId, channelId }) {
        // Check if subscription exists
        const subscription = await this.subscriptionRepository.findByUserAndChannel(userId, channelId);
        if (!subscription) {
            throw new Error('Not subscribed to this channel');
        }

        // Delete subscription and decrement subscriber count
        await this.subscriptionRepository.delete(userId, channelId);
        await this.channelRepository.decrementSubscriberCount(channelId);
    }
}

module.exports = UnsubscribeFromChannelUseCase;

