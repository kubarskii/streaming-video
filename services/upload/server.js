// @ts-check
// Upload Service
// Handles video uploads, video metadata CRUD, and queue management
// Authentication is handled by Gateway
// Note: Channels, playlists, likes, comments, and subscriptions are handled by separate services

require('dotenv').config();
const http = require('http');
const path = require('path');

// Infrastructure
const DatabaseConfig = require('../../src/infrastructure/config/DatabaseConfig');
const StorageConfig = require('../../src/infrastructure/config/StorageConfig');
const PrismaVideoRepository = require('../../src/infrastructure/persistence/PrismaVideoRepository');
const PrismaChannelRepository = require('../../src/infrastructure/persistence/PrismaChannelRepository');
const ThumbnailGenerator = require('../../src/infrastructure/media/ThumbnailGenerator');

// Application Services
const VideoService = require('../../src/application/services/VideoService');
const ChunkUploadService = require('../../src/application/services/ChunkUploadService');

// Presentation
const VideoController = require('../../src/presentation/controllers/VideoController');
const ChunkUploadController = require('../../src/presentation/controllers/ChunkUploadController');
const QueueController = require('../../src/presentation/controllers/QueueController');

// Router
const UploadServiceRouter = require('./router');
const corsMiddleware = require('../../src/presentation/middleware/corsMiddleware');

// Configuration
const PORT = parseInt(process.env.PORT || '3001', 10);
const SERVICE_NAME = process.env.SERVICE_NAME || 'upload';

// Ensure unique port if PORT is already 3000
const ACTUAL_PORT = PORT === 3000 ? 3001 : PORT;

async function initializeContainer() {
    console.log(`🚀 ${SERVICE_NAME.toUpperCase()} SERVICE`);
    console.log('='.repeat(SERVICE_NAME.length + 17));
    console.log('');

    // Infrastructure - Configure connection pool for upload service
    const prismaClient = DatabaseConfig.getPrismaClient({ serviceType: 'upload' });
    const videoRepository = new PrismaVideoRepository(prismaClient);
    const channelRepository = new PrismaChannelRepository(prismaClient); // Still needed for VideoService
    const storageRepository = StorageConfig.createStorageRepository();
    const thumbnailGenerator = new ThumbnailGenerator();

    // Application Services
    const videoService = new VideoService(
        videoRepository,
        storageRepository,
        thumbnailGenerator,
        channelRepository
    );

    // Presentation Controllers
    const videoController = new VideoController(videoService);
    const queueController = new QueueController();

    // Chunked Upload - Use Prisma repository for production reliability
    const PrismaUploadSessionRepository = require('../../src/infrastructure/persistence/PrismaUploadSessionRepository');
    const uploadSessionRepository = new PrismaUploadSessionRepository(prismaClient);
    const chunkUploadService = new ChunkUploadService(uploadSessionRepository);
    const chunkUploadController = new ChunkUploadController(
        chunkUploadService,
        videoService,
        storageRepository
    );

    // Router
    const router = new UploadServiceRouter(
        videoController,
        chunkUploadController,
        queueController
    );

    console.log('✅ Dependencies initialized');
    console.log(`📦 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
    console.log(`📦 Storage: ${process.env.STORAGE_MODE || 'local'}`);
    console.log(`📦 Redis: ${process.env.REDIS_URL ? 'Connected' : 'Not configured'}`);
    console.log('');
    console.log('ℹ️  Authentication is handled by Gateway');
    console.log('ℹ️  User context received via X-User-* headers');
    console.log('ℹ️  Architecture: Multiple domains co-located for operational simplicity (see docs/ARCHITECTURE.md)');
    console.log('');

    return { router, prismaClient };
}

// Use validated user context middleware
const userContextMiddleware = require('../../src/presentation/middleware/userContextMiddleware');

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
                                    const result = await healthChecker.runAllChecks(['database', 'storage']);
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
        // Log error but don't exit - allow graceful shutdown to handle it
        // In production, send to error tracking service (Sentry, etc.)
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
        console.error('❌ Uncaught Exception:', error);
        console.error('Stack:', error.stack);
        // Log error but don't exit immediately - allow graceful shutdown
        // In production, send to error tracking service
    });

    // Graceful shutdown
    let isShuttingDown = false;
    const shutdown = async () => {
        if (isShuttingDown) {
            console.log('⚠️  Shutdown already in progress...');
            return;
        }
        isShuttingDown = true;

        console.log('\n🛑 Shutting down upload service...');

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
            // Note: In a production environment, you'd track active requests
            // For now, we'll just wait a short time
            await new Promise(resolve => setTimeout(resolve, 2000));

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
        console.log(`✅ Upload Service listening on port ${ACTUAL_PORT}`);
        console.log(`🌍 Health check: http://localhost:${ACTUAL_PORT}/health`);
        console.log('');
    });
}

main().catch((error) => {
    console.error('❌ Failed to start upload service:', error);
    process.exit(1);
});
