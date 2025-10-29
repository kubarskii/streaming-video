// @ts-check
// Infrastructure: PrismaCommentRepository
// Implementation of ICommentRepository using Prisma ORM

const ICommentRepository = require('../../domain/repositories/ICommentRepository');
const Comment = require('../../domain/entities/Comment');

/**
 * Prisma implementation of comment repository
 */
class PrismaCommentRepository extends ICommentRepository {
    /**
     * Creates a PrismaCommentRepository instance
     * @param {import('@prisma/client').PrismaClient} prismaClient
     */
    constructor(prismaClient) {
        super();
        this.prisma = prismaClient;
    }

    /**
     * Save a comment
     * @param {Comment} comment
     * @returns {Promise<Comment>}
     */
    async save(comment) {
        const data = {
            id: comment.id,
            videoId: comment.videoId,
            userId: comment.userId,
            content: comment.content,
            createdAt: comment.createdAt,
        };

        const saved = await this.prisma.comment.create({
            data,
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true
                    }
                }
            }
        });

        return Comment.fromDatabase(saved);
    }

    /**
     * Find comment by ID
     * @param {string} id
     * @returns {Promise<Comment|null>}
     */
    async findById(id) {
        const record = await this.prisma.comment.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true
                    }
                }
            }
        });

        return record ? Comment.fromDatabase(record) : null;
    }

    /**
     * Find comments by video ID
     * @param {string} videoId
     * @param {Object} options
     * @returns {Promise<Comment[]>}
     */
    async findByVideoId(videoId, options = {}) {
        const { limit = 50, offset = 0 } = options;

        const records = await this.prisma.comment.findMany({
            where: { videoId },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset
        });

        return records.map(record => Comment.fromDatabase(record));
    }

    /**
     * Find comments by user ID
     * @param {string} userId
     * @param {Object} options
     * @returns {Promise<Comment[]>}
     */
    async findByUserId(userId, options = {}) {
        const { limit = 50, offset = 0 } = options;

        const records = await this.prisma.comment.findMany({
            where: { userId },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset
        });

        return records.map(record => Comment.fromDatabase(record));
    }

    /**
     * Update a comment
     * @param {Comment} comment
     * @returns {Promise<Comment>}
     */
    async update(comment) {
        const data = {
            content: comment.content,
            updatedAt: new Date()
        };

        const updated = await this.prisma.comment.update({
            where: { id: comment.id },
            data,
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true
                    }
                }
            }
        });

        return Comment.fromDatabase(updated);
    }

    /**
     * Delete comment by ID
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async deleteById(id) {
        try {
            await this.prisma.comment.delete({
                where: { id }
            });
            return true;
        } catch (error) {
            console.error('Error deleting comment:', error);
            return false;
        }
    }

    /**
     * Count comments for a video
     * @param {string} videoId
     * @returns {Promise<number>}
     */
    async countByVideoId(videoId) {
        return await this.prisma.comment.count({
            where: { videoId }
        });
    }
}

module.exports = PrismaCommentRepository;

