// @ts-check
const { test, describe } = require('node:test');
const assert = require('node:assert');

const ChannelServiceRouter = require('../../services/channel/router');

describe('ChannelServiceRouter', () => {
    test('should initialize with channel controller', () => {
        const mockController = {
            createChannel: () => {},
            getChannel: () => {},
            listChannels: () => {},
            updateChannel: () => {}
        };
        
        const router = new ChannelServiceRouter(mockController);
        assert.strictEqual(router.channelController, mockController);
    });

    test('should route POST /api/channels to createChannel', async () => {
        let called = false;
        const mockController = {
            createChannel: async (req, res) => {
                called = true;
            }
        };
        
        const router = new ChannelServiceRouter(mockController);
        const req = {
            url: '/api/channels',
            method: 'POST',
            headers: { host: 'localhost:3004' }
        };
        const res = { writeHead: () => {}, end: () => {} };
        
        const result = await router.route(req, res);
        assert.strictEqual(result, true);
        assert.strictEqual(called, true);
    });

    test('should route GET /api/channels to getChannel', async () => {
        let called = false;
        const mockController = {
            getChannel: async (req, res, queryParams) => {
                called = true;
            }
        };
        
        const router = new ChannelServiceRouter(mockController);
        const req = {
            url: '/api/channels?userId=test-id',
            method: 'GET',
            headers: { host: 'localhost:3004' }
        };
        const res = { writeHead: () => {}, end: () => {} };
        
        const result = await router.route(req, res);
        assert.strictEqual(result, true);
        assert.strictEqual(called, true);
    });

    test('should route GET /api/channels/list to listChannels', async () => {
        let called = false;
        const mockController = {
            listChannels: async (req, res, queryParams) => {
                called = true;
            }
        };
        
        const router = new ChannelServiceRouter(mockController);
        const req = {
            url: '/api/channels/list',
            method: 'GET',
            headers: { host: 'localhost:3004' }
        };
        const res = { writeHead: () => {}, end: () => {} };
        
        const result = await router.route(req, res);
        assert.strictEqual(result, true);
        assert.strictEqual(called, true);
    });

    test('should route PATCH /api/channels/:id to updateChannel', async () => {
        let called = false;
        let receivedId = null;
        const mockController = {
            updateChannel: async (req, res, channelId) => {
                called = true;
                receivedId = channelId;
            }
        };
        
        const router = new ChannelServiceRouter(mockController);
        const req = {
            url: '/api/channels/test-channel-id',
            method: 'PATCH',
            headers: { host: 'localhost:3004' }
        };
        const res = { writeHead: () => {}, end: () => {} };
        
        const result = await router.route(req, res);
        assert.strictEqual(result, true);
        assert.strictEqual(called, true);
        assert.strictEqual(receivedId, 'test-channel-id');
    });

    test('should handle invalid URL', async () => {
        const router = new ChannelServiceRouter({});
        const req = {
            url: 'invalid-url',
            headers: { host: 'localhost:3004' }
        };
        const res = {
            writeHead: (status, headers) => {
                assert.strictEqual(status, 400);
            },
            end: (data) => {
                const parsed = JSON.parse(data);
                assert.strictEqual(parsed.success, false);
            }
        };
        
        const result = await router.route(req, res);
        assert.strictEqual(result, false);
    });
});

