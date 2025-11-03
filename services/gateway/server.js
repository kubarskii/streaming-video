// @ts-check
// API Gateway Service
// Single entry point that routes requests to appropriate microservices

require('dotenv').config();
const http = require('http');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

// Configuration
const PORT = parseInt(process.env.PORT || '3000', 10);
const UPLOAD_SERVICE_URL = process.env.UPLOAD_SERVICE_URL || 'http://localhost:3001';
const STREAMING_SERVICE_URL = process.env.STREAMING_SERVICE_URL || 'http://localhost:3003';

console.log('🌐 API GATEWAY');
console.log('='.repeat(30));
console.log('');
console.log(`📦 Upload Service: ${UPLOAD_SERVICE_URL}`);
console.log(`📦 Streaming Service: ${STREAMING_SERVICE_URL}`);
console.log('');

// Create proxy middleware
const uploadProxy = createProxyMiddleware({
    target: UPLOAD_SERVICE_URL,
    changeOrigin: true,
    logLevel: 'silent',
});

const streamingProxy = createProxyMiddleware({
    target: STREAMING_SERVICE_URL,
    changeOrigin: true,
    logLevel: 'silent',
});

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

// Routing logic
function routeRequest(req, res) {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const pathname = urlObj.pathname;

    // CORS headers - allow the requesting origin
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

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
    // STREAMING SERVICE ROUTES
    // ============================================================

    // Video streaming
    if (pathname === '/video') {
        return streamingProxy(req, res);
    }

    // Quality variants
    if (pathname.match(/^\/api\/videos\/[^/]+\/qualities$/)) {
        return streamingProxy(req, res);
    }

    // Transcode trigger
    if (pathname.match(/^\/api\/videos\/[^/]+\/transcode$/)) {
        return streamingProxy(req, res);
    }

    // View counting
    if (pathname.match(/^\/api\/videos\/[^/]+\/views$/)) {
        return streamingProxy(req, res);
    }

    // Likes/Dislikes
    if (pathname.match(/^\/api\/videos\/[^/]+\/like(s)?$/)) {
        return streamingProxy(req, res);
    }

    // Comments
    if (pathname === '/api/comments' || pathname.match(/^\/api\/comments\/[^/]+$/)) {
        return streamingProxy(req, res);
    }

    // Subscriptions
    if (pathname === '/api/subscriptions' || pathname.match(/^\/api\/subscriptions\/[^/]+/)) {
        return streamingProxy(req, res);
    }

    // ============================================================
    // UPLOAD SERVICE ROUTES (Default for /api/*)
    // ============================================================

    // Everything else goes to upload service
    if (pathname.startsWith('/api/')) {
        return uploadProxy(req, res);
    }

    // ============================================================
    // STATIC FILE SERVING FROM PUBLIC FOLDER
    // ============================================================

    // Serve static files from public directory
    const publicDir = path.join(process.cwd(), 'public');
    let requestedPath = pathname === '/' ? '/index.html' : pathname;

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
const server = http.createServer(routeRequest);

// Graceful shutdown
const shutdown = async () => {
    console.log('\n🛑 Shutting down gateway...');
    server.close(() => {
        console.log('✅ Gateway closed');
        process.exit(0);
    });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ API Gateway listening on port ${PORT}`);
    console.log(`🌍 Health check: http://localhost:${PORT}/health`);
    console.log('');
    console.log('📊 Routing:');
    console.log('  /api/auth/*           → Upload Service');
    console.log('  /api/upload/*         → Upload Service');
    console.log('  /api/videos (CRUD)    → Upload Service');
    console.log('  /api/channels/*       → Upload Service');
    console.log('  /api/playlists/*      → Upload Service');
    console.log('  /api/queues/*         → Upload Service');
    console.log('');
    console.log('  /video                → Streaming Service');
    console.log('  /api/videos/*/qualities → Streaming Service');
    console.log('  /api/videos/*/views   → Streaming Service');
    console.log('  /api/videos/*/like    → Streaming Service');
    console.log('  /api/comments         → Streaming Service');
    console.log('  /api/subscriptions    → Streaming Service');
    console.log('');
    console.log('  /*                    → Static files (public/)');
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

