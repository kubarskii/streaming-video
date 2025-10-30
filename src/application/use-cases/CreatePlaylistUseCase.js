// @ts-check
// Application: CreatePlaylistUseCase
// Handles creation of playlists that can be shared and grouped

const { randomUUID } = require('crypto');
const Playlist = require('../../domain/entities/Playlist');

class CreatePlaylistUseCase {
    /**
     * @param {import('../../domain/repositories/IPlaylistRepository')} playlistRepository
     * @param {import('../../domain/repositories/IVideoRepository')} videoRepository
     */
    constructor(playlistRepository, videoRepository) {
        this.playlistRepository = playlistRepository;
        this.videoRepository = videoRepository;
    }

    /**
     * Execute playlist creation
     * @param {Object} input
     * @param {string} input.title
     * @param {string|null} [input.description]
     * @param {boolean} [input.isPublic]
     * @param {string|null} [input.slug]
     * @param {string} input.userId
     * @param {string[]} [input.videoIds]
     */
    async execute(input) {
        const { title, description = null, isPublic = true, slug = null, userId, videoIds = [] } = input;

        if (!userId) {
            throw new Error('User ID is required to create a playlist');
        }

        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            throw new Error('Playlist title is required');
        }

        const playlistId = randomUUID();
        const now = new Date();
        const normalizedTitle = title.trim();

        const playlistSlug = await this.ensureUniqueSlug(slug || this.generateSlug(normalizedTitle));

        const uniqueVideoIds = Array.from(new Set(videoIds.filter(Boolean)));
        const playlistVideos = [];

        for (let index = 0; index < uniqueVideoIds.length; index += 1) {
            const videoId = uniqueVideoIds[index];
            const video = await this.videoRepository.findById(videoId);
            if (!video) {
                throw new Error(`Video with ID ${videoId} not found`);
            }

            playlistVideos.push({
                videoId,
                position: index
            });
        }

        const playlist = new Playlist({
            id: playlistId,
            title: normalizedTitle,
            description: description ? description.trim() : null,
            isPublic: Boolean(isPublic),
            slug: playlistSlug,
            userId,
            createdAt: now,
            updatedAt: now
        });

        return await this.playlistRepository.createPlaylist(playlist, playlistVideos);
    }

    generateSlug(input) {
        const base = (input || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80);

        const slug = base.length > 0 ? base : `playlist-${Date.now()}`;
        return slug;
    }

    async ensureUniqueSlug(baseSlug) {
        let slug = baseSlug;
        let counter = 0;

        while (slug) {
            const existing = await this.playlistRepository.getPlaylistBySlug(slug);
            if (!existing) {
                return slug;
            }
            counter += 1;
            slug = `${baseSlug}-${counter}`;
        }

        return null;
    }
}

module.exports = CreatePlaylistUseCase;

