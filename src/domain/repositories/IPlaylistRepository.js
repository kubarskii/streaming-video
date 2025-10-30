// @ts-check
// Domain: Playlist Repository Interface
// Defines contract for interacting with playlist persistence layer

class IPlaylistRepository {
    /**
     * @param {import('../entities/Playlist')} playlist
     * @param {Array} videos
     * @returns {Promise<import('../entities/Playlist')>}
     */
    async createPlaylist(playlist, videos = []) {
        throw new Error('createPlaylist method not implemented');
    }

    /**
     * @param {import('../entities/Playlist')} playlist
     * @returns {Promise<import('../entities/Playlist')>}
     */
    async updatePlaylist(playlist) {
        throw new Error('updatePlaylist method not implemented');
    }

    async deletePlaylist(playlistId) {
        throw new Error('deletePlaylist method not implemented');
    }

    /**
     * @returns {Promise<import('../entities/Playlist')|null>}
     */
    async getPlaylistById(playlistId, options = {}) {
        throw new Error('getPlaylistById method not implemented');
    }

    /**
     * @returns {Promise<import('../entities/Playlist')|null>}
     */
    async getPlaylistBySlug(slug, options = {}) {
        throw new Error('getPlaylistBySlug method not implemented');
    }

    /**
     * @returns {Promise<{playlists: import('../entities/Playlist')[], total: number, limit: number, offset: number}>}
     */
    async listPlaylists(filters = {}, pagination = {}) {
        throw new Error('listPlaylists method not implemented');
    }

    /**
     * @returns {Promise<import('../entities/Playlist')|null>}
     */
    async addVideoToPlaylist(playlistId, videoId, position) {
        throw new Error('addVideoToPlaylist method not implemented');
    }

    /**
     * @returns {Promise<import('../entities/Playlist')|null>}
     */
    async removeVideoFromPlaylist(playlistId, videoId) {
        throw new Error('removeVideoFromPlaylist method not implemented');
    }

    /**
     * @returns {Promise<import('../entities/Playlist')|null>}
     */
    async reorderPlaylistVideos(playlistId, orderedVideoIds) {
        throw new Error('reorderPlaylistVideos method not implemented');
    }
}

module.exports = IPlaylistRepository;

