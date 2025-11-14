// @ts-check
// Use Case: Create a new channel for a user

const { randomUUID } = require('crypto');
const Channel = require('../../domain/entities/Channel');
const ContentSanitizer = require('../../infrastructure/security/ContentSanitizer');

class CreateChannelUseCase {
    constructor(channelRepository, userRepository) {
        this.channelRepository = channelRepository;
        this.userRepository = userRepository;
    }

    async execute({ userId, name, description, avatarUrl, bannerUrl }) {
        // Validate user exists
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Check if user already has a channel
        const existingChannel = await this.channelRepository.findByUserId(userId);
        if (existingChannel) {
            throw new Error('User already has a channel');
        }

        // Sanitize user input
        const sanitizedName = ContentSanitizer.sanitizeTitle(name, 'channelName');
        if (!sanitizedName || sanitizedName.length === 0) {
            throw new Error('Channel name is required');
        }
        const sanitizedDescription = ContentSanitizer.sanitizeDescription(description, 'channelDescription');

        // Create the channel
        const channel = new Channel({
            id: randomUUID(),
            userId,
            name: sanitizedName,
            description: sanitizedDescription,
            avatarUrl: avatarUrl || null,
            bannerUrl: bannerUrl || null,
            subscriberCount: 0,
            videoCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        return await this.channelRepository.create(channel);
    }
}

module.exports = CreateChannelUseCase;

