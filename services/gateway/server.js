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

// Configuration
const PORT = parseInt(process.env.PORT || '3000', 10);
const UPLOAD_SERVICE_URL = process.env.UPLOAD_SERVICE_URL || 'http://localhost:3001';
const STREAMING_SERVICE_URL = process.env.STREAMING_SERVICE_URL || 'http://localhost:3003';

console.log('🌐 API GATEWAY');
console.log('='.repeat(30));
console.log('');
console.log(`🔐 Authentication: Handled by Gateway`);
console.log(`📦 Upload Service: ${UPLOAD_SERVICE_URL}`);
console.log(`📦 Streaming Service: ${STREAMING_SERVICE_URL}`);
console.log('');

// Initialize authentication
let authController, authService, jwtService, prismaClient;

async function initializeAuth() {
    prismaClient = DatabaseConfig.getPrismaClient();
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

    // CORS headers - allow the requesting origin
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Handle OPTIONS preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    // Gateway health check
    if (pathname === '/health' || pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            status: 'healthy',
            service: 'gateway',
            timestamp: new Date().toISOString(),
            upstreams: {
                upload: UPLOAD_SERVICE_URL,
                streaming: STREAMING_SERVICE_URL,
            }
        }));
    }

    // ============================================================
    // AUTHENTICATION ROUTES (Handled by Gateway)
    // ============================================================

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
        // Authenticate first, then call controller
        await authenticateRequest(req, res, () => {
            authController.me(req, res);
        });
        return;
    }

    // ============================================================
    // Authenticate all other API requests
    // ============================================================
    if (pathname.startsWith('/api/')) {
        await authenticateRequest(req, res, () => {
            // Continue to service routing
        });
    }

    // ============================================================
    // STREAMING SERVICE ROUTES
    // ============================================================

    // Video streaming
    if (pathname === '/video') {
        injectUserHeaders(req, res, () => { });
        return streamingProxy(req, res);
    }

    // Quality variants
    if (pathname.match(/^\/api\/videos\/[^/]+\/qualities$/)) {
        injectUserHeaders(req, res, () => { });
        return streamingProxy(req, res);
    }

    // View counting
    if (pathname.match(/^\/api\/videos\/[^/]+\/views$/)) {
        injectUserHeaders(req, res, () => { });
        return streamingProxy(req, res);
    }

    // ============================================================
    // UPLOAD SERVICE ROUTES
    // ============================================================

    // Upload routes
    if (pathname.startsWith('/api/upload/')) {
        console.log(`→ Upload Service: ${req.method} ${pathname}`);
        injectUserHeaders(req, res, () => { });
        return uploadProxy(req, res);
    }

    // Video metadata CRUD
    if (pathname.startsWith('/api/videos')) {
        console.log(`→ Upload Service: ${req.method} ${pathname}`);
        injectUserHeaders(req, res, () => { });
        return uploadProxy(req, res);
    }

    // Queue management
    if (pathname.startsWith('/api/queues')) {
        injectUserHeaders(req, res, () => { });
        return uploadProxy(req, res);
    }

    // Channels
    if (pathname.startsWith('/api/channels')) {
        injectUserHeaders(req, res, () => { });
        return uploadProxy(req, res);
    }

    // Playlists
    if (pathname.startsWith('/api/playlists')) {
        injectUserHeaders(req, res, () => { });
        return uploadProxy(req, res);
    }

    // Likes
    if (pathname.match(/^\/api\/videos\/[^/]+\/like(s)?$/)) {
        injectUserHeaders(req, res, () => { });
        return uploadProxy(req, res);
    }

    // Comments
    if (pathname === '/api/comments' || pathname.match(/^\/api\/comments\/[^/]+$/)) {
        injectUserHeaders(req, res, () => { });
        return uploadProxy(req, res);
    }

    // Subscriptions
    if (pathname === '/api/subscriptions' || pathname.match(/^\/api\/subscriptions\/[^/]+/)) {
        injectUserHeaders(req, res, () => { });
        return uploadProxy(req, res);
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
    res.end(JSON.stringify({ error: 'Not found' }));
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
        console.log('📊 Routing:');
        console.log('  🔐 /api/auth/*         → Gateway (Authentication)');
        console.log('');
        console.log('  📤 /api/upload/*       → Upload Service');
        console.log('  📤 /api/videos (CRUD)  → Upload Service');
        console.log('  📤 /api/channels/*     → Upload Service (temp)');
        console.log('  📤 /api/playlists/*    → Upload Service (temp)');
        console.log('  📤 /api/queues/*       → Upload Service');
        console.log('');
        console.log('  🎬 /video              → Streaming Service');
        console.log('  🎬 /api/videos/*/qualities → Streaming Service');
        console.log('  🎬 /api/videos/*/views → Streaming Service');
        console.log('');
        console.log('  💬 /api/videos/*/like  → Upload Service (temp)');
        console.log('  💬 /api/comments       → Upload Service (temp)');
        console.log('  💬 /api/subscriptions  → Upload Service (temp)');
        console.log('');
        console.log('  📁 /*                  → Static files (public/)');
        console.log('');
        console.log('  Note: Social features (likes, comments, subs) should move to separate service');
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
