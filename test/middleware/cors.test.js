// @ts-check
const { test, describe } = require('node:test');
const assert = require('node:assert');

const corsMiddleware = require('../../src/presentation/middleware/corsMiddleware');

describe('corsMiddleware', () => {
    test('should allow all origins in development when ALLOWED_ORIGINS not set', async () => {
        const originalEnv = process.env.NODE_ENV;
        const originalAllowed = process.env.ALLOWED_ORIGINS;
        
        process.env.NODE_ENV = 'development';
        delete process.env.ALLOWED_ORIGINS;
        
        // Clear require cache to get fresh middleware
        delete require.cache[require.resolve('../../src/presentation/middleware/corsMiddleware')];
        const corsMiddleware = require('../../src/presentation/middleware/corsMiddleware');
        
        const middleware = corsMiddleware;
        const req = {
            method: 'GET',
            headers: {
                origin: 'http://localhost:3000'
            }
        };
        let setHeaderCalls = {};
        const res = {
            setHeader: (key, value) => {
                setHeaderCalls[key] = value;
            }
        };
        let nextCalled = false;
        
        await new Promise((resolve) => {
            middleware(req, res, () => {
                nextCalled = true;
                resolve();
            });
        });
        
        assert.strictEqual(nextCalled, true);
        assert.strictEqual(setHeaderCalls['Access-Control-Allow-Origin'], 'http://localhost:3000');
        
        // Restore
        process.env.NODE_ENV = originalEnv;
        if (originalAllowed) process.env.ALLOWED_ORIGINS = originalAllowed;
        delete require.cache[require.resolve('../../src/presentation/middleware/corsMiddleware')];
    });

    test('should allow only whitelisted origins in production', async () => {
        const originalEnv = process.env.NODE_ENV;
        const originalAllowed = process.env.ALLOWED_ORIGINS;
        
        process.env.NODE_ENV = 'production';
        process.env.ALLOWED_ORIGINS = 'https://example.com,https://app.example.com';
        
        // Clear require cache
        delete require.cache[require.resolve('../../src/presentation/middleware/corsMiddleware')];
        const corsMiddleware = require('../../src/presentation/middleware/corsMiddleware');
        
        const middleware = corsMiddleware;
        const req = {
            method: 'GET',
            headers: {
                origin: 'https://example.com'
            }
        };
        let setHeaderCalls = {};
        const res = {
            setHeader: (key, value) => {
                setHeaderCalls[key] = value;
            }
        };
        let nextCalled = false;
        
        await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                if (!nextCalled) {
                    resolve();
                }
            }, 1000);
            
            middleware(req, res, () => {
                nextCalled = true;
                clearTimeout(timeout);
                resolve();
            });
        });
        
        assert.strictEqual(nextCalled, true);
        assert.strictEqual(setHeaderCalls['Access-Control-Allow-Origin'], 'https://example.com');
        
        // Restore
        process.env.NODE_ENV = originalEnv;
        if (originalAllowed) process.env.ALLOWED_ORIGINS = originalAllowed;
        delete require.cache[require.resolve('../../src/presentation/middleware/corsMiddleware')];
    });

    test('should reject non-whitelisted origins in production', async () => {
        const originalEnv = process.env.NODE_ENV;
        const originalAllowed = process.env.ALLOWED_ORIGINS;
        
        process.env.NODE_ENV = 'production';
        // Set empty ALLOWED_ORIGINS to trigger rejection logic
        process.env.ALLOWED_ORIGINS = '';
        
        // Clear require cache
        delete require.cache[require.resolve('../../src/presentation/middleware/corsMiddleware')];
        const corsMiddleware = require('../../src/presentation/middleware/corsMiddleware');
        
        const middleware = corsMiddleware;
        const req = {
            method: 'GET',
            headers: {
                origin: 'https://malicious.com'
            }
        };
        let statusCode = null;
        const res = {
            setHeader: () => {}, // CORS middleware sets headers before rejecting
            writeHead: (status, headers) => {
                statusCode = status;
                assert.strictEqual(status, 403);
            },
            end: (data) => {
                const parsed = JSON.parse(data);
                assert.strictEqual(parsed.success, false);
                assert.strictEqual(parsed.error.code, 'CORS_ERROR');
            }
        };
        let nextCalled = false;
        
        await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve();
            }, 1000);
            
            middleware(req, res, () => {
                nextCalled = true;
                clearTimeout(timeout);
                resolve();
            });
        });
        
        // CORS middleware rejects when ALLOWED_ORIGINS is empty and origin is provided
        assert.strictEqual(statusCode, 403);
        
        // Restore
        process.env.NODE_ENV = originalEnv;
        if (originalAllowed) process.env.ALLOWED_ORIGINS = originalAllowed;
        delete require.cache[require.resolve('../../src/presentation/middleware/corsMiddleware')];
    });
});

