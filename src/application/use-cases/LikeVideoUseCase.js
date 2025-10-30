// @ts-check
// Application Layer: Like Video Use Case
// Handles liking or disliking a video

const VideoLike = require('../../domain/entities/VideoLike');
const { randomUUID } = require('crypto');

/**
 * Use case for liking or disliking a video
 */
class LikeVideoUseCase {
    /**
     * Creates an instance of LikeVideoUseCase
     * @param {import('../../domain/repositories/IVideoLikeRepository')} videoLikeRepository
     * @param {import('../../domain/repositories/IVideoRepository')} videoRepository
     */
    constructor(videoLikeRepository, videoRepository) {
        this.videoLikeRepository = videoLikeRepository;
        this.videoRepository = videoRepository;
    }

    /**
     * Execute the use case
     * @param {Object} input
     * @param {string} input.videoId - Video ID
     * @param {string} input.userId - User ID
     * @param {boolean} input.isLike - true for like, false for dislike
     * @returns {Promise<VideoLike>}
     */
    async execute(input) {
        const { videoId, userId, isLike } = input;

        // Validate input
        if (!videoId) {
            throw new Error('Video ID is required');
        }
        if (!userId) {
            throw new Error('User ID is required');
        }
        if (typeof isLike !== 'boolean') {
            throw new Error('isLike must be a boolean');
        }

        // Verify video exists
        const video = await this.videoRepository.findById(videoId);
        if (!video) {
            throw new Error('Video not found');
        }

        // Check if user already liked/disliked this video
        const existingLike = await this.videoLikeRepository.findByUserAndVideo(userId, videoId);

        if (existingLike) {
            // If the same action (like->like or dislike->dislike), remove it
            if (existingLike.isLike === isLike) {
                await this.videoLikeRepository.deleteByUserAndVideo(userId, videoId);
                return null;
            } else {
                // Otherwise, update it (like->dislike or dislike->like)
                existingLike.isLike = isLike;
                existingLike.updatedAt = new Date();
                return await this.videoLikeRepository.update(existingLike);
            }
        }

        // Create new like/dislike
        const videoLike = new VideoLike({
            id: randomUUID(),
            videoId,
            userId,
            isLike,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        return await this.videoLikeRepository.save(videoLike);
    }
}

module.exports = LikeVideoUseCase;

