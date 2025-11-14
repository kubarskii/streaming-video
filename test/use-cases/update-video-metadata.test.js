// @ts-check
const { test, describe } = require('node:test');
const assert = require('node:assert');
const UpdateVideoMetadataUseCase = require('../../src/application/use-cases/UpdateVideoMetadataUseCase');

describe('UpdateVideoMetadataUseCase', () => {
    const createUseCase = () => {
        const mockVideoRepository = {
            findById: async (id) => {
                if (id === 'video-123') {
                    return {
                        id: 'video-123',
                        userId: 'user-123',
                        title: 'Original Title',
                        description: 'Original description',
                        updatedAt: new Date()
                    };
                }
                return null;
            },
            update: async (video) => video
        };

        return new UpdateVideoMetadataUseCase(mockVideoRepository);
    };

    test('should update video title successfully', async () => {
        const useCase = createUseCase();
        const result = await useCase.execute('video-123', 'user-123', {
            title: 'New Title'
        });

        assert.strictEqual(result.title, 'New Title');
        assert.ok(result.updatedAt instanceof Date);
    });

    test('should update video description successfully', async () => {
        const useCase = createUseCase();
        const result = await useCase.execute('video-123', 'user-123', {
            description: 'New description'
        });

        assert.strictEqual(result.description, 'New description');
    });

    test('should update both title and description', async () => {
        const useCase = createUseCase();
        const result = await useCase.execute('video-123', 'user-123', {
            title: 'New Title',
            description: 'New description'
        });

        assert.strictEqual(result.title, 'New Title');
        assert.strictEqual(result.description, 'New description');
    });

    test('should sanitize title and description', async () => {
        const useCase = createUseCase();
        const result = await useCase.execute('video-123', 'user-123', {
            title: '<script>alert("XSS")</script>New Title',
            description: '<p>New description</p>'
        });

        assert.ok(!result.title.includes('<script>'));
        assert.ok(result.title.includes('New Title'));
        assert.ok(!result.description?.includes('<p>'));
    });

    test('should throw error if video not found', async () => {
        const useCase = createUseCase();
        await assert.rejects(
            () => useCase.execute('invalid-video', 'user-123', { title: 'New Title' }),
            /Video not found/
        );
    });

    test('should throw error if user is not the owner', async () => {
        const useCase = createUseCase();
        await assert.rejects(
            () => useCase.execute('video-123', 'different-user', { title: 'New Title' }),
            /Unauthorized: You can only edit your own videos/
        );
    });

    test('should throw error if title is empty after sanitization', async () => {
        const useCase = createUseCase();
        await assert.rejects(
            () => useCase.execute('video-123', 'user-123', { title: '<script></script>' }),
            /Title cannot be empty/
        );
    });

    test('should handle undefined fields', async () => {
        const useCase = createUseCase();
        const result = await useCase.execute('video-123', 'user-123', {
            title: undefined,
            description: undefined
        });

        assert.strictEqual(result.title, 'Original Title');
        assert.strictEqual(result.description, 'Original description');
    });
});

