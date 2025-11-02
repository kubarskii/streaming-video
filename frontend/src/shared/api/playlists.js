// Shared: Playlists API
import api from './client';

export const playlistsAPI = {
    getPlaylists: async (params = {}, signal) => {
        const queryParams = new URLSearchParams();
        if (params.userId) queryParams.append('userId', params.userId);
        if (params.isPublic !== undefined) queryParams.append('isPublic', params.isPublic);
        if (params.includeVideos !== undefined) queryParams.append('includeVideos', params.includeVideos);
        if (params.limit) queryParams.append('limit', params.limit);
        if (params.offset) queryParams.append('offset', params.offset);

        const response = await api.get(`/playlists?${queryParams.toString()}`, { signal });
        return response.data;
    },

    getPlaylist: async (id, signal) => {
        const response = await api.get(`/playlists/${id}`, { signal });
        return response.data;
    },

    getPlaylistBySlug: async (slug, signal) => {
        const response = await api.get(`/playlists/slug/${slug}`, { signal });
        return response.data;
    },

    createPlaylist: async (playlistData) => {
        const response = await api.post('/playlists', playlistData);
        return response.data;
    },

    updatePlaylist: async (id, updates) => {
        const response = await api.patch(`/playlists/${id}`, updates);
        return response.data;
    },

    deletePlaylist: async (id) => {
        const response = await api.delete(`/playlists/${id}`);
        return response.data;
    },

    addVideoToPlaylist: async (playlistId, videoId) => {
        const response = await api.post(`/playlists/${playlistId}/videos`, { videoId });
        return response.data;
    },

    removeVideoFromPlaylist: async (playlistId, videoId) => {
        const response = await api.delete(`/playlists/${playlistId}/videos/${videoId}`);
        return response.data;
    },

    reorderPlaylistVideos: async (playlistId, videoIds) => {
        const response = await api.patch(`/playlists/${playlistId}/videos/reorder`, { videoIds });
        return response.data;
    },
};

