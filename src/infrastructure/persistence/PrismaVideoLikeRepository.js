// @ts-check
// Infrastructure: PrismaVideoLikeRepository
// Implementation of IVideoLikeRepository using Prisma ORM

const IVideoLikeRepository = require('../../domain/repositories/IVideoLikeRepository');
const VideoLike = require('../../domain/entities/VideoLike');

/**
 * Prisma implementation of video like repository
 */
class PrismaVideoLikeRepository extends IVideoLikeRepository {
    /**
     * Creates a PrismaVideoLikeRepository instance
     * @param {import('@prisma/client').PrismaClient} prismaClient
     */
    constructor(prismaClient) {
        super();
        this.prisma = prismaClient;
    }

    /**
     * Save a video like
     * @param {VideoLike} videoLike
     * @returns {Promise<VideoLike>}
     */
    async save(videoLike) {
        const data = {
            id: videoLike.id,
            videoId: videoLike.videoId,
            userId: videoLike.userId,
            isLike: videoLike.isLike,
            createdAt: videoLike.createdAt,
        };

        const saved = await this.prisma.videoLike.create({
            data
        });

        return VideoLike.fromDatabase(saved);
    }

    /**
     * Find like by user and video
     * @param {string} userId
     * @param {string} videoId
     * @returns {Promise<VideoLike|null>}
     */
    async findByUserAndVideo(userId, videoId) {
        const record = await this.prisma.videoLike.findUnique({
            where: {
                userId_videoId: {
                    userId,
                    videoId
                }
            }
        });

        return record ? VideoLike.fromDatabase(record) : null;
    }

    /**
     * Update a video like
     * @param {VideoLike} videoLike
     * @returns {Promise<VideoLike>}
     */
    async update(videoLike) {
        const data = {
            isLike: videoLike.isLike,
            updatedAt: new Date()
        };

        const updated = await this.prisma.videoLike.update({
            where: {
                userId_videoId: {
                    userId: videoLike.userId,
                    videoId: videoLike.videoId
                }
            },
            data
        });

        return VideoLike.fromDatabase(updated);
    }

    /**
     * Delete like by user and video
     * @param {string} userId
     * @param {string} videoId
     * @returns {Promise<boolean>}
     */
    async deleteByUserAndVideo(userId, videoId) {
        try {
            await this.prisma.videoLike.delete({
                where: {
                    userId_videoId: {
                        userId,
                        videoId
                    }
                }
            });
            return true;
        } catch (error) {
            console.error('Error deleting video like:', error);
            return false;
        }
    }

    /**
     * Count likes for a video
     * @param {string} videoId
     * @returns {Promise<number>}
     */
    async countLikesByVideoId(videoId) {
        return await this.prisma.videoLike.count({
            where: {
                videoId,
                isLike: true
            }
        });
    }

    /**
     * Count dislikes for a video
     * @param {string} videoId
     * @returns {Promise<number>}
     */
    async countDislikesByVideoId(videoId) {
        return await this.prisma.videoLike.count({
            where: {
                videoId,
                isLike: false
            }
        });
    }

    /**
     * Get like stats for a video
     * @param {string} videoId
     * @returns {Promise<{likes: number, dislikes: number}>}
     */
    async getVideoLikeStats(videoId) {
        const [likes, dislikes] = await Promise.all([
            this.countLikesByVideoId(videoId),
            this.countDislikesByVideoId(videoId)
        ]);

        return { likes, dislikes };
    }
}

module.exports = PrismaVideoLikeRepository;

