// @ts-check
// Use Case: Get channel information

class GetChannelUseCase {
    constructor(channelRepository) {
        this.channelRepository = channelRepository;
    }

    async execute({ channelId, userId }) {
        let channel;

        if (channelId) {
            channel = await this.channelRepository.findById(channelId);
        } else if (userId) {
            channel = await this.channelRepository.findByUserId(userId);
        } else {
            throw new Error('Either channelId or userId must be provided');
        }

        if (!channel) {
            throw new Error('Channel not found');
        }

        return channel;
    }
}

module.exports = GetChannelUseCase;

