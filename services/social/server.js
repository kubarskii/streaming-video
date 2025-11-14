// @ts-check
// Social Service
// Handles likes, comments, and subscriptions
// Authentication is handled by Gateway

require('dotenv').config();
const http = require('http');

// Infrastructure
const DatabaseConfig = require('../../src/infrastructure/config/DatabaseConfig');
const PrismaVideoRepository = require('../../src/infrastructure/persistence/PrismaVideoRepository');
const PrismaChannelRepository = require('../../src/infrastructure/persistence/PrismaChannelRepository');
const PrismaVideoLikeRepository = require('../../src/infrastructure/persistence/PrismaVideoLikeRepository');
const PrismaSubscriptionRepository = require('../../src/infrastructure/persistence/PrismaSubscriptionRepository');
const PrismaCommentRepository = require('../../src/infrastructure/persistence/PrismaCommentRepository');

// Use Cases
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
const VideoLikeController = require('../../src/presentation/controllers/VideoLikeController');
const SubscriptionController = require('../../src/presentation/controllers/SubscriptionController');
const CommentController = require('../../src/presentation/controllers/CommentController');

// Router
const SocialServiceRouter = require('./router');
const corsMiddleware = require('../../src/presentation/middleware/corsMiddleware');
const userContextMiddleware = require('../../src/presentation/middleware/userContextMiddleware');

// Configuration
const PORT = parseInt(process.env.PORT || '3002', 10);
const SERVICE_NAME = process.env.SERVICE_NAME || 'social';

// Ensure unique port if PORT is already 3000
const ACTUAL_PORT = PORT === 3000 ? 3002 : PORT;

async function initializeContainer() {
    console.log(`💬 ${SERVICE_NAME.toUpperCase()} SERVICE`);
    console.log('='.repeat(SERVICE_NAME.length + 17));
    console.log('');

    // Infrastructure - Configure connection pool for social service
    const prismaClient = DatabaseConfig.getPrismaClient({ serviceType: 'social' });
    const videoRepository = new PrismaVideoRepository(prismaClient);
    const channelRepository = new PrismaChannelRepository(prismaClient);
    const videoLikeRepository = new PrismaVideoLikeRepository(prismaClient);
    const subscriptionRepository = new PrismaSubscriptionRepository(prismaClient);
    const commentRepository = new PrismaCommentRepository(prismaClient);

    // Use Cases
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
    const router = new SocialServiceRouter(
        videoLikeController,
        subscriptionController,
        commentController
    );

    console.log('✅ Dependencies initialized');
    console.log(`📦 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
    console.log(`📦 Redis: ${process.env.REDIS_URL ? 'Connected' : 'Not configured'}`);
    console.log('');
    console.log('ℹ️  Authentication is handled by Gateway');
    console.log('ℹ️  User context received via X-User-* headers');
    console.log('');

    return { router, prismaClient };
}

async function main() {
    const { router, prismaClient } = await initializeContainer();

    const server = http.createServer(async (req, res) => {
        try {
            // Apply CORS
            corsMiddleware(req, res, async () => {
                // Extract and validate user from gateway headers
                userContextMiddleware({ requireAuth: false })(req, res, async () => {
                    // Route request
                    const handled = await router.route(req, res);

                    if (!handled) {
                        console.log(`[Social Service] Route not handled: ${req.method} ${req.url}`);
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
                                    const result = await healthChecker.runAllChecks(['database']);
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
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
        console.error('❌ Uncaught Exception:', error);
        console.error('Stack:', error.stack);
    });

    // Graceful shutdown
    let isShuttingDown = false;
    const shutdown = async () => {
        if (isShuttingDown) {
            console.log('⚠️  Shutdown already in progress...');
            return;
        }
        isShuttingDown = true;
        
        console.log('\n🛑 Shutting down social service...');
        
        server.close(() => {
            console.log('✅ HTTP server closed (no new connections)');
        });
        
        const shutdownTimeout = setTimeout(() => {
            console.log('⚠️  Shutdown timeout reached, forcing exit');
            process.exit(1);
        }, 30000);
        
        try {
            await new Promise(resolve => setTimeout(resolve, 2000));
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
        console.log(`✅ Social Service listening on port ${ACTUAL_PORT}`);
        console.log(`🌍 Health check: http://localhost:${ACTUAL_PORT}/health`);
        console.log('');
    });
}

main().catch((error) => {
    console.error('❌ Failed to start social service:', error);
    process.exit(1);
});

