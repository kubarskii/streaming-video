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
        this.prisma = prismaClient;
    }

    _buildInclude(options = {}) {
        const include = {};
        if (options.includeVideos !== false) {
            include.videos = {
                include: { video: true },
                orderBy: { position: 'asc' }
            };
        }
        if (options.includeUser) {
            include.user = true;
        }
        return Object.keys(include).length ? include : undefined;
    }

    _mapPlaylist(record, options = {}) {
        if (!record) {
            return null;
        }

        const playlist = Playlist.fromDatabase(record);

        if (record.user && options.includeUser !== false) {
            playlist.user = {
                id: record.user.id,
                username: record.user.username,
                email: record.user.email
            };
        }

        if (record.videos && options.includeVideos !== false) {
            playlist.videos = record.videos
                .sort((a, b) => a.position - b.position)
                .map(item => ({
                    id: item.id,
                    position: item.position,
                    addedAt: item.addedAt,
                    videoId: item.videoId,
                    video: item.video ? Video.fromDatabase(item.video) : null
                }));
        }

        return playlist;
    }

    async createPlaylist(playlist, videos = []) {
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

        const created = await this.prisma.playlist.create({
            data,
            include: this._buildInclude({ includeVideos: true, includeUser: true })
        });

        return this._mapPlaylist(created, { includeVideos: true, includeUser: true });
    }

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

    async getPlaylistById(playlistId, options = {}) {
        const playlist = await this.prisma.playlist.findUnique({
            where: { id: playlistId },
            include: this._buildInclude(options)
        });

        return this._mapPlaylist(playlist, options);
    }

    async getPlaylistBySlug(slug, options = {}) {
        const playlist = await this.prisma.playlist.findUnique({
            where: { slug },
            include: this._buildInclude(options)
        });

        return this._mapPlaylist(playlist, options);
    }

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
                include: this._buildInclude({ includeVideos: false, includeUser: true })
            }),
            this.prisma.playlist.count({ where })
        ]);

        return {
            playlists: items.map(item => this._mapPlaylist(item, { includeVideos: false, includeUser: true })),
            total,
            limit,
            offset
        };
    }

    async addVideoToPlaylist(playlistId, videoId, position) {
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
                return await this.getPlaylistById(playlistId, { includeVideos: true, includeUser: true });
            }

            const targetPosition = typeof position === 'number' && position >= 0
                ? Math.min(position, playlist.videos.length)
                : playlist.videos.length;

            if (playlist.videos.length > 0) {
                await tx.playlistVideo.updateMany({
                    where: {
                        playlistId,
                        position: { gte: targetPosition }
                    },
                    data: {
                        position: { increment: 1 }
                    }
                });
            }

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

