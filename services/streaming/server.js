// @ts-check
// Streaming Service
// Handles video streaming, quality variants, and view counting

require('dotenv').config();
const http = require('http');

// Infrastructure
const DatabaseConfig = require('../../src/infrastructure/config/DatabaseConfig');
const StorageConfig = require('../../src/infrastructure/config/StorageConfig');
const RedisCache = require('../../src/infrastructure/cache/RedisCache');
const PrismaVideoRepository = require('../../src/infrastructure/persistence/PrismaVideoRepository');
const PrismaVideoQualityRepository = require('../../src/infrastructure/persistence/PrismaVideoQualityRepository');
const PrismaVideoLikeRepository = require('../../src/infrastructure/persistence/PrismaVideoLikeRepository');
const PrismaSubscriptionRepository = require('../../src/infrastructure/persistence/PrismaSubscriptionRepository');
const PrismaCommentRepository = require('../../src/infrastructure/persistence/PrismaCommentRepository');
const PrismaChannelRepository = require('../../src/infrastructure/persistence/PrismaChannelRepository');

// Application Services
const VideoService = require('../../src/application/services/VideoService');

// Use Cases
const IncrementVideoViewsUseCase = require('../../src/application/use-cases/IncrementVideoViewsUseCase');
const LikeVideoUseCase = require('../../src/application/use-cases/LikeVideoUseCase');
const GetVideoLikeStatsUseCase = require('../../src/application/use-cases/GetVideoLikeStatsUseCase');
const RemoveVideoLikeUseCase = require('../../src/application/use-cases/RemoveVideoLikeUseCase');
const SubscribeToChannelUseCase = require('../../src/application/use-cases/SubscribeToChannelUseCase');
const UnsubscribeFromChannelUseCase = require('../../src/application/use-cases/UnsubscribeFromChannelUseCase');
const GetUserSubscriptionsUseCase = require('../../src/application/use-cases/GetUserSubscriptionsUseCase');
const CheckSubscriptionStatusUseCase = require('../../src/application/use-cases/CheckSubscriptionStatusUseCase');
const CreateCommentUseCase = require('../../src/application/use-cases/CreateCommentUseCase');
const GetVideoCommentsUseCase = require('../../src/application/use-cases/GetVideoCommentsUseCase');
const UpdateCommentUseCase = require('../../src/application/use-cases/UpdateCommentUseCase');
const DeleteCommentUseCase = require('../../src/application/use-cases/DeleteCommentUseCase');

// Presentation
const StreamController = require('../../src/presentation/controllers/StreamController');
const VideoController = require('../../src/presentation/controllers/VideoController');
const VideoLikeController = require('../../src/presentation/controllers/VideoLikeController');
const SubscriptionController = require('../../src/presentation/controllers/SubscriptionController');
const CommentController = require('../../src/presentation/controllers/CommentController');

// Router
const StreamingServiceRouter = require('./router');
const corsMiddleware = require('../../src/presentation/middleware/corsMiddleware');
const { authMiddleware } = require('../../src/presentation/middleware/authMiddleware');
const JWTService = require('../../src/infrastructure/auth/JWTService');

// Configuration
const PORT = parseInt(process.env.PORT || '3003', 10);
const SERVICE_NAME = process.env.SERVICE_NAME || 'streaming';

// Ensure unique port if PORT is already 3000
const ACTUAL_PORT = PORT === 3000 ? 3003 : PORT;

async function initializeContainer() {
    console.log(`🎬 ${SERVICE_NAME.toUpperCase()} SERVICE`);
    console.log('='.repeat(SERVICE_NAME.length + 17));
    console.log('');

    // Infrastructure - Configure connection pool for streaming service
    const prismaClient = DatabaseConfig.getPrismaClient({ serviceType: 'streaming' });
    const videoRepository = new PrismaVideoRepository(prismaClient);
    // @ts-ignore - Prisma client type inference issue
    const videoQualityRepository = new PrismaVideoQualityRepository(prismaClient);
    const videoLikeRepository = new PrismaVideoLikeRepository(prismaClient);
    const subscriptionRepository = new PrismaSubscriptionRepository(prismaClient);
    const commentRepository = new PrismaCommentRepository(prismaClient);
    const channelRepository = new PrismaChannelRepository(prismaClient);
    const storageRepository = StorageConfig.createStorageRepository();
    const jwtService = new JWTService();

    // Initialize Redis cache for distributed view tracking
    const redisCache = new RedisCache();
    await redisCache.connect();

    // Application Services
    // @ts-ignore - videoQualityRepository is optional but we're providing it
    const videoService = new VideoService(
        videoRepository,
        storageRepository,
        null, // No thumbnail generator needed
        null, // No channel repository needed
        videoQualityRepository // Needed for quality variants
    );

    // Use Cases
    const incrementVideoViewsUseCase = new IncrementVideoViewsUseCase(videoRepository);
    const likeVideoUseCase = new LikeVideoUseCase(videoLikeRepository, videoRepository);
    const getVideoLikeStatsUseCase = new GetVideoLikeStatsUseCase(videoLikeRepository);
    const removeVideoLikeUseCase = new RemoveVideoLikeUseCase(videoLikeRepository);
    const subscribeToChannelUseCase = new SubscribeToChannelUseCase(subscriptionRepository, channelRepository);
    const unsubscribeFromChannelUseCase = new UnsubscribeFromChannelUseCase(subscriptionRepository, channelRepository);
    const getUserSubscriptionsUseCase = new GetUserSubscriptionsUseCase(subscriptionRepository);
    const checkSubscriptionStatusUseCase = new CheckSubscriptionStatusUseCase(subscriptionRepository);
    const createCommentUseCase = new CreateCommentUseCase(commentRepository, videoRepository);
    const getVideoCommentsUseCase = new GetVideoCommentsUseCase(commentRepository);
    const updateCommentUseCase = new UpdateCommentUseCase(commentRepository);
    const deleteCommentUseCase = new DeleteCommentUseCase(commentRepository);

    // Presentation Controllers
    // @ts-ignore - videoQualityRepository is optional but we're providing it
    const streamController = new StreamController(
        videoService,
        storageRepository,
        incrementVideoViewsUseCase,
        videoQualityRepository,
        redisCache // For distributed view tracking across multiple instances
    );
    const videoController = new VideoController(videoService);
    const videoLikeController = new VideoLikeController(
        likeVideoUseCase,
        getVideoLikeStatsUseCase,
        removeVideoLikeUseCase
    );
    const subscriptionController = new SubscriptionController(
        subscribeToChannelUseCase,
        unsubscribeFromChannelUseCase,
        getUserSubscriptionsUseCase,
        checkSubscriptionStatusUseCase
    );
    const commentController = new CommentController(
        createCommentUseCase,
        getVideoCommentsUseCase,
        updateCommentUseCase,
        deleteCommentUseCase
    );

    // Router
    const router = new StreamingServiceRouter(
        streamController,
        videoController,
        videoLikeController,
        subscriptionController,
        commentController
    );

    console.log('✅ Dependencies initialized');
    console.log(`📦 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
    console.log(`📦 Storage: ${process.env.STORAGE_MODE || 'local'}`);
    console.log(`📦 Stream Mode: ${process.env.STREAM_MODE || 'redirect'} ${process.env.STREAM_MODE === 'redirect' ? '(CDN offload - unlimited scale)' : '(Server proxy)'}`);
    console.log(`📦 Redis: ${process.env.REDIS_URL ? 'Connected' : 'Not configured'}`);
    console.log('');

    return { router, jwtService, prismaClient, streamController, redisCache };
}

async function main() {
    const { router, jwtService, prismaClient, streamController, redisCache } = await initializeContainer();

    const server = http.createServer(async (req, res) => {
        try {
            // Apply CORS
            corsMiddleware(req, res, async () => {
                // Optional auth (for streaming we may not require auth)
                const token = req.headers.authorization?.replace('Bearer ', '');
                if (token) {
                    try {
                        const payload = jwtService.verifyToken(token);
                        if (payload && typeof payload === 'object' && 'userId' in payload) {
                            // @ts-ignore - Adding user property to request
                            // Map userId to id for compatibility with controllers
                            req.user = {
                                id: payload.userId,
                                userId: payload.userId,
                                email: payload.email,
                                username: payload.username
                            };
                        }
                    } catch (err) {
                        // Invalid token, continue as unauthenticated
                    }
                }

                // Route request
                const handled = await router.route(req, res);

                if (!handled) {
                    // Health check
                    if (req.url === '/health' || req.url === '/health/quick') {
                        const HealthChecker = require('../../src/infrastructure/health/HealthChecker');
                        const healthChecker = new HealthChecker();

                        try {
                            if (req.url === '/health/quick') {
                                const result = await healthChecker.quickCheck();
                                res.writeHead(result.status === 'healthy' ? 200 : 503, {
                                    'Content-Type': 'application/json'
                                });
                                return res.end(JSON.stringify(result));
                            } else {
                                const result = await healthChecker.runAllChecks(['database', 'redis', 'storage']);
                                res.writeHead(result.status === 'healthy' ? 200 : 503, {
                                    'Content-Type': 'application/json'
                                });
                                return res.end(JSON.stringify({
                                    ...result,
                                    service: SERVICE_NAME
                                }));
                            }
                        } catch (error) {
                            res.writeHead(503, { 'Content-Type': 'application/json' });
                            return res.end(JSON.stringify({
                                status: 'unhealthy',
                                service: SERVICE_NAME,
                                error: error.message,
                                timestamp: new Date().toISOString()
                            }));
                        }
                    }

                    // Not found
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: {
                            message: 'Not found',
                            code: 'NOT_FOUND'
                        }
                    }));
                }
            });
        } catch (error) {
            console.error('❌ Request handling error:', error);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: {
                        message: 'Internal server error',
                        code: 'INTERNAL_ERROR'
                    }
                }));
            }
        }
    });

    // Handle server errors
    server.on('error', (error) => {
        console.error('❌ Server error:', error);
    });

    // Handle unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
        console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
        // Don't exit - just log it
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
        console.error('❌ Uncaught Exception:', error);
        console.error('Stack:', error.stack);
        // Don't exit - just log it and continue
    });

    // Graceful shutdown
    let isShuttingDown = false;
    const shutdown = async () => {
        if (isShuttingDown) {
            console.log('⚠️  Shutdown already in progress...');
            return;
        }
        isShuttingDown = true;

        console.log('\n🛑 Shutting down streaming service...');

        // Stop accepting new connections
        server.close(() => {
            console.log('✅ HTTP server closed (no new connections)');
        });

        // Give active requests time to complete (max 30 seconds)
        const shutdownTimeout = setTimeout(() => {
            console.log('⚠️  Shutdown timeout reached, forcing exit');
            process.exit(1);
        }, 30000);

        try {
            // Wait for active requests to complete
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Cleanup stream controller resources
            if (streamController && streamController.cleanup) {
                streamController.cleanup();
                console.log('✅ Stream controller cleaned up');
            }

            // Disconnect Redis cache
            if (redisCache) {
                await redisCache.disconnect();
                console.log('✅ Redis disconnected');
            }

            // Close database connection
            await prismaClient.$disconnect();
            console.log('✅ Database disconnected');

            clearTimeout(shutdownTimeout);
            console.log('✅ Graceful shutdown complete');
            process.exit(0);
        } catch (error) {
            console.error('❌ Error during shutdown:', error);
            clearTimeout(shutdownTimeout);
            process.exit(1);
        }
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    server.listen(ACTUAL_PORT, '0.0.0.0', () => {
        console.log(`✅ Streaming Service listening on port ${ACTUAL_PORT}`);
        console.log(`🌍 Health check: http://localhost:${ACTUAL_PORT}/health`);
        console.log('');
    });
}

main().catch((error) => {
    console.error('❌ Failed to start streaming service:', error);
    process.exit(1);
});

