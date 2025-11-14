// @ts-check
// Main test runner - runs all test suites

const { test, describe } = require('node:test');
const assert = require('node:assert');

describe('Test Suite Integration', () => {
    test('all test files should be loadable', () => {
        // Verify we can require all test modules
        assert.doesNotThrow(() => {
            require('./routers/social-router.test');
            require('./routers/channel-router.test');
            require('./routers/playlist-router.test');
            require('./middleware/user-context.test');
            require('./middleware/cors.test');
            require('./controllers/comment-controller.test');
            require('./use-cases/like-video.test');
            require('./use-cases/create-comment.test');
            require('./use-cases/update-comment.test');
            require('./use-cases/create-channel.test');
            require('./use-cases/update-video-metadata.test');
            require('./use-cases/create-playlist.test');
            require('./infrastructure/video-transcoder.test');
            require('./security/content-sanitizer.test');
        });
    });
});

