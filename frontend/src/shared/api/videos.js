// Shared: Videos API
import api from './client';

// Use environment variable or fallback to relative path
// In development, Vite proxy forwards /video to backend
// In production, frontend is served by backend, so /video works directly
const VIDEO_BASE = import.meta.env.VITE_VIDEO_BASE_URL || '/video';

export const videosAPI = {
    getVideos: async ({ limit = 20, offset = 0, status, userId, search, signal } = {}) => {
        const params = new URLSearchParams();
        params.append('limit', limit);
        params.append('offset', offset);
        if (status) params.append('status', status);
        if (userId) params.append('userId', userId);
        if (search) params.append('search', search);

        const response = await api.get(`/videos?${params.toString()}`, { signal });
        return response.data;
    },

    getVideo: async (id, signal) => {
        const response = await api.get(`/videos/${id}`, { signal });
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

    uploadVideo: async (formData, onProgress, fileSize) => {
        // Extract file size from FormData if not provided
        let totalSize = fileSize;
        if (!totalSize && formData instanceof FormData) {
            const videoFile = formData.get('video');
            if (videoFile instanceof File) {
                totalSize = videoFile.size;
            }
        }

        const response = await api.post('/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
                if (!onProgress) return;

                // Use progressEvent.total if available, otherwise fall back to fileSize
                const total = progressEvent.total || totalSize || 0;
                const loaded = progressEvent.loaded || 0;

                if (total > 0 && loaded >= 0) {
                    const progress = (loaded / total) * 100;
                    const progressPercent = Math.round(progress);
                    // Ensure progress is between 0 and 100 and is a valid number
                    const clampedProgress = Math.max(0, Math.min(100, progressPercent));
                    if (!isNaN(clampedProgress) && isFinite(clampedProgress)) {
                        onProgress(clampedProgress);
                    }
                }
            },
        });
        return response.data;
    },

    getVideoUrl: (storageKey) => {
        return `${VIDEO_BASE}?file=${storageKey}`;
    },

    getVideoQualities: async (id, signal) => {
        const response = await api.get(`/videos/${id}/qualities`, { signal });
        return response.data;
    },

    transcodeVideo: async (id, signal) => {
        const response = await api.post(`/videos/${id}/transcode`, {}, { signal });
        return response.data;
    },

    incrementViews: async (id, signal) => {
        // This endpoint might not exist yet - fire and forget
        try {
            await api.post(`/videos/${id}/views`, {}, { signal });
        } catch (err) {
            // Ignore errors for now (including AbortError)
            if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
                console.error('Error incrementing views:', err);
            }
        }
    },

    // Like/Dislike functionality
    likeVideo: async (id, isLike) => {
        const response = await api.post(`/videos/${id}/like`, { isLike });
        return response.data;
    },

    removeLike: async (id) => {
        const response = await api.delete(`/videos/${id}/like`);
        return response.data;
    },

    getLikeStats: async (id, signal) => {
        const response = await api.get(`/videos/${id}/likes`, { signal });
        return response.data;
    },
};

