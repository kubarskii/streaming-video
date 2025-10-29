// @ts-check
// Infrastructure: PrismaChannelRepository

const IChannelRepository = require('../../domain/repositories/IChannelRepository');
const Channel = require('../../domain/entities/Channel');

class PrismaChannelRepository extends IChannelRepository {
    constructor(prismaClient) {
        super();
        this.prisma = prismaClient;
    }

    async create(channel) {
        const data = {
            id: channel.id,
            userId: channel.userId,
            name: channel.name,
            description: channel.description,
            avatarUrl: channel.avatarUrl,
            bannerUrl: channel.bannerUrl,
            subscriberCount: channel.subscriberCount,
            videoCount: channel.videoCount,
            createdAt: channel.createdAt,
        };

        const saved = await this.prisma.channel.create({
            data,
        });

        return Channel.fromDatabase(saved);
    }

    async findById(id) {
        const record = await this.prisma.channel.findUnique({
            where: { id },
            include: {
                user: true
            }
        });

        return record ? Channel.fromDatabase(record) : null;
    }

    async findByUserId(userId) {
        const record = await this.prisma.channel.findUnique({
            where: { userId },
            include: {
                user: true
            }
        });

        return record ? Channel.fromDatabase(record) : null;
    }

    async update(id, updates) {
        const updated = await this.prisma.channel.update({
            where: { id },
            data: {
                ...updates,
                updatedAt: new Date(),
            },
        });

        return Channel.fromDatabase(updated);
    }

    async delete(id) {
        await this.prisma.channel.delete({
            where: { id },
        });
    }

    async findAll(options = {}) {
        const { limit = 20, offset = 0, sortBy = 'subscriberCount' } = options;

        let orderBy = {};
        if (sortBy === 'subscriberCount') {
            orderBy = { subscriberCount: 'desc' };
        } else if (sortBy === 'createdAt') {
            orderBy = { createdAt: 'desc' };
        } else if (sortBy === 'videoCount') {
            orderBy = { videoCount: 'desc' };
        }

        const records = await this.prisma.channel.findMany({
            take: limit,
            skip: offset,
            orderBy,
            include: {
                user: true
            }
        });

        return records.map(record => Channel.fromDatabase(record));
    }

    async incrementSubscriberCount(channelId) {
        await this.prisma.channel.update({
            where: { id: channelId },
            data: {
                subscriberCount: { increment: 1 },
                updatedAt: new Date(),
            },
        });
    }

    async decrementSubscriberCount(channelId) {
        await this.prisma.channel.update({
            where: { id: channelId },
            data: {
                subscriberCount: { decrement: 1 },
                updatedAt: new Date(),
            },
        });
    }
}

module.exports = PrismaChannelRepository;

