// Shared: Subscriptions API
import api from './client';

export const subscriptionsAPI = {
    // Subscribe to a channel
    subscribe: async (channelId) => {
        const response = await api.post('/subscriptions', { channelId });
        return response.data;
    },

    // Unsubscribe from a channel
    unsubscribe: async (channelId) => {
        const response = await api.delete(`/subscriptions/${channelId}`);
        return response.data;
    },

    // Get user's subscriptions
    getSubscriptions: async ({ limit = 20, offset = 0 } = {}) => {
        const params = new URLSearchParams();
        params.append('limit', limit);
        params.append('offset', offset);

        const response = await api.get(`/subscriptions?${params.toString()}`);
        return response.data;
    },

    // Check if user is subscribed to a channel
    checkStatus: async (channelId) => {
        const response = await api.get(`/subscriptions/${channelId}/status`);
        return response.data;
    },
};

