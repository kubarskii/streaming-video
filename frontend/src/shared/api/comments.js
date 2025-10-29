/**
 * Comments API Client
 * Handles HTTP requests for comment operations
 */

import { api } from './client';

export const commentsAPI = {
    /**
     * Create a new comment
     * @param {Object} data - Comment data
     * @param {string} data.videoId - Video ID
     * @param {string} data.content - Comment content
     * @returns {Promise<Object>}
     */
    async createComment(data) {
        const response = await api.post('/comments', data);
        return response.data.comment;
    },

    /**
     * Get comments for a video
     * @param {Object} params - Query parameters
     * @param {string} params.videoId - Video ID
     * @param {number} [params.limit=50] - Maximum comments to return
     * @param {number} [params.offset=0] - Offset for pagination
     * @returns {Promise<Object>}
     */
    async getComments(params) {
        const response = await api.get('/comments', { params });
        return response.data;
    },

    /**
     * Update a comment
     * @param {string} commentId - Comment ID
     * @param {Object} data - Comment data
     * @param {string} data.content - New comment content
     * @returns {Promise<Object>}
     */
    async updateComment(commentId, data) {
        const response = await api.patch(`/comments/${commentId}`, data);
        return response.data.comment;
    },

    /**
     * Delete a comment
     * @param {string} commentId - Comment ID
     * @returns {Promise<Object>}
     */
    async deleteComment(commentId) {
        const response = await api.delete(`/comments/${commentId}`);
        return response.data;
    },
};

