// @ts-check
// Infrastructure: PrismaPlaylistRepository
// Implements playlist persistence using Prisma ORM

const { randomUUID } = require('crypto');
const IPlaylistRepository = require('../../domain/repositories/IPlaylistRepository');
const Playlist = require('../../domain/entities/Playlist');
const Video = require('../../domain/entities/Video');

class PrismaPlaylistRepository extends IPlaylistRepository {
    constructor(prismaClient) {
        super();
        if (!prismaClient) {
            throw new Error('Prisma client is required');
        }
        this.prisma = prismaClient;
    }

    _buildInclude(options = {}) {
        const include = {};

        // Always include videos if not explicitly excluded
        if (options.includeVideos !== false) {
            include.videos = {
                include: { video: true },
                orderBy: { position: 'asc' }
            };
        }

        // Include user if requested
        if (options.includeUser) {
            include.user = true;
        }

        // Return include object or undefined (Prisma accepts both)
        return Object.keys(include).length > 0 ? include : undefined;
    }

    _mapPlaylist(record, options = {}) {
        if (!record) {
            return null;
        }

        // Create playlist entity without videos first
        const playlistData = {
            id: record.id,
            title: record.title,
            description: record.description,
            isPublic: record.isPublic,
            slug: record.slug,
            userId: record.userId,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            videos: [], // Start with empty array
            user: null
        };

        const playlist = new Playlist(playlistData);

        // Add user if available and requested
        if (record.user && options.includeUser !== false) {
            playlist.user = {
                id: record.user.id,
                username: record.user.username,
                email: record.user.email
            };
        }

        // Add videos if available and requested
        if (options.includeVideos !== false) {
            // Debug: Log what we received
            console.debug(`Mapping playlist ${record.id}:`, {
                hasVideos: !!record.videos,
                videosIsArray: Array.isArray(record.videos),
                videoCount: Array.isArray(record.videos) ? record.videos.length : 'not array',
                firstVideoHasVideo: record.videos?.[0]?.video ? true : false
            });

            if (record.videos && Array.isArray(record.videos) && record.videos.length > 0) {
                const mappedVideos = record.videos
                    .sort((a, b) => (a.position || 0) - (b.position || 0))
                    .map((item, index) => {
                        if (!item) {
                            console.debug(`Skipping null video item at index ${index}`);
                            return null;
                        }

                        let video = null;
                        if (item.video) {
                            try {
                                video = Video.fromDatabase(item.video);
                                console.debug(`Mapped video ${item.videoId} successfully for playlist ${record.id}`);
                            } catch (err) {
                                console.error(`Error mapping video ${item.videoId} for playlist ${record.id}:`, err);
                                console.error(`Video data keys:`, item.video ? Object.keys(item.video) : 'no video');
                                console.error(`Video data:`, JSON.stringify(item.video, null, 2));
                                // Continue without video data if mapping fails
                                video = null;
                            }
                        } else {
                            console.debug(`Video item ${item.videoId} has no video relation for playlist ${record.id}`);
                        }

                        const mappedItem = {
                            id: item.id,
                            position: item.position || 0,
                            addedAt: item.addedAt,
                            videoId: item.videoId,
                            video
                        };

                        return mappedItem;
                    })
                    .filter(Boolean); // Remove any null entries

                playlist.videos = mappedVideos;
                console.debug(`Mapped ${mappedVideos.length} videos for playlist ${record.id}`);
            } else {
                // Videos were requested but not found - log for debugging
                if (options.includeVideos === true) {
                    console.debug(`Playlist ${record.id}: Videos were requested but record.videos is:`, {
                        videos: record.videos,
                        type: typeof record.videos,
                        isArray: Array.isArray(record.videos),
                        length: Array.isArray(record.videos) ? record.videos.length : 'N/A'
                    });
                }
                playlist.videos = [];
            }
        } else {
            // Explicitly set to empty array if videos not requested
            playlist.videos = [];
        }

        return playlist;
    }

    /**
     * @param {import('../../domain/entities/Playlist')} playlist
     * @param {Array} videos
     * @returns {Promise<import('../../domain/entities/Playlist')>}
     */
    async createPlaylist(playlist, videos = []) {
        if (!this.prisma) {
            throw new Error('Prisma client not initialized');
        }

        const data = {
            id: playlist.id,
            title: playlist.title,
            description: playlist.description,
            isPublic: playlist.isPublic,
            slug: playlist.slug,
            userId: playlist.userId,
            createdAt: playlist.createdAt,
            updatedAt: playlist.updatedAt,
            videos: videos.length
                ? {
                    create: videos.map((video, index) => ({
                        id: randomUUID(),
                        videoId: video.videoId,
                        position: video.position ?? index,
                        addedAt: new Date()
                    }))
                }
                : undefined
        };

        if (!this.prisma.playlist || typeof this.prisma.playlist.create !== 'function') {
            const availableModels = Object.keys(this.prisma).filter(key => !key.startsWith('$') && !key.startsWith('_'));
            throw new Error(`Prisma playlist model not available. Available models: ${availableModels.join(', ')}. Please run 'npx prisma generate' and restart the server.`);
        }

        const created = await this.prisma.playlist.create({
            data,
            include: this._buildInclude({ includeVideos: true, includeUser: true })
        });

        return this._mapPlaylist(created, { includeVideos: true, includeUser: true });
    }

    /**
     * @param {import('../../domain/entities/Playlist')} playlist
     * @returns {Promise<import('../../domain/entities/Playlist')>}
     */
    async updatePlaylist(playlist) {
        const updated = await this.prisma.playlist.update({
            where: { id: playlist.id },
            data: {
                title: playlist.title,
                description: playlist.description,
                isPublic: playlist.isPublic,
                slug: playlist.slug,
                updatedAt: new Date()
            },
            include: this._buildInclude({ includeVideos: true, includeUser: true })
        });

        return this._mapPlaylist(updated, { includeVideos: true, includeUser: true });
    }

    async deletePlaylist(playlistId) {
        await this.prisma.playlist.delete({ where: { id: playlistId } });
    }

    /**
     * @param {string} playlistId
     * @param {Object} options
     * @returns {Promise<import('../../domain/entities/Playlist')|null>}
     */
    async getPlaylistById(playlistId, options = {}) {
        if (!this.prisma) {
            throw new Error('Prisma client not initialized');
        }
        if (!this.prisma.playlist || typeof this.prisma.playlist.findUnique !== 'function') {
            const availableModels = Object.keys(this.prisma).filter(key => !key.startsWith('$') && !key.startsWith('_'));
            throw new Error(`Prisma playlist model not available. Available models: ${availableModels.join(', ')}. Please run 'npx prisma generate' and restart the server.`);
        }

        const includeOptions = this._buildInclude(options);
        const playlist = await this.prisma.playlist.findUnique({
            where: { id: playlistId },
            include: includeOptions
        });

        if (!playlist) {
            return null;
        }

        // Debug: Log what we got from database
        if (options.includeVideos !== false) {
            const videoCount = playlist.videos ? playlist.videos.length : 0;
            console.debug(`Playlist ${playlistId}: Retrieved from DB with ${videoCount} videos. Include options:`, JSON.stringify(includeOptions));

            if (videoCount === 0 && includeOptions && includeOptions.videos) {
                // Check if videos exist in database but weren't included
                const videoCountRaw = await this.prisma.playlistVideo.count({
                    where: { playlistId }
                });
                if (videoCountRaw > 0) {
                    console.warn(`Playlist ${playlistId}: Database has ${videoCountRaw} videos but query returned 0. Include was:`, includeOptions);
                }
            }
        }

        return this._mapPlaylist(playlist, options);
    }

    /**
     * @param {string} slug
     * @param {Object} options
     * @returns {Promise<import('../../domain/entities/Playlist')|null>}
     */
    async getPlaylistBySlug(slug, options = {}) {
        if (!this.prisma) {
            throw new Error('Prisma client not initialized');
        }
        if (!slug) {
            return null;
        }

        // Check if playlist model exists, with better error message
        if (!this.prisma.playlist || typeof this.prisma.playlist.findUnique !== 'function') {
            const availableModels = Object.keys(this.prisma).filter(key => !key.startsWith('$') && !key.startsWith('_'));
            throw new Error(`Prisma playlist model not available. Available models: ${availableModels.join(', ')}. The Prisma client needs to be regenerated. Please run 'npx prisma generate' and restart the server.`);
        }

        const playlist = await this.prisma.playlist.findUnique({
            where: { slug },
            include: this._buildInclude(options)
        });

        return this._mapPlaylist(playlist, options);
    }

    /**
     * @param {Object} filters
     * @param {Object} pagination
     * @returns {Promise<{playlists: import('../../domain/entities/Playlist')[], total: number, limit: number, offset: number}>}
     */
    async listPlaylists(filters = {}, pagination = {}) {
        const { limit = 20, offset = 0 } = pagination;
        const where = {};

        if (filters.userId) {
            where.userId = filters.userId;
        }
        if (filters.isPublic !== undefined) {
            where.isPublic = filters.isPublic;
        }
        if (filters.search && filters.search.trim().length > 0) {
            where.OR = [
                { title: { contains: filters.search, mode: 'insensitive' } },
                { description: { contains: filters.search, mode: 'insensitive' } }
            ];
        }

        const [items, total] = await this.prisma.$transaction([
            this.prisma.playlist.findMany({
                where,
                take: limit,
                skip: offset,
                orderBy: { createdAt: 'desc' },
                include: this._buildInclude({ includeVideos: true, includeUser: true })
            }),
            this.prisma.playlist.count({ where })
        ]);

        return {
            playlists: items.map(item => {
                const mapped = this._mapPlaylist(item, { includeVideos: true, includeUser: true });
                // Ensure videos is always an array, even when not included
                if (mapped && !Array.isArray(mapped.videos)) {
                    mapped.videos = [];
                }
                return mapped;
            }),
            total,
            limit,
            offset
        };
    }

    async addVideoToPlaylist(playlistId, videoId, position) {
        if (!this.prisma) {
            throw new Error('Prisma client not initialized');
        }
        if (!this.prisma.playlist || !this.prisma.playlistVideo) {
            throw new Error('Prisma playlist models not available. Make sure Prisma client is properly generated.');
        }

        return await this.prisma.$transaction(async (tx) => {
            const playlist = await tx.playlist.findUnique({
                where: { id: playlistId },
                include: { videos: { orderBy: { position: 'asc' } } }
            });

            if (!playlist) {
                return null;
            }

            const existing = playlist.videos.find(item => item.videoId === videoId);
            if (existing) {
                // Video already in playlist, return updated playlist using transaction
                const updated = await tx.playlist.findUnique({
                    where: { id: playlistId },
                    include: {
                        videos: { include: { video: true }, orderBy: { position: 'asc' } },
                        user: true
                    }
                });
                return this._mapPlaylist(updated, { includeVideos: true, includeUser: true });
            }

            const targetPosition = typeof position === 'number' && position >= 0
                ? Math.min(position, playlist.videos.length)
                : playlist.videos.length;

            // Shift positions for videos at or after target position
            if (playlist.videos.length > 0 && targetPosition < playlist.videos.length) {
                // Get videos that need position updates, sorted by position descending
                // We update from highest to lowest to avoid position conflicts
                const videosToShift = playlist.videos
                    .filter(v => v.position >= targetPosition)
                    .sort((a, b) => b.position - a.position);

                // Update positions sequentially from highest to lowest (SQLite compatibility)
                for (const videoItem of videosToShift) {
                    await tx.playlistVideo.update({
                        where: { id: videoItem.id },
                        data: { position: videoItem.position + 1 }
                    });
                }
            }

            // Create new playlist video entry
            await tx.playlistVideo.create({
                data: {
                    id: randomUUID(),
                    playlistId,
                    videoId,
                    position: targetPosition,
                    addedAt: new Date()
                }
            });

            const updated = await tx.playlist.findUnique({
                where: { id: playlistId },
                include: {
                    videos: { include: { video: true }, orderBy: { position: 'asc' } },
                    user: true
                }
            });

            return this._mapPlaylist(updated, { includeVideos: true, includeUser: true });
        });
    }

    async removeVideoFromPlaylist(playlistId, videoId) {
        return await this.prisma.$transaction(async (tx) => {
            const playlist = await tx.playlist.findUnique({
                where: { id: playlistId },
                include: { videos: { orderBy: { position: 'asc' } } }
            });

            if (!playlist) {
                return null;
            }

            const exists = playlist.videos.find(item => item.videoId === videoId);
            if (!exists) {
                return this._mapPlaylist(playlist, { includeVideos: true });
            }

            await tx.playlistVideo.delete({
                where: {
                    playlistId_videoId: {
                        playlistId,
                        videoId
                    }
                }
            });

            const remaining = await tx.playlistVideo.findMany({
                where: { playlistId },
                orderBy: { position: 'asc' }
            });

            await Promise.all(remaining.map((item, index) => tx.playlistVideo.update({
                where: { id: item.id },
                data: { position: index }
            })));

            const updated = await tx.playlist.findUnique({
                where: { id: playlistId },
                include: {
                    videos: { include: { video: true }, orderBy: { position: 'asc' } },
                    user: true
                }
            });

            return this._mapPlaylist(updated, { includeVideos: true, includeUser: true });
        });
    }

    async reorderPlaylistVideos(playlistId, orderedVideoIds) {
        return await this.prisma.$transaction(async (tx) => {
            const playlist = await tx.playlist.findUnique({
                where: { id: playlistId },
                include: { videos: { orderBy: { position: 'asc' } } }
            });

            if (!playlist) {
                return null;
            }

            const currentVideoIds = playlist.videos.map(video => video.videoId);
            const incomingIds = Array.from(new Set(orderedVideoIds));

            const isSameSet = currentVideoIds.length === incomingIds.length
                && currentVideoIds.every(id => incomingIds.includes(id));

            if (!isSameSet) {
                throw new Error('Playlist order must include the same videos');
            }

            await Promise.all(incomingIds.map((videoId, index) => tx.playlistVideo.update({
                where: {
                    playlistId_videoId: {
                        playlistId,
                        videoId
                    }
                },
                data: { position: index }
            })));

            const updated = await tx.playlist.findUnique({
                where: { id: playlistId },
                include: {
                    videos: { include: { video: true }, orderBy: { position: 'asc' } },
                    user: true
                }
            });

            return this._mapPlaylist(updated, { includeVideos: true, includeUser: true });
        });
    }
}

module.exports = PrismaPlaylistRepository;

