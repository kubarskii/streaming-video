// @ts-check
// Use Case: List channels with pagination and sorting

class ListChannelsUseCase {
    constructor(channelRepository) {
        this.channelRepository = channelRepository;
    }

    async execute({ limit = 20, offset = 0, sortBy = 'subscriberCount' }) {
        return await this.channelRepository.findAll({ limit, offset, sortBy });
    }
}

module.exports = ListChannelsUseCase;

