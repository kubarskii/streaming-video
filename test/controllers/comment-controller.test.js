// @ts-check
const { test, describe } = require('node:test');
const assert = require('node:assert');

const CommentController = require('../../src/presentation/controllers/CommentController');

describe('CommentController', () => {
    test('should initialize with use cases', () => {
        const mockUseCases = {
            createCommentUseCase: { execute: () => {} },
            getVideoCommentsUseCase: { execute: () => {} },
            updateCommentUseCase: { execute: () => {} },
            deleteCommentUseCase: { execute: () => {} }
        };
        
        const controller = new CommentController(
            mockUseCases.createCommentUseCase,
            mockUseCases.getVideoCommentsUseCase,
            mockUseCases.updateCommentUseCase,
            mockUseCases.deleteCommentUseCase
        );
        
        assert.strictEqual(controller.createCommentUseCase, mockUseCases.createCommentUseCase);
        assert.strictEqual(controller.getVideoCommentsUseCase, mockUseCases.getVideoCommentsUseCase);
    });

    test('should create comment successfully', async () => {
        const mockUseCase = {
            execute: async (input) => {
                assert.strictEqual(input.videoId, 'test-video-id');
                assert.strictEqual(input.userId, 'test-user-id');
                assert.strictEqual(input.content, 'Test comment');
                return { id: 'comment-id', content: 'Test comment' };
            }
        };
        
        const controller = new CommentController(mockUseCase, {}, {}, {});
        
        let dataEmitted = false;
        let endEmitted = false;
        const req = {
            user: { id: 'test-user-id' },
            on: (event, callback) => {
                if (event === 'data') {
                    // Emit data asynchronously
                    setImmediate(() => {
                        dataEmitted = true;
                        callback(Buffer.from(JSON.stringify({
                            videoId: 'test-video-id',
                            content: 'Test comment'
                        })));
                    });
                }
                if (event === 'end') {
                    // Emit end after data
                    setImmediate(() => {
                        endEmitted = true;
                        callback();
                    });
                }
            }
        };
        
        let responseEnded = false;
        const res = {
            writeHead: (status, headers) => {
                assert.strictEqual(status, 201);
                assert.strictEqual(headers['Content-Type'], 'application/json');
            },
            end: (data) => {
                responseEnded = true;
                const parsed = JSON.parse(data);
                assert.strictEqual(parsed.comment.content, 'Test comment');
            }
        };
        
        await controller.createComment(req, res);
        
        // Wait a bit to ensure all async operations complete
        await new Promise(resolve => setTimeout(resolve, 100));
        assert.strictEqual(responseEnded, true);
    });

    test('should return 401 when user not authenticated', async () => {
        const controller = new CommentController({}, {}, {}, {});
        
        const req = {
            user: null,
            on: () => {}
        };
        
        let statusCode = null;
        let responseEnded = false;
        const res = {
            writeHead: (status, headers) => {
                statusCode = status;
                assert.strictEqual(status, 401);
            },
            end: (data) => {
                responseEnded = true;
                const parsed = JSON.parse(data);
                assert.strictEqual(parsed.error, 'Not authenticated');
            }
        };
        
        await controller.createComment(req, res);
        assert.strictEqual(statusCode, 401);
        assert.strictEqual(responseEnded, true);
    });

    test('should get comments for a video', async () => {
        const mockComments = [
            { id: '1', content: 'Comment 1' },
            { id: '2', content: 'Comment 2' }
        ];
        
        const mockUseCase = {
            execute: async (options) => {
                assert.strictEqual(options.videoId, 'test-video-id');
                return mockComments;
            }
        };
        
        const controller = new CommentController({}, mockUseCase, {}, {});
        
        const req = {
            url: 'http://localhost:3002/api/comments?videoId=test-video-id'
        };
        
        const res = {
            writeHead: (status, headers) => {
                assert.strictEqual(status, 200);
            },
            end: (data) => {
                const parsed = JSON.parse(data);
                assert.ok(Array.isArray(parsed) || parsed.comments || parsed.data);
            }
        };
        
        await controller.getComments(req, res, { videoId: 'test-video-id' });
    });
});

