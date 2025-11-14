// @ts-check
const { test, describe } = require('node:test');
const assert = require('node:assert');
const CreateChannelUseCase = require('../../src/application/use-cases/CreateChannelUseCase');
const Channel = require('../../src/domain/entities/Channel');

describe('CreateChannelUseCase', () => {
    const createUseCase = (options = {}) => {
        const mockUserRepository = {
            findById: async (id) => {
                if (id === 'user-123') {
                    return { id: 'user-123', email: 'test@example.com' };
                }
                return null;
            }
        };

        const mockChannelRepository = {
            findByUserId: async (userId) => {
                return options.hasExistingChannel ? { id: 'existing-channel', userId } : null;
            },
            create: async (channel) => channel
        };

        return new CreateChannelUseCase(mockChannelRepository, mockUserRepository);
    };

    test('should create a channel successfully', async () => {
        const useCase = createUseCase();
        const input = {
            userId: 'user-123',
            name: 'My Channel',
            description: 'Channel description'
        };

        const result = await useCase.execute(input);

        assert.ok(result instanceof Channel);
        assert.strictEqual(result.userId, 'user-123');
        assert.strictEqual(result.name, 'My Channel');
        assert.strictEqual(result.subscriberCount, 0);
        assert.strictEqual(result.videoCount, 0);
    });

    test('should sanitize channel name and description', async () => {
        const useCase = createUseCase();
        const input = {
            userId: 'user-123',
            name: '<script>alert("XSS")</script>My Channel',
            description: '<p>Description</p>'
        };

        const result = await useCase.execute(input);

        assert.ok(!result.name.includes('<script>'));
        assert.ok(result.name.includes('My Channel'));
        assert.ok(!result.description?.includes('<p>'));
    });

    test('should throw error if user not found', async () => {
        const useCase = createUseCase();
        const input = {
            userId: 'invalid-user',
            name: 'My Channel'
        };

        await assert.rejects(
            () => useCase.execute(input),
            /User not found/
        );
    });

    test('should throw error if user already has a channel', async () => {
        const useCase = createUseCase({ hasExistingChannel: true });
        const input = {
            userId: 'user-123',
            name: 'My Channel'
        };

        await assert.rejects(
            () => useCase.execute(input),
            /User already has a channel/
        );
    });

    test('should throw error if channel name is empty after sanitization', async () => {
        const useCase = createUseCase();
        const input = {
            userId: 'user-123',
            name: '<script></script>'
        };

        await assert.rejects(
            () => useCase.execute(input),
            /Channel name is required/
        );
    });

    test('should handle null description', async () => {
        const useCase = createUseCase();
        const input = {
            userId: 'user-123',
            name: 'My Channel',
            description: null
        };

        const result = await useCase.execute(input);
        assert.strictEqual(result.description, null);
    });
});

