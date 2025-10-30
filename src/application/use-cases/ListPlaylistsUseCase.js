// @ts-check
// Application: ListPlaylistsUseCase
// Returns paginated playlists for browsing and sharing

class ListPlaylistsUseCase {
    /**
     * @param {import('../../domain/repositories/IPlaylistRepository')} playlistRepository
     */
    constructor(playlistRepository) {
        this.playlistRepository = playlistRepository;
    }

    /**
     * Execute the listing operation
     * @param {Object} [input]
     * @param {number} [input.limit]
     * @param {number} [input.offset]
     * @param {string} [input.userId]
     * @param {boolean} [input.isPublic]
     * @param {string} [input.search]
     * @param {string} [input.requestingUserId]
     */
    async execute(input = {}) {
        const {
            limit = 20,
            offset = 0,
            userId,
            isPublic,
            search,
            requestingUserId
        } = input;

        const filters = { userId, search };

        if (isPublic !== undefined) {
            filters.isPublic = Boolean(isPublic);
        } else if (!requestingUserId || requestingUserId !== userId) {
            // Default to public playlists when requesting someone else's playlists
            filters.isPublic = true;
        }

        const result = await this.playlistRepository.listPlaylists(filters, { limit, offset });

        return {
            playlists: result.playlists,
            total: result.total,
            limit: result.limit,
            offset: result.offset,
            hasMore: result.offset + result.playlists.length < result.total
        };
    }
}

module.exports = ListPlaylistsUseCase;

