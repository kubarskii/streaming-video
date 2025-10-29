// @ts-check
// Infrastructure: PrismaSubscriptionRepository

const ISubscriptionRepository = require('../../domain/repositories/ISubscriptionRepository');
const Subscription = require('../../domain/entities/Subscription');

class PrismaSubscriptionRepository extends ISubscriptionRepository {
    constructor(prismaClient) {
        super();
        this.prisma = prismaClient;
    }

    async create(subscription) {
        const data = {
            id: subscription.id,
            userId: subscription.userId,
            channelId: subscription.channelId,
            subscribedAt: subscription.subscribedAt,
        };

        const saved = await this.prisma.subscription.create({
            data,
        });

        return Subscription.fromDatabase(saved);
    }

    async findByUserAndChannel(userId, channelId) {
        const record = await this.prisma.subscription.findUnique({
            where: {
                userId_channelId: {
                    userId,
                    channelId
                }
            },
        });

        return record ? Subscription.fromDatabase(record) : null;
    }

    async findByUserId(userId, options = {}) {
        const { limit = 20, offset = 0 } = options;

        const records = await this.prisma.subscription.findMany({
            where: { userId },
            take: limit,
            skip: offset,
            orderBy: { subscribedAt: 'desc' },
            include: {
                channel: {
                    include: {
                        user: true
                    }
                }
            }
        });

        return records.map(record => Subscription.fromDatabase(record));
    }

    async findByChannelId(channelId, options = {}) {
        const { limit = 20, offset = 0 } = options;

        const records = await this.prisma.subscription.findMany({
            where: { channelId },
            take: limit,
            skip: offset,
            orderBy: { subscribedAt: 'desc' },
            include: {
                user: true
            }
        });

        return records.map(record => Subscription.fromDatabase(record));
    }

    async delete(userId, channelId) {
        await this.prisma.subscription.delete({
            where: {
                userId_channelId: {
                    userId,
                    channelId
                }
            },
        });
    }

    async exists(userId, channelId) {
        const count = await this.prisma.subscription.count({
            where: {
                userId,
                channelId
            }
        });

        return count > 0;
    }
}

module.exports = PrismaSubscriptionRepository;

