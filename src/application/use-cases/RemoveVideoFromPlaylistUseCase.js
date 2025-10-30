// @ts-check
// Application: RemoveVideoFromPlaylistUseCase
// Removes a video from a playlist

class RemoveVideoFromPlaylistUseCase {
    /**
     * @param {import('../../domain/repositories/IPlaylistRepository')} playlistRepository
     */
    constructor(playlistRepository) {
        this.playlistRepository = playlistRepository;
    }

    /**
     * Remove the video
     * @param {Object} input
     * @param {string} input.playlistId
     * @param {string} input.videoId
     * @param {string} input.userId
     */
    async execute(input) {
        const { playlistId, videoId, userId } = input;

        if (!playlistId) {
            throw new Error('Playlist ID is required');
        }
        if (!videoId) {
            throw new Error('Video ID is required');
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

        return await this.playlistRepository.removeVideoFromPlaylist(playlistId, videoId);
    }
}

module.exports = RemoveVideoFromPlaylistUseCase;

