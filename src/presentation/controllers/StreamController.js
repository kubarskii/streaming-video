// Presentation: StreamController
// Handles video streaming with Range request support

const fs = require('fs');
const path = require('path');

class StreamController {
    constructor(videoService, storageRepository) {
        this.videoService = videoService;
        this.storageRepository = storageRepository;
    }

    /**
     * Stream video file with Range support
     */
    async streamVideo(req, res, fileKey) {
        try {
            // Get video metadata from database by storage key
            const video = await this.videoService.getVideoByStorageKey(fileKey);

            if (!video) {
                // If not in database, try to serve as static file (for thumbnails)
                if (fileKey.startsWith('thumb_')) {
                    return await this.streamStaticFile(req, res, fileKey);
                }
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                return res.end('Video not found');
            }

            // For local storage, stream from filesystem
            if (this.storageRepository.getFilePath) {
                const filePath = this.storageRepository.getFilePath(video.storageKey);
                return this.streamLocalFile(req, res, filePath, video);
            }

            // For cloud storage (B2), redirect to CDN/storage URL
            const url = await this.storageRepository.getUrl(video.storageKey);
            res.writeHead(302, { 'Location': url });
            res.end();

        } catch (error) {
            console.error('Error streaming video:', error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal server error');
        }
    }

    /**
     * Stream static file (like thumbnails) without database lookup
     */
    async streamStaticFile(req, res, fileKey) {
        try {
            // For local storage, stream from filesystem
            if (this.storageRepository.getFilePath) {
                const filePath = this.storageRepository.getFilePath(fileKey);

                if (!fs.existsSync(filePath)) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    return res.end('File not found');
                }

                const stat = fs.statSync(filePath);
                const fileSize = stat.size;
                const ext = path.extname(filePath).toLowerCase();

                // Determine content type based on extension
                const contentTypes = {
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.gif': 'image/gif',
                    '.webp': 'image/webp',
                };
                const contentType = contentTypes[ext] || 'application/octet-stream';

                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Content-Length': fileSize,
                    'Cache-Control': 'public, max-age=31536000',
                });

                return fs.createReadStream(filePath).pipe(res);
            }

            // For cloud storage (B2), redirect to storage URL
            const url = await this.storageRepository.getUrl(fileKey);
            res.writeHead(302, { 'Location': url });
            res.end();

        } catch (error) {
            console.error('Error streaming static file:', error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal server error');
        }
    }

    /**
     * Stream file from local filesystem with Range support
     */
    streamLocalFile(req, res, filePath, video) {
        if (!fs.existsSync(filePath)) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('File not found');
        }

        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;
        const contentType = video.mimeType || 'video/mp4';

        if (!range) {
            // Serve entire file
            res.writeHead(200, {
                'Content-Type': contentType,
                'Content-Length': fileSize,
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=31536000',
            });
            return fs.createReadStream(filePath).pipe(res);
        }

        // Parse Range header
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match) {
            res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
            return res.end();
        }

        let start = match[1] ? parseInt(match[1], 10) : 0;
        let end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

        if (isNaN(start) || isNaN(end) || start >= fileSize) {
            res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
            return res.end();
        }

        if (end >= fileSize) end = fileSize - 1;

        const chunkSize = end - start + 1;

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000',
        });

        const stream = fs.createReadStream(filePath, { start, end });
        stream.pipe(res);
    }
}

module.exports = StreamController;

