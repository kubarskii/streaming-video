// @ts-check
// Use Case: Check if a user is subscribed to a channel

class CheckSubscriptionStatusUseCase {
    constructor(subscriptionRepository) {
        this.subscriptionRepository = subscriptionRepository;
    }

    async execute({ userId, channelId }) {
        const isSubscribed = await this.subscriptionRepository.exists(userId, channelId);
        return { isSubscribed };
    }
}

module.exports = CheckSubscriptionStatusUseCase;

