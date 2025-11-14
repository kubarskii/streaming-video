// @ts-check
const { test, describe } = require('node:test');
const assert = require('node:assert');

const userContextMiddleware = require('../../src/presentation/middleware/userContextMiddleware');

describe('userContextMiddleware', () => {
    test('should extract user context from headers', async () => {
        const middleware = userContextMiddleware({ requireAuth: false });
        const req = {
            headers: {
                'x-user-id': '123e4567-e89b-12d3-a456-426614174000',
                'x-user-email': 'test@example.com',
                'x-user-username': 'testuser'
            }
        };
        const res = {};
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
        assert.strictEqual(req.user.id, '123e4567-e89b-12d3-a456-426614174000');
        assert.strictEqual(req.user.email, 'test@example.com');
        assert.strictEqual(req.user.username, 'testuser');
    });

    test('should handle missing headers when requireAuth is false', async () => {
        const middleware = userContextMiddleware({ requireAuth: false });
        const req = {
            headers: {}
        };
        const res = {};
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
        assert.strictEqual(req.user, undefined);
    });

    test('should reject when requireAuth is true and headers missing', async () => {
        const middleware = userContextMiddleware({ requireAuth: true });
        const req = {
            headers: {}
        };
        const res = {
            writeHead: (status, headers) => {
                assert.strictEqual(status, 401);
                assert.strictEqual(headers['Content-Type'], 'application/json');
            },
            end: (data) => {
                const parsed = JSON.parse(data);
                assert.strictEqual(parsed.success, false);
                assert.strictEqual(parsed.error.code, 'MISSING_USER_CONTEXT');
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
        
        assert.strictEqual(nextCalled, false);
    });

    test('should validate UUID format for x-user-id', async () => {
        const middleware = userContextMiddleware({ requireAuth: false });
        const req = {
            headers: {
                'x-user-id': 'invalid-uuid',
                'x-user-email': 'test@example.com',
                'x-user-username': 'testuser'
            }
        };
        const res = {};
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
        
        // When requireAuth is false, invalid UUID still passes through
        // The middleware continues without setting user (per implementation)
        assert.strictEqual(nextCalled, true);
        assert.strictEqual(req.user, undefined);
    });

    test('should handle valid UUID', async () => {
        const middleware = userContextMiddleware({ requireAuth: false });
        const validUuid = '123e4567-e89b-12d3-a456-426614174000';
        const req = {
            headers: {
                'x-user-id': validUuid,
                'x-user-email': 'test@example.com',
                'x-user-username': 'testuser'
            }
        };
        const res = {};
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
        assert.strictEqual(req.user.id, validUuid);
    });
});

