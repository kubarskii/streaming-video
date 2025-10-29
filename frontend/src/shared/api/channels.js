// Shared: Channels API
import api from './client';

export const channelsAPI = {
    // Create a new channel
    createChannel: async ({ name, description, avatarUrl, bannerUrl, signal }) => {
        const response = await api.post('/channels', {
            name,
            description,
            avatarUrl,
            bannerUrl,
        }, { signal });
        return response.data;
    },

    // Get channel by ID or user ID
    getChannel: async ({ channelId, userId, signal }) => {
        const params = new URLSearchParams();
        if (channelId) params.append('channelId', channelId);
        if (userId) params.append('userId', userId);

        const response = await api.get(`/channels?${params.toString()}`, { signal });
        return response.data;
    },

    // Update channel
    updateChannel: async (channelId, { name, description, avatarUrl, bannerUrl, signal }) => {
        const response = await api.patch(`/channels/${channelId}`, {
            name,
            description,
            avatarUrl,
            bannerUrl,
        }, { signal });
        return response.data;
    },

    // List channels
    listChannels: async ({ limit = 20, offset = 0, sortBy = 'subscriberCount', signal } = {}) => {
        const params = new URLSearchParams();
        params.append('limit', limit);
        params.append('offset', offset);
        params.append('sortBy', sortBy);

        const response = await api.get(`/channels/list?${params.toString()}`, { signal });
        return response.data;
    },
};

