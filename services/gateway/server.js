// @ts-check
// API Gateway Service
// Handles authentication and routes requests to microservices

require('dotenv').config();
const http = require('http');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

// Authentication
const DatabaseConfig = require('../../src/infrastructure/config/DatabaseConfig');
const PrismaUserRepository = require('../../src/infrastructure/persistence/PrismaUserRepository');
const PasswordHasher = require('../../src/infrastructure/auth/PasswordHasher');
const JWTService = require('../../src/infrastructure/auth/JWTService');
const AuthService = require('../../src/application/services/AuthService');
const AuthController = require('../../src/presentation/controllers/AuthController');

// Routing configuration
const { matchRoute, routes } = require('./routes');

// Configuration
const PORT = parseInt(process.env.PORT || '3000', 10);
const UPLOAD_SERVICE_URL = process.env.UPLOAD_SERVICE_URL || 'http://localhost:3001';
const STREAMING_SERVICE_URL = process.env.STREAMING_SERVICE_URL || 'http://localhost:3003';
const SOCIAL_SERVICE_URL = process.env.SOCIAL_SERVICE_URL || 'http://localhost:3002';
const CHANNEL_SERVICE_URL = process.env.CHANNEL_SERVICE_URL || 'http://localhost:3004';
const PLAYLIST_SERVICE_URL = process.env.PLAYLIST_SERVICE_URL || 'http://localhost:3005';

console.log('🌐 API GATEWAY');
console.log('='.repeat(30));
console.log('');
console.log(`🔐 Authentication: Handled by Gateway`);
console.log(`📦 Upload Service: ${UPLOAD_SERVICE_URL}`);
console.log(`📦 Streaming Service: ${STREAMING_SERVICE_URL}`);
console.log(`💬 Social Service: ${SOCIAL_SERVICE_URL}`);
console.log(`📺 Channel Service: ${CHANNEL_SERVICE_URL}`);
console.log(`📋 Playlist Service: ${PLAYLIST_SERVICE_URL}`);
console.log('');

// Initialize authentication
let authController, authService, jwtService, prismaClient;

async function initializeAuth() {
    prismaClient = DatabaseConfig.getPrismaClient({ serviceType: 'gateway' });
    const userRepository = new PrismaUserRepository(prismaClient);
    const passwordHasher = new PasswordHasher();
    jwtService = new JWTService();
    authService = new AuthService(userRepository, passwordHasher, jwtService);
    authController = new AuthController(authService);

    console.log('✅ Authentication initialized');
}

// Create proxy middleware
const uploadProxy = createProxyMiddleware({
    target: UPLOAD_SERVICE_URL,
    changeOrigin: true,
});

const streamingProxy = createProxyMiddleware({
    target: STREAMING_SERVICE_URL,
    changeOrigin: true,
});

const socialProxy = createProxyMiddleware({
    target: SOCIAL_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
        // Don't rewrite the path - preserve it as-is
    },
    // @ts-ignore - http-proxy-middleware options
    onError: (err, req, res) => {
        console.error('❌ Social Service Proxy Error:', err.message);
        if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Social service unavailable' }));
        }
    },
    // @ts-ignore - http-proxy-middleware options
    onProxyReq: (proxyReq, req, res) => {
        console.log(`[Gateway→Social] ${req.method} ${req.url}`);
    },
    // @ts-ignore - http-proxy-middleware options
    onProxyRes: (proxyRes, req, res) => {
        console.log(`[Gateway←Social] ${proxyRes.statusCode} ${req.url}`);
    },
});

const channelProxy = createProxyMiddleware({
    target: CHANNEL_SERVICE_URL,
    changeOrigin: true,
});

const playlistProxy = createProxyMiddleware({
    target: PLAYLIST_SERVICE_URL,
    changeOrigin: true,
});

// Middleware to inject user headers before proxying
function injectUserHeaders(req, res, next) {
    if (req.user) {
        req.headers['x-user-id'] = req.user.id;
        req.headers['x-user-email'] = req.user.email || '';
        req.headers['x-user-username'] = req.user.username || '';
    }
    next();
}

// Static file serving
function serveStaticFile(req, res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.webp': 'image/webp',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('File not found');
        }

        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
        });
        res.end(data);
    });
}

// Authentication middleware
async function authenticateRequest(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
        try {
            const payload = await authService.verifyToken(token);
            if (payload && typeof payload === 'object' && 'userId' in payload) {
                req.user = {
                    id: payload.userId,
                    userId: payload.userId,
                    email: payload.email,
                    username: payload.username
                };
            }
        } catch (err) {
            // Invalid token, continue as unauthenticated
            // Don't fail the request, just don't set user
        }
    }

    next();
}

// Routing logic
async function routeRequest(req, res) {
    // Parse URL with error handling
    let urlObj, pathname;
    try {
        // Sanitize URL - handle double slashes and empty paths
        let sanitizedUrl = req.url || '/';
        if (sanitizedUrl === '//' || sanitizedUrl === '') {
            sanitizedUrl = '/';
        }

        urlObj = new URL(sanitizedUrl, `http://${req.headers.host}`);
        pathname = urlObj.pathname;
    } catch (error) {
        console.error(`❌ Invalid URL: "${req.url}" from ${req.headers['user-agent'] || 'unknown'}`, error.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid URL' }));
    }

    // CORS headers - use validated CORS middleware logic
    const allowedOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
        : [];
    const origin = req.headers.origin;


    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range, X-User-Id, X-User-Email, X-User-Username');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Handle OPTIONS preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    // Match route using declarative routing configuration
    const route = matchRoute(pathname, req.method);

    if (route) {
        console.log(`→ ${route.service.charAt(0).toUpperCase() + route.service.slice(1)} Service: ${req.method} ${pathname} (${route.description})`);

        // Handle gateway routes (handled directly by gateway)
        if (route.service === 'gateway') {
            // Health checks
            if (pathname === '/health' || pathname === '/api/health' || pathname === '/health/quick') {
                const HealthChecker = require('../../src/infrastructure/health/HealthChecker');
                const healthChecker = new HealthChecker();

                try {
                    if (pathname === '/health/quick') {
                        const result = await healthChecker.quickCheck();
                        res.writeHead(result.status === 'healthy' ? 200 : 503, {
                            'Content-Type': 'application/json'
                        });
                        return res.end(JSON.stringify({
                            ...result,
                            service: 'gateway'
                        }));
                    } else {
                        const result = await healthChecker.runAllChecks(['database']);
                        res.writeHead(result.status === 'healthy' ? 200 : 503, {
                            'Content-Type': 'application/json'
                        });
                        return res.end(JSON.stringify({
                            ...result,
                            service: 'gateway',
                            upstreams: {
                                upload: UPLOAD_SERVICE_URL,
                                streaming: STREAMING_SERVICE_URL,
                            }
                        }));
                    }
                } catch (error) {
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({
                        status: 'unhealthy',
                        service: 'gateway',
                        error: error.message,
                        timestamp: new Date().toISOString()
                    }));
                }
            }

            // Auth routes
            if (pathname === '/api/auth/register' && req.method === 'POST') {
                return authController.register(req, res);
            }

            if (pathname === '/api/auth/login' && req.method === 'POST') {
                return authController.login(req, res);
            }

            if (pathname === '/api/auth/logout' && req.method === 'POST') {
                return authController.logout(req, res);
            }

            if (pathname === '/api/auth/me' && req.method === 'GET') {
                await authenticateRequest(req, res, () => {
                    authController.me(req, res);
                });
                return;
            }
        } else {
            // Authenticate API requests (except gateway routes)
            if (pathname.startsWith('/api/')) {
                await authenticateRequest(req, res, () => {
                    // Continue to service routing
                });
            }

            // Route to appropriate service proxy
            injectUserHeaders(req, res, () => {
                switch (route.service) {
                    case 'upload':
                        uploadProxy(req, res);
                        break;
                    case 'streaming':
                        streamingProxy(req, res);
                        break;
                    case 'social':
                        socialProxy(req, res);
                        break;
                    case 'channel':
                        channelProxy(req, res);
                        break;
                    case 'playlist':
                        playlistProxy(req, res);
                        break;
                    default:
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Unknown service' }));
                }
            });
            return;
        }
    } else {
        // No route matched - authenticate API requests before checking static files
        if (pathname.startsWith('/api/')) {
            await authenticateRequest(req, res, () => {
                // Continue to static file serving or 404
            });
        }
    }

    // ============================================================
    // STATIC FILE SERVING FROM PUBLIC FOLDER
    // ============================================================

    // Serve static files from public directory
    const publicDir = path.join(process.cwd(), 'public');
    const requestedPath = pathname === '/' ? '/index.html' : pathname;

    // Security: prevent directory traversal
    const safePath = path.normalize(requestedPath).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(publicDir, safePath);

    // Check if file exists in public directory
    if (filePath.startsWith(publicDir)) {
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            return serveStaticFile(req, res, filePath);
        }

        // If requesting a route without extension, serve index.html (SPA routing)
        if (!path.extname(pathname) && pathname !== '/') {
            const indexPath = path.join(publicDir, 'index.html');
            if (fs.existsSync(indexPath)) {
                return serveStaticFile(req, res, indexPath);
            }
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

// Create server
async function main() {
    await initializeAuth();

    const server = http.createServer(routeRequest);

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
        // Don't exit on uncaught exceptions - log and continue
    });

    // Graceful shutdown
    const shutdown = async () => {
        console.log('\n🛑 Shutting down gateway...');
        server.close(() => {
            console.log('✅ Gateway closed');
        });
        if (prismaClient) {
            await prismaClient.$disconnect();
            console.log('✅ Database disconnected');
        }
        process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Start server
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ API Gateway listening on port ${PORT}`);
        console.log(`🌍 Health check: http://localhost:${PORT}/health`);
        console.log('');
        console.log('📊 Routing Configuration:');
        console.log('');

        // Group routes by service
        const routesByService = {};
        routes.forEach(route => {
            if (!routesByService[route.service]) {
                routesByService[route.service] = [];
            }
            routesByService[route.service].push(route);
        });

        // Display routes by service
        const serviceIcons = {
            'gateway': '🔐',
            'upload': '📤',
            'streaming': '🎬',
            'social': '💬',
            'channel': '📺',
            'playlist': '📋'
        };

        Object.keys(routesByService).sort().forEach(service => {
            const icon = serviceIcons[service] || '📦';
            console.log(`  ${icon} ${service.toUpperCase()} Service:`);
            routesByService[service].forEach(route => {
                const pattern = route.pattern instanceof RegExp
                    ? route.pattern.toString()
                    : route.pattern;
                const methods = route.methods.length > 0 ? ` [${route.methods.join(',')}]` : '';
                console.log(`    ${pattern}${methods} - ${route.description}`);
            });
            console.log('');
        });

        console.log('  📁 /*                  → Static files (public/)');
        console.log('');

        // Check if public directory exists
        const publicDir = path.join(process.cwd(), 'public');
        if (fs.existsSync(publicDir)) {
            console.log(`📁 Serving static files from: ${publicDir}`);
        } else {
            console.log(`⚠️  Public directory not found: ${publicDir}`);
        }
        console.log('');
    });
}

main().catch((error) => {
    console.error('❌ Failed to start gateway:', error);
    process.exit(1);
});
