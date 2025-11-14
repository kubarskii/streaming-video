// @ts-check
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { URL } = require('url');

const SocialServiceRouter = require('../../services/social/router');

describe('SocialServiceRouter', () => {
    test('should initialize with controllers', () => {
        const mockControllers = {
            videoLikeController: { likeVideo: () => {}, removeLike: () => {}, getLikeStats: () => {} },
            subscriptionController: { subscribe: () => {}, unsubscribe: () => {}, getUserSubscriptions: () => {}, checkStatus: () => {} },
            commentController: { createComment: () => {}, getComments: () => {}, updateComment: () => {}, deleteComment: () => {} }
        };
        
        const router = new SocialServiceRouter(
            mockControllers.videoLikeController,
            mockControllers.subscriptionController,
            mockControllers.commentController
        );
        
        assert.strictEqual(router.videoLikeController, mockControllers.videoLikeController);
        assert.strictEqual(router.subscriptionController, mockControllers.subscriptionController);
        assert.strictEqual(router.commentController, mockControllers.commentController);
    });

    test('should handle invalid URL', async () => {
        const router = new SocialServiceRouter({}, {}, {});
        const req = {
            url: 'invalid-url',
            headers: { host: 'localhost:3002' }
        };
        const res = {
            writeHead: (status, headers) => {
                assert.strictEqual(status, 400);
                assert.strictEqual(headers['Content-Type'], 'application/json');
            },
            end: (data) => {
                const parsed = JSON.parse(data);
                assert.strictEqual(parsed.success, false);
                assert.strictEqual(parsed.error.code, 'INVALID_URL');
            }
        };
        
        const result = await router.route(req, res);
        assert.strictEqual(result, false);
    });

    test('should route POST /api/videos/:id/like to likeVideo', async () => {
        let called = false;
        const mockController = {
            likeVideo: async (req, res, videoId) => {
                called = true;
                assert.strictEqual(videoId, 'test-video-id');
            }
        };
        
        const router = new SocialServiceRouter(mockController, {}, {});
        const req = {
            url: '/api/videos/test-video-id/like',
            method: 'POST',
            headers: { host: 'localhost:3002' }
        };
        const res = { writeHead: () => {}, end: () => {} };
        
        const result = await router.route(req, res);
        assert.strictEqual(result, true);
        assert.strictEqual(called, true);
    });

    test('should route DELETE /api/videos/:id/like to removeLike', async () => {
        let called = false;
        const mockController = {
            removeLike: async (req, res, videoId) => {
                called = true;
                assert.strictEqual(videoId, 'test-video-id');
            }
        };
        
        const router = new SocialServiceRouter(mockController, {}, {});
        const req = {
            url: '/api/videos/test-video-id/like',
            method: 'DELETE',
            headers: { host: 'localhost:3002' }
        };
        const res = { writeHead: () => {}, end: () => {} };
        
        const result = await router.route(req, res);
        assert.strictEqual(result, true);
        assert.strictEqual(called, true);
    });

    test('should route GET /api/videos/:id/likes to getLikeStats', async () => {
        let called = false;
        const mockController = {
            getLikeStats: async (req, res, videoId) => {
                called = true;
                assert.strictEqual(videoId, 'test-video-id');
            }
        };
        
        const router = new SocialServiceRouter(mockController, {}, {});
        const req = {
            url: '/api/videos/test-video-id/likes',
            method: 'GET',
            headers: { host: 'localhost:3002' }
        };
        const res = { writeHead: () => {}, end: () => {} };
        
        const result = await router.route(req, res);
        assert.strictEqual(result, true);
        assert.strictEqual(called, true);
    });

    test('should route POST /api/comments to createComment', async () => {
        let called = false;
        const mockController = {
            createComment: async (req, res) => {
                called = true;
            }
        };
        
        const router = new SocialServiceRouter({}, {}, mockController);
        const req = {
            url: '/api/comments',
            method: 'POST',
            headers: { host: 'localhost:3002' }
        };
        const res = { writeHead: () => {}, end: () => {} };
        
        const result = await router.route(req, res);
        assert.strictEqual(result, true);
        assert.strictEqual(called, true);
    });

    test('should route GET /api/comments to getComments', async () => {
        let called = false;
        const mockController = {
            getComments: async (req, res, queryParams) => {
                called = true;
            }
        };
        
        const router = new SocialServiceRouter({}, {}, mockController);
        const req = {
            url: '/api/comments?videoId=test-id',
            method: 'GET',
            headers: { host: 'localhost:3002' }
        };
        const res = { writeHead: () => {}, end: () => {} };
        
        const result = await router.route(req, res);
        assert.strictEqual(result, true);
        assert.strictEqual(called, true);
    });

    test('should route POST /api/subscriptions to subscribe', async () => {
        let called = false;
        const mockController = {
            subscribe: async (req, res) => {
                called = true;
            }
        };
        
        const router = new SocialServiceRouter({}, mockController, {});
        const req = {
            url: '/api/subscriptions',
            method: 'POST',
            headers: { host: 'localhost:3002' }
        };
        const res = { writeHead: () => {}, end: () => {} };
        
        const result = await router.route(req, res);
        assert.strictEqual(result, true);
        assert.strictEqual(called, true);
    });

    test('should return false for unknown routes', async () => {
        const router = new SocialServiceRouter({}, {}, {});
        const req = {
            url: '/api/unknown',
            method: 'GET',
            headers: { host: 'localhost:3002' }
        };
        const res = { writeHead: () => {}, end: () => {} };
        
        const result = await router.route(req, res);
        assert.strictEqual(result, false);
    });
});

