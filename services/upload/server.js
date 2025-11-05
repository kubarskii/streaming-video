// @ts-check
// Upload Service
// Handles video uploads and metadata management
// Authentication is handled by Gateway
// TODO: Separate channels, playlists, likes, comments, subscriptions into dedicated services

require('dotenv').config();
const http = require('http');
const path = require('path');

// Infrastructure
const DatabaseConfig = require('../../src/infrastructure/config/DatabaseConfig');
const StorageConfig = require('../../src/infrastructure/config/StorageConfig');
const PrismaVideoRepository = require('../../src/infrastructure/persistence/PrismaVideoRepository');
const PrismaChannelRepository = require('../../src/infrastructure/persistence/PrismaChannelRepository');
const PrismaPlaylistRepository = require('../../src/infrastructure/persistence/PrismaPlaylistRepository');
const PrismaVideoLikeRepository = require('../../src/infrastructure/persistence/PrismaVideoLikeRepository');
const PrismaSubscriptionRepository = require('../../src/infrastructure/persistence/PrismaSubscriptionRepository');
const PrismaCommentRepository = require('../../src/infrastructure/persistence/PrismaCommentRepository');
const ThumbnailGenerator = require('../../src/infrastructure/media/ThumbnailGenerator');

// Application Services
const VideoService = require('../../src/application/services/VideoService');
const ChunkUploadService = require('../../src/application/services/ChunkUploadService');
const PlaylistService = require('../../src/application/services/PlaylistService');

// Use Cases
const CreateChannelUseCase = require('../../src/application/use-cases/CreateChannelUseCase');
const GetChannelUseCase = require('../../src/application/use-cases/GetChannelUseCase');
const UpdateChannelUseCase = require('../../src/application/use-cases/UpdateChannelUseCase');
const ListChannelsUseCase = require('../../src/application/use-cases/ListChannelsUseCase');
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
const VideoController = require('../../src/presentation/controllers/VideoController');
const ChunkUploadController = require('../../src/presentation/controllers/ChunkUploadController');
const QueueController = require('../../src/presentation/controllers/QueueController');
const ChannelController = require('../../src/presentation/controllers/ChannelController');
const PlaylistController = require('../../src/presentation/controllers/PlaylistController');
const VideoLikeController = require('../../src/presentation/controllers/VideoLikeController');
const SubscriptionController = require('../../src/presentation/controllers/SubscriptionController');
const CommentController = require('../../src/presentation/controllers/CommentController');
const InMemoryUploadSessionRepository = require('../../src/infrastructure/persistence/InMemoryUploadSessionRepository');

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

    // Infrastructure
    const prismaClient = DatabaseConfig.getPrismaClient();
    const videoRepository = new PrismaVideoRepository(prismaClient);
    const channelRepository = new PrismaChannelRepository(prismaClient);
    const playlistRepository = new PrismaPlaylistRepository(prismaClient);
    const videoLikeRepository = new PrismaVideoLikeRepository(prismaClient);
    const subscriptionRepository = new PrismaSubscriptionRepository(prismaClient);
    const commentRepository = new PrismaCommentRepository(prismaClient);
    const storageRepository = StorageConfig.createStorageRepository();
    const thumbnailGenerator = new ThumbnailGenerator();

    // Application Services
    const videoService = new VideoService(
        videoRepository,
        storageRepository,
        thumbnailGenerator,
        channelRepository
    );
    const playlistService = new PlaylistService(playlistRepository, videoRepository);

    // Use Cases
    const createChannelUseCase = new CreateChannelUseCase(channelRepository, null); // No userRepository needed
    const getChannelUseCase = new GetChannelUseCase(channelRepository);
    const updateChannelUseCase = new UpdateChannelUseCase(channelRepository);
    const listChannelsUseCase = new ListChannelsUseCase(channelRepository);
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
    const videoController = new VideoController(videoService);
    const queueController = new QueueController();
    const channelController = new ChannelController(
        createChannelUseCase,
        getChannelUseCase,
        updateChannelUseCase,
        listChannelsUseCase
    );
    const playlistController = new PlaylistController(playlistService);
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

    // Chunked Upload
    const uploadSessionRepository = new InMemoryUploadSessionRepository();
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
        queueController,
        channelController,
        playlistController,
        videoLikeController,
        subscriptionController,
        commentController
    );

    console.log('✅ Dependencies initialized');
    console.log(`📦 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
    console.log(`📦 Storage: ${process.env.STORAGE_MODE || 'local'}`);
    console.log(`📦 Redis: ${process.env.REDIS_URL ? 'Connected' : 'Not configured'}`);
    console.log('');
    console.log('ℹ️  Authentication is handled by Gateway');
    console.log('ℹ️  User context received via X-User-* headers');
    console.log('⚠️  TODO: Move channels, playlists, likes, comments, subscriptions to separate services');
    console.log('');

    return { router, prismaClient };
}

// Middleware to extract user from gateway headers
function extractUserMiddleware(req, res, next) {
    const userId = req.headers['x-user-id'];
    const userEmail = req.headers['x-user-email'];
    const username = req.headers['x-user-username'];

    if (userId) {
        req.user = {
            id: userId,
            userId: userId,
            email: userEmail || '',
            username: username || ''
        };
    }

    next();
}

async function main() {
    const { router, prismaClient } = await initializeContainer();

    const server = http.createServer(async (req, res) => {
        try {
            // Apply CORS
            corsMiddleware(req, res, async () => {
                // Extract user from gateway headers
                extractUserMiddleware(req, res, async () => {
                    // Route request
                    const handled = await router.route(req, res);

                    if (!handled) {
                        // Health check
                        if (req.url === '/health') {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            return res.end(JSON.stringify({
                                status: 'healthy',
                                service: SERVICE_NAME,
                                timestamp: new Date().toISOString()
                            }));
                        }

                        // Not found
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Not found' }));
                    }
                });
            });
        } catch (error) {
            console.error('❌ Request handling error:', error);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal server error' }));
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
    const shutdown = async () => {
        console.log('\n🛑 Shutting down upload service...');
        server.close(() => {
            console.log('✅ HTTP server closed');
        });
        await prismaClient.$disconnect();
        console.log('✅ Database disconnected');
        process.exit(0);
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
