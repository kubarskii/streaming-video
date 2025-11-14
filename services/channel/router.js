// @ts-check
// Channel Service Router
// Handles channel management
// Authentication is handled by Gateway

const { URL } = require('url');

class ChannelServiceRouter {
    constructor(channelController) {
        this.channelController = channelController;
    }

    async route(req, res) {
        // Parse URL with error handling
        let urlObj, pathname, queryParams;
        try {
            let sanitizedUrl = req.url || '/';
            if (sanitizedUrl === '//' || sanitizedUrl === '') {
                sanitizedUrl = '/';
            }

            urlObj = new URL(sanitizedUrl, `http://${req.headers.host}`);
            pathname = urlObj.pathname;
            queryParams = Object.fromEntries(urlObj.searchParams);
        } catch (error) {
            console.error(`❌ Invalid URL: "${req.url}"`, error.message);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: false,
                error: { 
                    message: 'Invalid URL',
                    code: 'INVALID_URL'
                }
            }));
            return false;
        }

        // ============================================================
        // CHANNEL ROUTES
        // ============================================================

        if (pathname === '/api/channels' && req.method === 'POST') {
            await this.channelController.createChannel(req, res);
            return true;
        }

        if (pathname === '/api/channels' && req.method === 'GET') {
            await this.channelController.getChannel(req, res, queryParams);
            return true;
        }

        if (pathname === '/api/channels/list' && req.method === 'GET') {
            await this.channelController.listChannels(req, res, queryParams);
            return true;
        }

        if (pathname.match(/^\/api\/channels\/[^/]+$/) && req.method === 'PATCH') {
            const channelId = pathname.split('/')[3];
            await this.channelController.updateChannel(req, res, channelId);
            return true;
        }

        // Not found
        return false;
    }
}

module.exports = ChannelServiceRouter;

