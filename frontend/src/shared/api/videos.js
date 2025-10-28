// Shared: Videos API
import api from './client';

const VIDEO_BASE = import.meta.env.PROD ? '/video' : 'http://localhost:3000/video';

export const videosAPI = {
    getVideos: async ({ limit = 20, offset = 0, status, userId, search } = {}) => {
        const params = new URLSearchParams();
        params.append('limit', limit);
        params.append('offset', offset);
        if (status) params.append('status', status);
        if (userId) params.append('userId', userId);
        if (search) params.append('search', search);

        const response = await api.get(`/videos?${params.toString()}`);
        return response.data;
    },

    getVideo: async (id) => {
        const response = await api.get(`/videos/${id}`);
        return response.data;
    },

    deleteVideo: async (id) => {
        const response = await api.delete(`/videos/${id}`);
        return response.data;
    },

    updateVideoMetadata: async (id, { title, description }) => {
        const response = await api.patch(`/videos/${id}`, { title, description });
        return response.data;
    },

    updateVideoThumbnail: async (id, thumbnailFile, onProgress) => {
        const formData = new FormData();
        formData.append('thumbnail', thumbnailFile);

        const response = await api.put(`/videos/${id}/thumbnail`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
                if (onProgress && progressEvent.total) {
                    const progress = (progressEvent.loaded / progressEvent.total) * 100;
                    onProgress(Math.round(progress));
                }
            },
        });
        return response.data;
    },

    uploadVideo: async (formData, onProgress) => {
        const response = await api.post('/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
                if (onProgress && progressEvent.total) {
                    const progress = (progressEvent.loaded / progressEvent.total) * 100;
                    onProgress(Math.round(progress));
                }
            },
        });
        return response.data;
    },

    getVideoUrl: (storageKey) => {
        return `${VIDEO_BASE}?file=${storageKey}`;
    },
};

