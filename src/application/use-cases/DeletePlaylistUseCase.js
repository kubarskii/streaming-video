// @ts-check
// Application: DeletePlaylistUseCase
// Handles removal of playlists

class DeletePlaylistUseCase {
    /**
     * @param {import('../../domain/repositories/IPlaylistRepository')} playlistRepository
     */
    constructor(playlistRepository) {
        this.playlistRepository = playlistRepository;
    }

    /**
     * Delete a playlist by id
     * @param {Object} input
     * @param {string} input.playlistId
     * @param {string} input.userId
     */
    async execute(input) {
        const { playlistId, userId } = input;

        if (!playlistId) {
            throw new Error('Playlist ID is required');
        }

        if (!userId) {
            throw new Error('User ID is required to delete a playlist');
        }

        const playlist = await this.playlistRepository.getPlaylistById(playlistId);
        if (!playlist) {
            throw new Error('Playlist not found');
        }

        if (playlist.userId !== userId) {
            throw new Error('You do not have permission to delete this playlist');
        }

        await this.playlistRepository.deletePlaylist(playlistId);

        return true;
    }
}

module.exports = DeletePlaylistUseCase;

