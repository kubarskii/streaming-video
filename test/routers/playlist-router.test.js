// @ts-check
const { test, describe } = require('node:test');
const assert = require('node:assert');

const PlaylistServiceRouter = require('../../services/playlist/router');

describe('PlaylistServiceRouter', () => {
    test('should initialize with playlist controller', () => {
        const mockController = {
            createPlaylist: () => {},
            getPlaylist: () => {},
            listPlaylists: () => {}
        };
        
        const router = new PlaylistServiceRouter(mockController);
        assert.strictEqual(router.playlistController, mockController);
    });

    test('should route GET /api/playlists to listPlaylists', async () => {
        let called = false;
        const mockController = {
            listPlaylists: async (req, res, queryParams) => {
                called = true;
            }
        };
        
        const router = new PlaylistServiceRouter(mockController);
        const req = {
            url: '/api/playlists',
            method: 'GET',
            headers: { host: 'localhost:3005' }
        };
        const res = { writeHead: () => {}, end: () => {} };
        
        const result = await router.route(req, res);
        assert.strictEqual(result, true);
        assert.strictEqual(called, true);
    });

    test('should route POST /api/playlists to createPlaylist', async () => {
        let called = false;
        const mockController = {
            createPlaylist: async (req, res) => {
                called = true;
            }
        };
        
        const router = new PlaylistServiceRouter(mockController);
        const req = {
            url: '/api/playlists',
            method: 'POST',
            headers: { host: 'localhost:3005' }
        };
        const res = { writeHead: () => {}, end: () => {} };
        
        const result = await router.route(req, res);
        assert.strictEqual(result, true);
        assert.strictEqual(called, true);
    });

    test('should route GET /api/playlists/:id to getPlaylist', async () => {
        let called = false;
        let receivedId = null;
        const mockController = {
            getPlaylist: async (req, res, playlistId) => {
                called = true;
                receivedId = playlistId;
            }
        };
        
        const router = new PlaylistServiceRouter(mockController);
        const req = {
            url: '/api/playlists/test-playlist-id',
            method: 'GET',
            headers: { host: 'localhost:3005' }
        };
        const res = { writeHead: () => {}, end: () => {} };
        
        const result = await router.route(req, res);
        assert.strictEqual(result, true);
        assert.strictEqual(called, true);
        assert.strictEqual(receivedId, 'test-playlist-id');
    });

    test('should route POST /api/playlists/:id/videos to addVideoToPlaylist', async () => {
        let called = false;
        let receivedId = null;
        const mockController = {
            addVideoToPlaylist: async (req, res, playlistId) => {
                called = true;
                receivedId = playlistId;
            }
        };
        
        const router = new PlaylistServiceRouter(mockController);
        const req = {
            url: '/api/playlists/test-playlist-id/videos',
            method: 'POST',
            headers: { host: 'localhost:3005' }
        };
        const res = { writeHead: () => {}, end: () => {} };
        
        const result = await router.route(req, res);
        assert.strictEqual(result, true);
        assert.strictEqual(called, true);
        assert.strictEqual(receivedId, 'test-playlist-id');
    });

    test('should route DELETE /api/playlists/:id/videos/:videoId to removeVideoFromPlaylist', async () => {
        let called = false;
        let receivedPlaylistId = null;
        let receivedVideoId = null;
        const mockController = {
            removeVideoFromPlaylist: async (req, res, playlistId, videoId) => {
                called = true;
                receivedPlaylistId = playlistId;
                receivedVideoId = videoId;
            }
        };
        
        const router = new PlaylistServiceRouter(mockController);
        const req = {
            url: '/api/playlists/test-playlist-id/videos/test-video-id',
            method: 'DELETE',
            headers: { host: 'localhost:3005' }
        };
        const res = { writeHead: () => {}, end: () => {} };
        
        const result = await router.route(req, res);
        assert.strictEqual(result, true);
        assert.strictEqual(called, true);
        assert.strictEqual(receivedPlaylistId, 'test-playlist-id');
        assert.strictEqual(receivedVideoId, 'test-video-id');
    });
});

