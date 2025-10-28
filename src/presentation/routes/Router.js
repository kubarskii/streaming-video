// Presentation: Router
// Routes HTTP requests to appropriate controllers

const { URL } = require('url');

class Router {
    constructor(videoController, streamController, authController, uploadController) {
        this.videoController = videoController;
        this.streamController = streamController;
        this.authController = authController;
        this.uploadController = uploadController;
    }

    /**
     * Route incoming request to appropriate handler
     */
    async route(req, res) {
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const pathname = urlObj.pathname;
        const queryParams = Object.fromEntries(urlObj.searchParams);

        // Auth Routes
        if (pathname === '/api/auth/register' && req.method === 'POST') {
            return await this.authController.register(req, res);
        }

        if (pathname === '/api/auth/login' && req.method === 'POST') {
            return await this.authController.login(req, res);
        }

        if (pathname === '/api/auth/logout' && req.method === 'POST') {
            return await this.authController.logout(req, res);
        }

        if (pathname === '/api/auth/me' && req.method === 'GET') {
            return await this.authController.me(req, res);
        }

        // Upload Route
        if (pathname === '/api/upload' && req.method === 'POST') {
            return await this.uploadController.uploadVideo(req, res);
        }

        // Video API Routes
        if (pathname === '/api/videos' && req.method === 'GET') {
            return await this.videoController.listVideos(req, res, queryParams);
        }

        if (pathname.startsWith('/api/videos/') && req.method === 'GET') {
            const videoId = pathname.split('/')[3];
            return await this.videoController.getVideo(req, res, videoId);
        }

        if (pathname.startsWith('/api/videos/') && req.method === 'DELETE') {
            const videoId = pathname.split('/')[3];
            return await this.videoController.deleteVideo(req, res, videoId);
        }

        // Video streaming route
        if (pathname === '/video') {
            const fileName = queryParams.file;
            if (!fileName) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                return res.end('Missing ?file parameter');
            }
            return await this.streamController.streamVideo(req, res, fileName);
        }

        // Not found
        return null; // Let the main server handle it
    }
}

module.exports = Router;

