// @ts-check
const { test, describe } = require('node:test');
const assert = require('node:assert');

const LikeVideoUseCase = require('../../src/application/use-cases/LikeVideoUseCase');

describe('LikeVideoUseCase', () => {
    test('should like a video successfully', async () => {
        let savedLike = null;
        const mockVideoLikeRepository = {
            findByUserAndVideo: async (userId, videoId) => null,
            create: async (like) => {
                savedLike = like;
                return { ...like, id: 'like-id' };
            },
            save: async (like) => {
                savedLike = like;
                return { ...like, id: 'like-id' };
            },
            update: async (like) => {
                return like;
            }
        };
        
        const mockVideoRepository = {
            findById: async (videoId) => {
                assert.strictEqual(videoId, 'test-video-id');
                return { id: 'test-video-id', title: 'Test Video' };
            }
        };
        
        const useCase = new LikeVideoUseCase(mockVideoLikeRepository, mockVideoRepository);
        
        const result = await useCase.execute({
            userId: 'test-user-id',
            videoId: 'test-video-id',
            isLike: true
        });
        
        assert.ok(result);
        assert.strictEqual(savedLike.userId, 'test-user-id');
        assert.strictEqual(savedLike.videoId, 'test-video-id');
        assert.strictEqual(savedLike.isLike, true);
    });

    test('should return error if video not found', async () => {
        const mockVideoLikeRepository = {
            findByUserAndVideo: async () => null,
            create: async () => {}
        };
        
        const mockVideoRepository = {
            findById: async () => null
        };
        
        const useCase = new LikeVideoUseCase(mockVideoLikeRepository, mockVideoRepository);
        
        try {
            await useCase.execute({
                userId: 'test-user-id',
                videoId: 'non-existent-video',
                isLike: true
            });
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.strictEqual(error.message, 'Video not found');
        }
    });

    test('should return error if already liked', async () => {
        const mockVideoLikeRepository = {
            findByUserAndVideo: async (userId, videoId) => {
                return { id: 'existing-like', userId, videoId, isLike: true };
            },
            save: async () => {},
            update: async () => {},
            deleteByUserAndVideo: async () => {}
        };
        
        const mockVideoRepository = {
            findById: async () => ({ id: 'test-video-id' })
        };
        
        const useCase = new LikeVideoUseCase(mockVideoLikeRepository, mockVideoRepository);
        
        // When already liked with same isLike value, it should remove the like (return null)
        const result = await useCase.execute({
            userId: 'test-user-id',
            videoId: 'test-video-id',
            isLike: true
        });
        
        // Should return null when removing like (same action)
        assert.strictEqual(result, null);
    });
});

