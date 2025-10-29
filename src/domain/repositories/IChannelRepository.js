// @ts-check
// Repository Interface: Channel Repository
// Defines the contract for channel data persistence

class IChannelRepository {
    /**
     * @param {import('../entities/Channel')} channel
     * @returns {Promise<import('../entities/Channel')>}
     */
    async create(channel) {
        throw new Error('Method not implemented');
    }

    /**
     * @param {string} id
     * @returns {Promise<import('../entities/Channel') | null>}
     */
    async findById(id) {
        throw new Error('Method not implemented');
    }

    /**
     * @param {string} userId
     * @returns {Promise<import('../entities/Channel') | null>}
     */
    async findByUserId(userId) {
        throw new Error('Method not implemented');
    }

    /**
     * @param {string} id
     * @param {Object} updates
     * @returns {Promise<import('../entities/Channel')>}
     */
    async update(id, updates) {
        throw new Error('Method not implemented');
    }

    /**
     * @param {string} id
     * @returns {Promise<void>}
     */
    async delete(id) {
        throw new Error('Method not implemented');
    }

    /**
     * @param {Object} options
     * @param {number} options.limit
     * @param {number} options.offset
     * @param {string} options.sortBy
     * @returns {Promise<import('../entities/Channel')[]>}
     */
    async findAll(options) {
        throw new Error('Method not implemented');
    }

    /**
     * @param {string} channelId
     * @returns {Promise<void>}
     */
    async incrementSubscriberCount(channelId) {
        throw new Error('Method not implemented');
    }

    /**
     * @param {string} channelId
     * @returns {Promise<void>}
     */
    async decrementSubscriberCount(channelId) {
        throw new Error('Method not implemented');
    }
}

module.exports = IChannelRepository;

