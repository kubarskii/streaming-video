// @ts-check
// server.js
// Video streaming service with DDD architecture
// Supports Backblaze B2 + Cloudflare CDN or local storage

require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');

// Infrastructure
const DatabaseConfig = require('./src/infrastructure/config/DatabaseConfig');
const StorageConfig = require('./src/infrastructure/config/StorageConfig');
const PrismaVideoRepository = require('./src/infrastructure/persistence/PrismaVideoRepository');
const PrismaUserRepository = require('./src/infrastructure/persistence/PrismaUserRepository');
const PrismaChannelRepository = require('./src/infrastructure/persistence/PrismaChannelRepository');
const PrismaSubscriptionRepository = require('./src/infrastructure/persistence/PrismaSubscriptionRepository');
const PrismaCommentRepository = require('./src/infrastructure/persistence/PrismaCommentRepository');
const PrismaVideoQualityRepository = require('./src/infrastructure/persistence/PrismaVideoQualityRepository');
const PrismaVideoLikeRepository = require('./src/infrastructure/persistence/PrismaVideoLikeRepository');
const PrismaPlaylistRepository = require('./src/infrastructure/persistence/PrismaPlaylistRepository');
const PasswordHasher = require('./src/infrastructure/auth/PasswordHasher');
const JWTService = require('./src/infrastructure/auth/JWTService');
const ThumbnailGenerator = require('./src/infrastructure/media/ThumbnailGenerator');
const VideoTranscoder = require('./src/infrastructure/media/VideoTranscoder');

// Application - Services
const VideoService = require('./src/application/services/VideoService');
const AuthService = require('./src/application/services/AuthService');
const PlaylistService = require('./src/application/services/PlaylistService');

// Application - Use Cases
const CreateChannelUseCase = require('./src/application/use-cases/CreateChannelUseCase');
const GetChannelUseCase = require('./src/application/use-cases/GetChannelUseCase');
const UpdateChannelUseCase = require('./src/application/use-cases/UpdateChannelUseCase');
const ListChannelsUseCase = require('./src/application/use-cases/ListChannelsUseCase');
const SubscribeToChannelUseCase = require('./src/application/use-cases/SubscribeToChannelUseCase');
const UnsubscribeFromChannelUseCase = require('./src/application/use-cases/UnsubscribeFromChannelUseCase');
const GetUserSubscriptionsUseCase = require('./src/application/use-cases/GetUserSubscriptionsUseCase');
const CheckSubscriptionStatusUseCase = require('./src/application/use-cases/CheckSubscriptionStatusUseCase');
const IncrementVideoViewsUseCase = require('./src/application/use-cases/IncrementVideoViewsUseCase');
const CreateCommentUseCase = require('./src/application/use-cases/CreateCommentUseCase');
const GetVideoCommentsUseCase = require('./src/application/use-cases/GetVideoCommentsUseCase');
const UpdateCommentUseCase = require('./src/application/use-cases/UpdateCommentUseCase');
const DeleteCommentUseCase = require('./src/application/use-cases/DeleteCommentUseCase');
const LikeVideoUseCase = require('./src/application/use-cases/LikeVideoUseCase');
const GetVideoLikeStatsUseCase = require('./src/application/use-cases/GetVideoLikeStatsUseCase');
const RemoveVideoLikeUseCase = require('./src/application/use-cases/RemoveVideoLikeUseCase');

// Presentation
const VideoController = require('./src/presentation/controllers/VideoController');
const StreamController = require('./src/presentation/controllers/StreamController');
const AuthController = require('./src/presentation/controllers/AuthController');
const UploadController = require('./src/presentation/controllers/UploadController');
const ChunkUploadController = require('./src/presentation/controllers/ChunkUploadController');
const ChannelController = require('./src/presentation/controllers/ChannelController');
const SubscriptionController = require('./src/presentation/controllers/SubscriptionController');
const CommentController = require('./src/presentation/controllers/CommentController');
const VideoLikeController = require('./src/presentation/controllers/VideoLikeController');
const PlaylistController = require('./src/presentation/controllers/PlaylistController');
const QueueController = require('./src/presentation/controllers/QueueController');
const ChunkUploadService = require('./src/application/services/ChunkUploadService');
const InMemoryUploadSessionRepository = require('./src/infrastructure/persistence/InMemoryUploadSessionRepository');
const Router = require('./src/presentation/routes/Router');
const corsMiddleware = require('./src/presentation/middleware/corsMiddleware');
const { authMiddleware } = require('./src/presentation/middleware/authMiddleware');

// Configuration
const HOST = process.env.HOST || '127.0.0.1';
const PORT = parseInt(process.env.PORT || '3000', 10);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const PUBLIC_DIR = path.join(__dirname, 'public');
const SPA_STATIC_PATHS = new Set(['/', '/login', '/register', '/upload', '/profile', '/channels', '/subscriptions']);
const SPA_PREFIXES = ['/video/', '/channel/'];

// Dependency Injection Container
class Container {
    static async initialize() {
        // Infrastructure layer
        const prismaClient = DatabaseConfig.getPrismaClient();
        const videoRepository = new PrismaVideoRepository(prismaClient);
        const userRepository = new PrismaUserRepository(prismaClient);
        const channelRepository = new PrismaChannelRepository(prismaClient);
        const subscriptionRepository = new PrismaSubscriptionRepository(prismaClient);
        const commentRepository = new PrismaCommentRepository(prismaClient);
        const videoQualityRepository = new PrismaVideoQualityRepository(prismaClient);
        const videoLikeRepository = new PrismaVideoLikeRepository(prismaClient);
        const playlistRepository = new PrismaPlaylistRepository(prismaClient);
        const storageRepository = StorageConfig.createStorageRepository();
        const passwordHasher = new PasswordHasher();
        const jwtService = new JWTService();
        const thumbnailGenerator = new ThumbnailGenerator();
        const videoTranscoder = new VideoTranscoder();

        // Application layer - Services
        const videoService = new VideoService(
            videoRepository,
            storageRepository,
            thumbnailGenerator,
            channelRepository,
            videoQualityRepository,
            videoTranscoder
        );
        const authService = new AuthService(userRepository, passwordHasher, jwtService);
        const playlistService = new PlaylistService(playlistRepository, videoRepository);

        // Application layer - Use Cases
        const createChannelUseCase = new CreateChannelUseCase(channelRepository, userRepository);
        const getChannelUseCase = new GetChannelUseCase(channelRepository);
        const updateChannelUseCase = new UpdateChannelUseCase(channelRepository);
        const listChannelsUseCase = new ListChannelsUseCase(channelRepository);
        const subscribeToChannelUseCase = new SubscribeToChannelUseCase(subscriptionRepository, channelRepository);
        const unsubscribeFromChannelUseCase = new UnsubscribeFromChannelUseCase(subscriptionRepository, channelRepository);
        const getUserSubscriptionsUseCase = new GetUserSubscriptionsUseCase(subscriptionRepository);
        const checkSubscriptionStatusUseCase = new CheckSubscriptionStatusUseCase(subscriptionRepository);
        const incrementVideoViewsUseCase = new IncrementVideoViewsUseCase(videoRepository);
        const createCommentUseCase = new CreateCommentUseCase(commentRepository, videoRepository);
        const getVideoCommentsUseCase = new GetVideoCommentsUseCase(commentRepository);
        const updateCommentUseCase = new UpdateCommentUseCase(commentRepository);
        const deleteCommentUseCase = new DeleteCommentUseCase(commentRepository);
        const likeVideoUseCase = new LikeVideoUseCase(videoLikeRepository, videoRepository);
        const getVideoLikeStatsUseCase = new GetVideoLikeStatsUseCase(videoLikeRepository);
        const removeVideoLikeUseCase = new RemoveVideoLikeUseCase(videoLikeRepository);

        // Presentation layer
        const videoController = new VideoController(videoService);
        const streamController = new StreamController(videoService, storageRepository, incrementVideoViewsUseCase, videoQualityRepository);
        const authController = new AuthController(authService);
        const uploadController = new UploadController(videoService);
        const channelController = new ChannelController(
            createChannelUseCase,
            getChannelUseCase,
            updateChannelUseCase,
            listChannelsUseCase
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
        const videoLikeController = new VideoLikeController(
            likeVideoUseCase,
            getVideoLikeStatsUseCase,
            removeVideoLikeUseCase
        );
        const playlistController = new PlaylistController(playlistService);
        const queueController = new QueueController();

        // Chunked Upload
        const uploadSessionRepository = new InMemoryUploadSessionRepository();
        const chunkUploadService = new ChunkUploadService(uploadSessionRepository);
        const chunkUploadController = new ChunkUploadController(chunkUploadService, videoService, storageRepository);

        const router = new Router(
            videoController,
            streamController,
            authController,
            uploadController,
            channelController,
            subscriptionController,
            commentController,
            chunkUploadController,
            videoLikeController,
            playlistController,
            queueController
        );

        return { router, prismaClient, storageRepository, authService };
    }
}

// Helper to serve static files
function serveFile(res, filePath, contentType = 'text/plain') {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('404 Not Found');
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

// Helper to serve static files with cache headers
function serveFileWithCache(res, filePath, contentType = 'text/plain') {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('404 Not Found');
        }
        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'ETag': `"${Date.now()}-${data.length}"`
        });
        res.end(data);
    });
}

// Start server
async function startServer() {
    try {
        console.log('🚀 Initializing application...');

        // Initialize dependency injection container
        const { router, prismaClient, storageRepository, authService } = await Container.initialize();

        console.log('✅ Dependencies initialized');
        console.log(`📦 Storage mode: ${process.env.STORAGE_MODE || 'local'}`);

        // Create HTTP server
        const server = http.createServer(async (req, res) => {
            try {
                // Apply CORS middleware
                await runMiddleware(req, res, corsMiddleware);
                if (res.writableEnded) return;

                // Apply auth middleware
                await runMiddleware(req, res, authMiddleware(authService));
                if (res.writableEnded) return;

                // Try routing through DDD router
                const handled = await router.route(req, res);

                if (handled !== null) {
                    return; // Request was handled by router
                }

                // Fallback to static file serving
                const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;

                // Explicitly handle favicon requests with proper cache headers
                if (pathname === '/favicon.svg' || pathname === '/favicon.ico') {
                    const faviconPath = pathname === '/favicon.ico'
                        ? path.join(PUBLIC_DIR, 'favicon.ico')
                        : path.join(PUBLIC_DIR, 'favicon.svg');

                    if (fs.existsSync(faviconPath)) {
                        const contentType = pathname === '/favicon.ico' ? 'image/x-icon' : 'image/svg+xml';
                        return serveFileWithCache(res, faviconPath, contentType);
                    }
                }

                if (pathname === '/') {
                    return serveFile(res, path.join(PUBLIC_DIR, 'index.html'), 'text/html');
                }

                // Serve static files from public/ or frontend/dist/
                const safePath = path.join(PUBLIC_DIR, pathname.replace(/^\/+/, ''));
                if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
                    const contentType = getContentType(safePath);
                    // Add cache headers for static assets
                    if (pathname.match(/\.(css|js|svg|ico|png|jpg|jpeg|gif|woff|woff2)$/)) {
                        return serveFileWithCache(res, safePath, contentType);
                    }
                    return serveFile(res, safePath, contentType);
                }

                // SPA fallback: Serve index.html for known frontend routes handled client-side
                if (!pathname.startsWith('/api') && pathname !== '/video') {
                    const normalizedPath = pathname.replace(/\/+$/, '') || '/';
                    const isSpaRoute =
                        SPA_STATIC_PATHS.has(normalizedPath) ||
                        SPA_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix));

                    if (isSpaRoute) {
                        const indexPath = path.join(PUBLIC_DIR, 'index.html');
                        if (fs.existsSync(indexPath)) {
                            return serveFile(res, indexPath, 'text/html');
                        }
                    }
                }

                // 404 Not Found
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
            } catch (error) {
                console.error('Server error:', error);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error');
            }
        });

        // Graceful shutdown
        process.on('SIGTERM', async () => {
            console.log('🛑 SIGTERM received, shutting down gracefully...');
            server.close(() => {
                console.log('✅ HTTP server closed');
            });
            await DatabaseConfig.disconnect();
            console.log('✅ Database disconnected');
            process.exit(0);
        });

        process.on('SIGINT', async () => {
            console.log('\n🛑 SIGINT received, shutting down gracefully...');
            server.close(() => {
                console.log('✅ HTTP server closed');
            });
            await DatabaseConfig.disconnect();
            console.log('✅ Database disconnected');
            process.exit(0);
        });

        // Start listening
        server.listen(PORT, HOST, () => {
            console.log('');
            console.log('🎥 Video Streaming Service');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`📡 Server:     http://${HOST}:${PORT}`);
            console.log(`🗄️  Database:   SQLite (Prisma)`);
            console.log(`💾 Storage:    ${process.env.STORAGE_MODE || 'local'}`);
            console.log(`🎨 Frontend:   ${IS_PRODUCTION ? 'Built (public/)' : 'Dev mode'}`);
            console.log('');
            console.log('API Endpoints:');
            console.log(`  GET    /api/videos          - List all videos`);
            console.log(`  GET    /api/videos/:id      - Get video by ID`);
            console.log(`  DELETE /api/videos/:id      - Delete video`);
            console.log(`  GET    /video?file=:name    - Stream video`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('');
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Helper to get content type
function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const types = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
    };
    return types[ext] || 'application/octet-stream';
}

// Helper to run middleware
function runMiddleware(req, res, middleware) {
    return new Promise((resolve, reject) => {
        middleware(req, res, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

// Start the server
startServer();
