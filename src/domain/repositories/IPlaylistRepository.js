// @ts-check
// Domain: Playlist Repository Interface
// Defines contract for interacting with playlist persistence layer

class IPlaylistRepository {
    async createPlaylist(playlistData, videos = []) {
        throw new Error('createPlaylist method not implemented');
    }

    async updatePlaylist(playlistId, updates) {
        throw new Error('updatePlaylist method not implemented');
    }

    async deletePlaylist(playlistId) {
        throw new Error('deletePlaylist method not implemented');
    }

    async getPlaylistById(playlistId, options = {}) {
        throw new Error('getPlaylistById method not implemented');
    }

    async getPlaylistBySlug(slug, options = {}) {
        throw new Error('getPlaylistBySlug method not implemented');
    }

    async listPlaylists(filters = {}, pagination = {}) {
        throw new Error('listPlaylists method not implemented');
    }

    async addVideoToPlaylist(playlistId, videoId, position) {
        throw new Error('addVideoToPlaylist method not implemented');
    }

    async removeVideoFromPlaylist(playlistId, videoId) {
        throw new Error('removeVideoFromPlaylist method not implemented');
    }

    async reorderPlaylistVideos(playlistId, orderedVideoIds) {
        throw new Error('reorderPlaylistVideos method not implemented');
    }
}

module.exports = IPlaylistRepository;

