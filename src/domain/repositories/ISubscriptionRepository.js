// @ts-check
// Repository Interface: Subscription Repository
// Defines the contract for subscription data persistence

class ISubscriptionRepository {
    /**
     * @param {import('../entities/Subscription')} subscription
     * @returns {Promise<import('../entities/Subscription')>}
     */
    async create(subscription) {
        throw new Error('Method not implemented');
    }

    /**
     * @param {string} userId
     * @param {string} channelId
     * @returns {Promise<import('../entities/Subscription') | null>}
     */
    async findByUserAndChannel(userId, channelId) {
        throw new Error('Method not implemented');
    }

    /**
     * @param {string} userId
     * @param {Object} options
     * @param {number} options.limit
     * @param {number} options.offset
     * @returns {Promise<import('../entities/Subscription')[]>}
     */
    async findByUserId(userId, options) {
        throw new Error('Method not implemented');
    }

    /**
     * @param {string} channelId
     * @param {Object} options
     * @param {number} options.limit
     * @param {number} options.offset
     * @returns {Promise<import('../entities/Subscription')[]>}
     */
    async findByChannelId(channelId, options) {
        throw new Error('Method not implemented');
    }

    /**
     * @param {string} userId
     * @param {string} channelId
     * @returns {Promise<void>}
     */
    async delete(userId, channelId) {
        throw new Error('Method not implemented');
    }

    /**
     * @param {string} userId
     * @param {string} channelId
     * @returns {Promise<boolean>}
     */
    async exists(userId, channelId) {
        throw new Error('Method not implemented');
    }
}

module.exports = ISubscriptionRepository;

