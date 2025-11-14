// @ts-check
const { test, describe } = require('node:test');
const assert = require('node:assert');
const CreateCommentUseCase = require('../../src/application/use-cases/CreateCommentUseCase');
const Comment = require('../../src/domain/entities/Comment');

describe('CreateCommentUseCase', () => {
    const createUseCase = () => {
        const mockCommentRepository = {
            save: async (comment) => comment
        };

        const mockVideoRepository = {
            findById: async (id) => {
                if (id === 'valid-video-id') {
                    return { id: 'valid-video-id', title: 'Test Video' };
                }
                return null;
            }
        };

        return new CreateCommentUseCase(mockCommentRepository, mockVideoRepository);
    };

    test('should create a comment successfully', async () => {
        const useCase = createUseCase();
        const input = {
            videoId: 'valid-video-id',
            userId: 'user-123',
            content: 'Great video!'
        };

        const result = await useCase.execute(input);

        assert.ok(result instanceof Comment);
        assert.strictEqual(result.videoId, 'valid-video-id');
        assert.strictEqual(result.userId, 'user-123');
        assert.strictEqual(result.content, 'Great video!');
    });

    test('should sanitize comment content', async () => {
        const useCase = createUseCase();
        const input = {
            videoId: 'valid-video-id',
            userId: 'user-123',
            content: '<script>alert("XSS")</script>Hello World'
        };

        const result = await useCase.execute(input);

        assert.ok(!result.content.includes('<script>'));
        assert.ok(result.content.includes('Hello World'));
    });

    test('should throw error if video ID is missing', async () => {
        const useCase = createUseCase();
        const input = {
            userId: 'user-123',
            content: 'Test comment'
        };

        await assert.rejects(
            () => useCase.execute(input),
            /Video ID is required/
        );
    });

    test('should throw error if user ID is missing', async () => {
        const useCase = createUseCase();
        const input = {
            videoId: 'valid-video-id',
            content: 'Test comment'
        };

        await assert.rejects(
            () => useCase.execute(input),
            /User ID is required/
        );
    });

    test('should throw error if content is missing', async () => {
        const useCase = createUseCase();
        const input = {
            videoId: 'valid-video-id',
            userId: 'user-123',
            content: ''
        };

        await assert.rejects(
            () => useCase.execute(input),
            /Comment content is required/
        );
    });

    test('should throw error if video not found', async () => {
        const useCase = createUseCase();
        const input = {
            videoId: 'invalid-video-id',
            userId: 'user-123',
            content: 'Test comment'
        };

        await assert.rejects(
            () => useCase.execute(input),
            /Video not found/
        );
    });

    test('should trim whitespace from content', async () => {
        const useCase = createUseCase();
        const input = {
            videoId: 'valid-video-id',
            userId: 'user-123',
            content: '  Test comment  '
        };

        const result = await useCase.execute(input);
        assert.strictEqual(result.content, 'Test comment');
    });
});

