// Shared: Subscriptions API
import api from './client';

export const subscriptionsAPI = {
    // Subscribe to a channel
    subscribe: async (channelId, signal) => {
        const response = await api.post('/subscriptions', { channelId }, { signal });
        return response.data;
    },

    // Unsubscribe from a channel
    unsubscribe: async (channelId, signal) => {
        const response = await api.delete(`/subscriptions/${channelId}`, { signal });
        return response.data;
    },

    // Get user's subscriptions
    getSubscriptions: async ({ limit = 20, offset = 0, signal } = {}) => {
        const params = new URLSearchParams();
        params.append('limit', limit);
        params.append('offset', offset);

        const response = await api.get(`/subscriptions?${params.toString()}`, { signal });
        return response.data;
    },

    // Check if user is subscribed to a channel
    checkStatus: async (channelId, signal) => {
        const response = await api.get(`/subscriptions/${channelId}/status`, { signal });
        return response.data;
    },
};

