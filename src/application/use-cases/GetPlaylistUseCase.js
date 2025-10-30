// @ts-check
// Application: GetPlaylistUseCase
// Retrieves a playlist by id or slug with optional privacy enforcement

class GetPlaylistUseCase {
    /**
     * @param {import('../../domain/repositories/IPlaylistRepository')} playlistRepository
     */
    constructor(playlistRepository) {
        this.playlistRepository = playlistRepository;
    }

    /**
     * Execute the retrieval
     * @param {Object} input
     * @param {string} [input.playlistId]
     * @param {string} [input.slug]
     * @param {string} [input.requestingUserId]
     */
    async execute(input) {
        const { playlistId, slug, requestingUserId } = input;

        if (!playlistId && !slug) {
            throw new Error('Playlist ID or slug is required');
        }

        let playlist = null;
        if (playlistId) {
            playlist = await this.playlistRepository.getPlaylistById(playlistId, { includeVideos: true, includeUser: true });
        } else if (slug) {
            playlist = await this.playlistRepository.getPlaylistBySlug(slug, { includeVideos: true, includeUser: true });
        }

        if (!playlist) {
            throw new Error('Playlist not found');
        }

        if (!playlist.isPublic && playlist.userId !== requestingUserId) {
            throw new Error('Playlist is private');
        }

        return playlist;
    }
}

module.exports = GetPlaylistUseCase;

