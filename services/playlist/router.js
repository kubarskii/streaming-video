// @ts-check
// Playlist Service Router
// Handles playlist management
// Authentication is handled by Gateway

const { URL } = require('url');

class PlaylistServiceRouter {
    constructor(playlistController) {
        this.playlistController = playlistController;
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
        // PLAYLIST ROUTES
        // ============================================================

        if (pathname === '/api/playlists' && req.method === 'GET') {
            await this.playlistController.listPlaylists(req, res, queryParams);
            return true;
        }

        if (pathname === '/api/playlists' && req.method === 'POST') {
            await this.playlistController.createPlaylist(req, res);
            return true;
        }

        if (pathname.match(/^\/api\/playlists\/slug\/[^/]+$/) && req.method === 'GET') {
            const slug = decodeURIComponent(pathname.split('/')[4]);
            await this.playlistController.getPlaylistBySlug(req, res, slug);
            return true;
        }

        if (pathname.match(/^\/api\/playlists\/[^/]+$/) && req.method === 'GET') {
            const playlistId = pathname.split('/')[3];
            await this.playlistController.getPlaylist(req, res, playlistId);
            return true;
        }

        if (pathname.match(/^\/api\/playlists\/[^/]+$/) && req.method === 'PATCH') {
            const playlistId = pathname.split('/')[3];
            await this.playlistController.updatePlaylist(req, res, playlistId);
            return true;
        }

        if (pathname.match(/^\/api\/playlists\/[^/]+$/) && req.method === 'DELETE') {
            const playlistId = pathname.split('/')[3];
            await this.playlistController.deletePlaylist(req, res, playlistId);
            return true;
        }

        if (pathname.match(/^\/api\/playlists\/[^/]+\/videos$/) && req.method === 'POST') {
            const playlistId = pathname.split('/')[3];
            await this.playlistController.addVideoToPlaylist(req, res, playlistId);
            return true;
        }

        if (pathname.match(/^\/api\/playlists\/[^/]+\/videos\/[^/]+$/) && req.method === 'DELETE') {
            const [, , , playlistId, , videoId] = pathname.split('/');
            await this.playlistController.removeVideoFromPlaylist(req, res, playlistId, videoId);
            return true;
        }

        if (pathname.match(/^\/api\/playlists\/[^/]+\/videos\/reorder$/) && (req.method === 'POST' || req.method === 'PATCH')) {
            const playlistId = pathname.split('/')[3];
            await this.playlistController.reorderPlaylist(req, res, playlistId);
            return true;
        }

        // Not found
        return false;
    }
}

module.exports = PlaylistServiceRouter;

