// @ts-check
// Application: ReorderPlaylistVideosUseCase
// Reorders playlist videos according to supplied ordering

class ReorderPlaylistVideosUseCase {
    /**
     * @param {import('../../domain/repositories/IPlaylistRepository')} playlistRepository
     */
    constructor(playlistRepository) {
        this.playlistRepository = playlistRepository;
    }

    /**
     * @param {Object} input
     * @param {string} input.playlistId
     * @param {string[]} input.videoIds
     * @param {string} input.userId
     */
    async execute(input) {
        const { playlistId, videoIds, userId } = input;

        if (!playlistId) {
            throw new Error('Playlist ID is required');
        }
        if (!Array.isArray(videoIds) || videoIds.length === 0) {
            throw new Error('Video order is required');
        }
        if (!userId) {
            throw new Error('User ID is required');
        }

        const playlist = await this.playlistRepository.getPlaylistById(playlistId, { includeVideos: true });
        if (!playlist) {
            throw new Error('Playlist not found');
        }

        if (playlist.userId !== userId) {
            throw new Error('You do not have permission to modify this playlist');
        }

        return await this.playlistRepository.reorderPlaylistVideos(playlistId, videoIds);
    }
}

module.exports = ReorderPlaylistVideosUseCase;

