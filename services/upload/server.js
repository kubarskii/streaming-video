// @ts-check
// Upload Service
// Handles video uploads, authentication, and metadata management

require('dotenv').config();
const http = require('http');
const path = require('path');

// Infrastructure
const DatabaseConfig = require('../../src/infrastructure/config/DatabaseConfig');
const StorageConfig = require('../../src/infrastructure/config/StorageConfig');
const PrismaVideoRepository = require('../../src/infrastructure/persistence/PrismaVideoRepository');
const PrismaUserRepository = require('../../src/infrastructure/persistence/PrismaUserRepository');
const PrismaChannelRepository = require('../../src/infrastructure/persistence/PrismaChannelRepository');
const PrismaPlaylistRepository = require('../../src/infrastructure/persistence/PrismaPlaylistRepository');
const PasswordHasher = require('../../src/infrastructure/auth/PasswordHasher');
const JWTService = require('../../src/infrastructure/auth/JWTService');
const ThumbnailGenerator = require('../../src/infrastructure/media/ThumbnailGenerator');

// Application Services
const VideoService = require('../../src/application/services/VideoService');
const AuthService = require('../../src/application/services/AuthService');
const PlaylistService = require('../../src/application/services/PlaylistService');
const ChunkUploadService = require('../../src/application/services/ChunkUploadService');

// Presentation
const VideoController = require('../../src/presentation/controllers/VideoController');
const AuthController = require('../../src/presentation/controllers/AuthController');
const ChunkUploadController = require('../../src/presentation/controllers/ChunkUploadController');
const ChannelController = require('../../src/presentation/controllers/ChannelController');
const PlaylistController = require('../../src/presentation/controllers/PlaylistController');
const QueueController = require('../../src/presentation/controllers/QueueController');
const InMemoryUploadSessionRepository = require('../../src/infrastructure/persistence/InMemoryUploadSessionRepository');

// Router
const UploadServiceRouter = require('./router');
const corsMiddleware = require('../../src/presentation/middleware/corsMiddleware');
const { authMiddleware } = require('../../src/presentation/middleware/authMiddleware');

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
    const userRepository = new PrismaUserRepository(prismaClient);
    const channelRepository = new PrismaChannelRepository(prismaClient);
    const playlistRepository = new PrismaPlaylistRepository(prismaClient);
    const storageRepository = StorageConfig.createStorageRepository();
    const passwordHasher = new PasswordHasher();
    const jwtService = new JWTService();
    const thumbnailGenerator = new ThumbnailGenerator();

    // Application Services
    const videoService = new VideoService(
        videoRepository,
        storageRepository,
        thumbnailGenerator,
        channelRepository
    );
    const authService = new AuthService(userRepository, passwordHasher, jwtService);
    const playlistService = new PlaylistService(playlistRepository, videoRepository);

    // Presentation Controllers
    const videoController = new VideoController(videoService);
    const authController = new AuthController(authService);
    // Use Cases for Channel
    const CreateChannelUseCase = require('../../src/application/use-cases/CreateChannelUseCase');
    const GetChannelUseCase = require('../../src/application/use-cases/GetChannelUseCase');
    const UpdateChannelUseCase = require('../../src/application/use-cases/UpdateChannelUseCase');
    const ListChannelsUseCase = require('../../src/application/use-cases/ListChannelsUseCase');

    const createChannelUseCase = new CreateChannelUseCase(channelRepository, userRepository);
    const getChannelUseCase = new GetChannelUseCase(channelRepository);
    const updateChannelUseCase = new UpdateChannelUseCase(channelRepository);
    const listChannelsUseCase = new ListChannelsUseCase(channelRepository);

    const channelController = new ChannelController(
        createChannelUseCase,
        getChannelUseCase,
        updateChannelUseCase,
        listChannelsUseCase
    );
    const playlistController = new PlaylistController(playlistService);
    const queueController = new QueueController();

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
        authController,
        chunkUploadController,
        channelController,
        playlistController,
        queueController
    );

    console.log('✅ Dependencies initialized');
    console.log(`📦 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
    console.log(`📦 Storage: ${process.env.STORAGE_MODE || 'local'}`);
    console.log(`📦 Redis: ${process.env.REDIS_URL ? 'Connected' : 'Not configured'}`);
    console.log('');

    return { router, authService, prismaClient };
}

async function main() {
    const { router, authService, prismaClient } = await initializeContainer();

    const server = http.createServer(async (req, res) => {
        // Apply CORS
        corsMiddleware(req, res, async () => {
            // Apply auth middleware (extract JWT token)
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (token) {
                try {
                    const payload = await authService.verifyToken(token);
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

