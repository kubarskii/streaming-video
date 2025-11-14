// @ts-check
const { test, describe } = require('node:test');
const assert = require('node:assert');
const UpdateCommentUseCase = require('../../src/application/use-cases/UpdateCommentUseCase');

describe('UpdateCommentUseCase', () => {
    const createUseCase = () => {
        const mockCommentRepository = {
            findById: async (id) => {
                if (id === 'comment-123') {
                    return {
                        id: 'comment-123',
                        videoId: 'video-123',
                        userId: 'user-123',
                        content: 'Original comment',
                        updatedAt: new Date()
                    };
                }
                return null;
            },
            update: async (comment) => comment
        };

        return new UpdateCommentUseCase(mockCommentRepository);
    };

    test('should update comment successfully', async () => {
        const useCase = createUseCase();
        const input = {
            commentId: 'comment-123',
            userId: 'user-123',
            content: 'Updated comment'
        };

        const result = await useCase.execute(input);

        assert.strictEqual(result.content, 'Updated comment');
        assert.ok(result.updatedAt instanceof Date);
    });

    test('should sanitize updated content', async () => {
        const useCase = createUseCase();
        const input = {
            commentId: 'comment-123',
            userId: 'user-123',
            content: '<script>alert("XSS")</script>Updated'
        };

        const result = await useCase.execute(input);

        assert.ok(!result.content.includes('<script>'));
        assert.ok(result.content.includes('Updated'));
    });

    test('should throw error if comment ID is missing', async () => {
        const useCase = createUseCase();
        const input = {
            userId: 'user-123',
            content: 'Updated comment'
        };

        await assert.rejects(
            () => useCase.execute(input),
            /Comment ID is required/
        );
    });

    test('should throw error if user ID is missing', async () => {
        const useCase = createUseCase();
        const input = {
            commentId: 'comment-123',
            content: 'Updated comment'
        };

        await assert.rejects(
            () => useCase.execute(input),
            /User ID is required/
        );
    });

    test('should throw error if content is missing', async () => {
        const useCase = createUseCase();
        const input = {
            commentId: 'comment-123',
            userId: 'user-123',
            content: ''
        };

        await assert.rejects(
            () => useCase.execute(input),
            /Comment content is required/
        );
    });

    test('should throw error if comment not found', async () => {
        const useCase = createUseCase();
        const input = {
            commentId: 'invalid-comment-id',
            userId: 'user-123',
            content: 'Updated comment'
        };

        await assert.rejects(
            () => useCase.execute(input),
            /Comment not found/
        );
    });

    test('should throw error if user is not the owner', async () => {
        const useCase = createUseCase();
        const input = {
            commentId: 'comment-123',
            userId: 'different-user',
            content: 'Updated comment'
        };

        await assert.rejects(
            () => useCase.execute(input),
            /Unauthorized: You can only edit your own comments/
        );
    });
});

