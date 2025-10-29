// Shared: Channels API
import api from './client';

export const channelsAPI = {
    // Create a new channel
    createChannel: async ({ name, description, avatarUrl, bannerUrl }) => {
        const response = await api.post('/channels', {
            name,
            description,
            avatarUrl,
            bannerUrl,
        });
        return response.data;
    },

    // Get channel by ID or user ID
    getChannel: async ({ channelId, userId }) => {
        const params = new URLSearchParams();
        if (channelId) params.append('channelId', channelId);
        if (userId) params.append('userId', userId);

        const response = await api.get(`/channels?${params.toString()}`);
        return response.data;
    },

    // Update channel
    updateChannel: async (channelId, { name, description, avatarUrl, bannerUrl }) => {
        const response = await api.patch(`/channels/${channelId}`, {
            name,
            description,
            avatarUrl,
            bannerUrl,
        });
        return response.data;
    },

    // List channels
    listChannels: async ({ limit = 20, offset = 0, sortBy = 'subscriberCount' } = {}) => {
        const params = new URLSearchParams();
        params.append('limit', limit);
        params.append('offset', offset);
        params.append('sortBy', sortBy);

        const response = await api.get(`/channels/list?${params.toString()}`);
        return response.data;
    },
};

