// @ts-check
// Infrastructure: PrismaVideoRepository
// Implementation of IVideoRepository using Prisma ORM

const IVideoRepository = require('../../domain/repositories/IVideoRepository');
const Video = require('../../domain/entities/Video');

class PrismaVideoRepository extends IVideoRepository {
    constructor(prismaClient) {
        super();
        this.prisma = prismaClient;
    }

    async save(video) {
        const data = {
            id: video.id,
            title: video.title,
            description: video.description,
            fileName: video.fileName,
            storageKey: video.storageKey,
            storageUrl: video.storageUrl,
            cdnUrl: video.cdnUrl,
            mimeType: video.mimeType,
            sizeBytes: BigInt(video.sizeBytes),
            durationMs: video.durationMs,
            width: video.width,
            height: video.height,
            status: video.status,
            uploadedAt: video.uploadedAt,
            userId: video.userId,
            thumbnailUrl: video.thumbnailUrl,
        };

        const saved = await this.prisma.video.create({
            data,
        });

        return Video.fromDatabase(saved);
    }

    async findById(id) {
        const record = await this.prisma.video.findUnique({
            where: { id },
        });

        return record ? Video.fromDatabase(record) : null;
    }

    async findByStorageKey(storageKey) {
        const record = await this.prisma.video.findUnique({
            where: { storageKey },
        });

        return record ? Video.fromDatabase(record) : null;
    }

    async findByFileName(fileName) {
        const record = await this.prisma.video.findUnique({
            where: { fileName },
        });

        return record ? Video.fromDatabase(record) : null;
    }

    async findAll(options = {}) {
        const { limit = 50, offset = 0, status, userId, search, orderBy = 'uploadedAt', order = 'desc' } = options;

        const where = {};
        if (status) where.status = status;
        if (userId) where.userId = userId;

        // Add full-text search across video title, description, and channel name
        // Note: SQLite LIKE is case-insensitive by default for ASCII characters
        if (search && search.trim()) {
            where.OR = [
                {
                    title: {
                        contains: search
                    }
                },
                {
                    description: {
                        contains: search
                    }
                },
                {
                    user: {
                        channel: {
                            name: {
                                contains: search
                            }
                        }
                    }
                }
            ];
        }

        const records = await this.prisma.video.findMany({
            where,
            take: limit,
            skip: offset,
            orderBy: { [orderBy]: order },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        channel: {
                            select: {
                                id: true,
                                name: true,
                            }
                        }
                    }
                }
            }
        });

        return records.map(record => Video.fromDatabase(record));
    }

    async update(video) {
        const data = {
            title: video.title,
            description: video.description,
            storageUrl: video.storageUrl,
            cdnUrl: video.cdnUrl,
            durationMs: video.durationMs,
            width: video.width,
            height: video.height,
            status: video.status,
            updatedAt: video.updatedAt,
            thumbnailUrl: video.thumbnailUrl,
        };

        const updated = await this.prisma.video.update({
            where: { id: video.id },
            data,
        });

        return Video.fromDatabase(updated);
    }

    async deleteById(id) {
        try {
            await this.prisma.video.delete({
                where: { id },
            });
            return true;
        } catch (error) {
            console.error('Error deleting video:', error);
            return false;
        }
    }

    async count(filter = {}) {
        const where = {};
        if (filter.status) where.status = filter.status;
        if (filter.userId) where.userId = filter.userId;

        // Add full-text search across video title, description, and channel name
        // Note: SQLite LIKE is case-insensitive by default for ASCII characters
        if (filter.search && filter.search.trim()) {
            where.OR = [
                {
                    title: {
                        contains: filter.search
                    }
                },
                {
                    description: {
                        contains: filter.search
                    }
                },
                {
                    user: {
                        channel: {
                            name: {
                                contains: filter.search
                            }
                        }
                    }
                }
            ];
        }

        return await this.prisma.video.count({ where });
    }

    async incrementViews(id) {
        const updated = await this.prisma.video.update({
            where: { id },
            data: {
                views: {
                    increment: 1
                }
            },
            select: {
                views: true
            }
        });

        return updated.views;
    }
}

module.exports = PrismaVideoRepository;

