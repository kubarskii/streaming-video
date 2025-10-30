// @ts-check
// Application: UpdatePlaylistUseCase
// Handles updates to playlist metadata and visibility

class UpdatePlaylistUseCase {
    /**
     * @param {import('../../domain/repositories/IPlaylistRepository')} playlistRepository
     */
    constructor(playlistRepository) {
        this.playlistRepository = playlistRepository;
    }

    /**
     * Update playlist properties
     * @param {Object} input
     * @param {string} input.playlistId
     * @param {string} input.userId
     * @param {string} [input.title]
     * @param {string|null} [input.description]
     * @param {boolean} [input.isPublic]
     * @param {string|null} [input.slug]
     */
    async execute(input) {
        const { playlistId, userId, title, description, isPublic, slug } = input;

        if (!playlistId) {
            throw new Error('Playlist ID is required');
        }

        if (!userId) {
            throw new Error('User ID is required to update playlist');
        }

        const playlist = await this.playlistRepository.getPlaylistById(playlistId);
        if (!playlist) {
            throw new Error('Playlist not found');
        }

        if (playlist.userId !== userId) {
            throw new Error('You do not have permission to modify this playlist');
        }

        if (title !== undefined) {
            playlist.rename(title.trim());
        }

        if (description !== undefined) {
            playlist.updateDescription(description !== null ? description.trim() : null);
        }

        if (isPublic !== undefined) {
            playlist.setVisibility(Boolean(isPublic));
        }

        if (slug !== undefined) {
            const normalizedSlug = slug && slug.trim().length > 0 ? this.generateSlug(slug) : null;
            const finalSlug = normalizedSlug ? await this.ensureUniqueSlug(normalizedSlug, playlistId) : null;
            playlist.updateSlug(finalSlug);
        }

        return await this.playlistRepository.updatePlaylist(playlist);
    }

    generateSlug(input) {
        return (input || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80);
    }

    async ensureUniqueSlug(baseSlug, currentPlaylistId) {
        if (!baseSlug) {
            return null;
        }

        let slug = baseSlug;
        let counter = 0;

        while (slug) {
            const existing = await this.playlistRepository.getPlaylistBySlug(slug);
            if (!existing || existing.id === currentPlaylistId) {
                return slug;
            }

            counter += 1;
            slug = `${baseSlug}-${counter}`;
        }

        return null;
    }
}

module.exports = UpdatePlaylistUseCase;

