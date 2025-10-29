// @ts-check
// Use Case: Get user's subscriptions

class GetUserSubscriptionsUseCase {
    constructor(subscriptionRepository) {
        this.subscriptionRepository = subscriptionRepository;
    }

    async execute({ userId, limit = 20, offset = 0 }) {
        return await this.subscriptionRepository.findByUserId(userId, { limit, offset });
    }
}

module.exports = GetUserSubscriptionsUseCase;

