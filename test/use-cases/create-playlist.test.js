// @ts-check
const { test, describe } = require('node:test');
const assert = require('node:assert');
const CreatePlaylistUseCase = require('../../src/application/use-cases/CreatePlaylistUseCase');
const Playlist = require('../../src/domain/entities/Playlist');

describe('CreatePlaylistUseCase', () => {
    const createUseCase = (options = {}) => {
        const mockVideoRepository = {
            findById: async (id) => {
                if (id === 'video-1' || id === 'video-2') {
                    return { id, title: `Video ${id}` };
                }
                return null;
            }
        };

        let slugCallCount = 0;
        const mockPlaylistRepository = {
            getPlaylistBySlug: async (slug) => {
                slugCallCount++;
                if (options.slugTaken && slugCallCount === 1) {
                    return { id: 'existing', slug }; // First call returns existing
                }
                return null; // Available
            },
            createPlaylist: async (playlist, videos) => {
                if (options.captureVideos) {
                    options.captureVideos.videos = videos;
                }
                return playlist;
            }
        };

        return new CreatePlaylistUseCase(mockPlaylistRepository, mockVideoRepository);
    };

    test('should create a playlist successfully', async () => {
        const useCase = createUseCase();
        const input = {
            userId: 'user-123',
            title: 'My Playlist',
            description: 'Playlist description',
            isPublic: true
        };

        const result = await useCase.execute(input);

        assert.ok(result instanceof Playlist);
        assert.strictEqual(result.title, 'My Playlist');
        assert.strictEqual(result.userId, 'user-123');
        assert.strictEqual(result.isPublic, true);
    });

    test('should sanitize title and description', async () => {
        const useCase = createUseCase();
        const input = {
            userId: 'user-123',
            title: '<script>alert("XSS")</script>My Playlist',
            description: '<p>Description</p>'
        };

        const result = await useCase.execute(input);

        assert.ok(!result.title.includes('<script>'));
        assert.ok(result.title.includes('My Playlist'));
        assert.ok(!result.description?.includes('<p>'));
    });

    test('should generate slug from title', async () => {
        const useCase = createUseCase();
        const input = {
            userId: 'user-123',
            title: 'My Awesome Playlist!'
        };

        const result = await useCase.execute(input);

        assert.ok(result.slug);
        assert.ok(result.slug.includes('my-awesome-playlist'));
    });

    test('should handle custom slug', async () => {
        const useCase = createUseCase();
        const input = {
            userId: 'user-123',
            title: 'My Playlist',
            slug: 'custom-slug'
        };

        const result = await useCase.execute(input);

        assert.strictEqual(result.slug, 'custom-slug');
    });

    test('should ensure unique slug', async () => {
        const useCase = createUseCase({ slugTaken: true });
        const input = {
            userId: 'user-123',
            title: 'My Playlist',
            slug: 'test-slug'
        };

        const result = await useCase.execute(input);

        assert.ok(result.slug);
        assert.ok(result.slug.startsWith('test-slug'));
    });

    test('should add videos to playlist', async () => {
        const captureVideos = { videos: null };
        const useCase = createUseCase({ captureVideos });
        const input = {
            userId: 'user-123',
            title: 'My Playlist',
            videoIds: ['video-1', 'video-2']
        };

        await useCase.execute(input);

        assert.ok(captureVideos.videos);
        assert.strictEqual(captureVideos.videos.length, 2);
        assert.strictEqual(captureVideos.videos[0].videoId, 'video-1');
        assert.strictEqual(captureVideos.videos[1].videoId, 'video-2');
    });

    test('should throw error if user ID is missing', async () => {
        const useCase = createUseCase();
        const input = {
            title: 'My Playlist'
        };

        await assert.rejects(
            () => useCase.execute(input),
            /User ID is required to create a playlist/
        );
    });

    test('should throw error if title is missing', async () => {
        const useCase = createUseCase();
        const input = {
            userId: 'user-123',
            title: ''
        };

        await assert.rejects(
            () => useCase.execute(input),
            /Playlist title is required/
        );
    });

    test('should throw error if video not found', async () => {
        const useCase = createUseCase();
        const input = {
            userId: 'user-123',
            title: 'My Playlist',
            videoIds: ['invalid-video']
        };

        await assert.rejects(
            () => useCase.execute(input),
            /Video with ID invalid-video not found/
        );
    });

    test('should remove duplicate video IDs', async () => {
        const captureVideos = { videos: null };
        const useCase = createUseCase({ captureVideos });
        const input = {
            userId: 'user-123',
            title: 'My Playlist',
            videoIds: ['video-1', 'video-1', 'video-2']
        };

        await useCase.execute(input);

        assert.strictEqual(captureVideos.videos.length, 2);
    });
});

