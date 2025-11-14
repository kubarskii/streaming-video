// @ts-check
// Playlist Service
// Handles playlist management
// Authentication is handled by Gateway

require('dotenv').config();
const http = require('http');

// Infrastructure
const DatabaseConfig = require('../../src/infrastructure/config/DatabaseConfig');
const PrismaVideoRepository = require('../../src/infrastructure/persistence/PrismaVideoRepository');
const PrismaPlaylistRepository = require('../../src/infrastructure/persistence/PrismaPlaylistRepository');

// Application Services
const PlaylistService = require('../../src/application/services/PlaylistService');

// Presentation
const PlaylistController = require('../../src/presentation/controllers/PlaylistController');

// Router
const PlaylistServiceRouter = require('./router');
const corsMiddleware = require('../../src/presentation/middleware/corsMiddleware');
const userContextMiddleware = require('../../src/presentation/middleware/userContextMiddleware');

// Configuration
const PORT = parseInt(process.env.PORT || '3005', 10);
const SERVICE_NAME = process.env.SERVICE_NAME || 'playlist';

// Ensure unique port if PORT is already 3000
const ACTUAL_PORT = PORT === 3000 ? 3005 : PORT;

async function initializeContainer() {
    console.log(`📋 ${SERVICE_NAME.toUpperCase()} SERVICE`);
    console.log('='.repeat(SERVICE_NAME.length + 17));
    console.log('');

    // Infrastructure - Configure connection pool for playlist service
    const prismaClient = DatabaseConfig.getPrismaClient({ serviceType: 'playlist' });
    const videoRepository = new PrismaVideoRepository(prismaClient);
    const playlistRepository = new PrismaPlaylistRepository(prismaClient);

    // Application Services
    const playlistService = new PlaylistService(playlistRepository, videoRepository);

    // Presentation Controllers
    const playlistController = new PlaylistController(playlistService);

    // Router
    const router = new PlaylistServiceRouter(playlistController);

    console.log('✅ Dependencies initialized');
    console.log(`📦 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
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
        
        console.log('\n🛑 Shutting down playlist service...');
        
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
        console.log(`✅ Playlist Service listening on port ${ACTUAL_PORT}`);
        console.log(`🌍 Health check: http://localhost:${ACTUAL_PORT}/health`);
        console.log('');
    });
}

main().catch((error) => {
    console.error('❌ Failed to start playlist service:', error);
    process.exit(1);
});

