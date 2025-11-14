// @ts-check
// Use Case: Update channel information

const ContentSanitizer = require('../../infrastructure/security/ContentSanitizer');

class UpdateChannelUseCase {
    constructor(channelRepository) {
        this.channelRepository = channelRepository;
    }

    async execute({ channelId, userId, name, description, avatarUrl, bannerUrl }) {
        // Get the channel
        const channel = await this.channelRepository.findById(channelId);
        if (!channel) {
            throw new Error('Channel not found');
        }

        // Verify ownership
        if (channel.userId !== userId) {
            throw new Error('Unauthorized: You can only update your own channel');
        }

        // Prepare updates with sanitization
        const updates = {};
        if (name !== undefined) {
            const sanitizedName = ContentSanitizer.sanitizeTitle(name, 'channelName');
            if (!sanitizedName || sanitizedName.length === 0) {
                throw new Error('Channel name cannot be empty');
            }
            updates.name = sanitizedName;
        }
        if (description !== undefined) {
            updates.description = ContentSanitizer.sanitizeDescription(description, 'channelDescription');
        }
        if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
        if (bannerUrl !== undefined) updates.bannerUrl = bannerUrl;

        // Update the channel
        return await this.channelRepository.update(channelId, updates);
    }
}

module.exports = UpdateChannelUseCase;

