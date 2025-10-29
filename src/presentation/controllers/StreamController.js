// @ts-check
// Presentation: StreamController
// Handles video streaming with Range request support

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

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

            // For cloud storage (B2), use authenticated streaming
            return this.streamFromB2(req, res, video.storageKey, video);

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
                    '.svg': 'image/svg+xml',
                };
                const contentType = contentTypes[ext] || 'application/octet-stream';

                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Content-Length': fileSize,
                    'Cache-Control': 'public, max-age=31536000',
                });

                return fs.createReadStream(filePath).pipe(res);
            }

            // For cloud storage (B2), use authenticated streaming
            return this.streamFromB2(req, res, fileKey, null);

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

    /**
     * Stream file from B2 with authentication and Range support
     */
    async streamFromB2(req, res, storageKey, video) {
        try {
            const range = req.headers.range;

            // Check if storage repository supports authenticated streaming
            if (!this.storageRepository.getObjectStream) {
                // Fallback to URL-based streaming for repositories that don't support it
                const url = await this.storageRepository.getUrl(storageKey);
                return this.streamFromUrl(req, res, url, video);
            }

            // Get authenticated stream from B2
            const result = await this.storageRepository.getObjectStream(storageKey, range);

            // Build response headers
            const responseHeaders = {
                'Content-Type': result.contentType || (video?.mimeType || 'video/mp4'),
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=31536000',
            };

            if (result.contentLength) {
                responseHeaders['Content-Length'] = result.contentLength;
            }

            if (result.contentRange) {
                responseHeaders['Content-Range'] = result.contentRange;
            }

            // Write response headers
            res.writeHead(result.statusCode, responseHeaders);

            // Pipe stream to client
            // AWS SDK v3 returns a readable stream that we can pipe directly
            if (result.stream && result.stream.pipe) {
                result.stream.pipe(res);
            } else {
                throw new Error('Unsupported stream type');
            }

            // Handle errors
            res.on('error', (error) => {
                console.error('Error streaming to client:', error);
            });

            req.on('close', () => {
                if (result.stream.destroy) {
                    result.stream.destroy();
                }
            });

        } catch (error) {
            console.error('Error streaming from B2:', error);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal server error');
            }
        }
    }

    /**
     * Stream file from URL (fallback for non-authenticated access)
     */
    async streamFromUrl(req, res, url, video) {
        try {
            const protocol = url.startsWith('https:') ? https : http;
            const range = req.headers.range;

            /** @type {Record<string, string>} */
            const upstreamHeaders = {};
            if (range) {
                upstreamHeaders['Range'] = range;
            }

            const upstreamReq = protocol.get(url, { headers: upstreamHeaders }, (upstreamRes) => {
                const statusCode = upstreamRes.statusCode;

                if (statusCode !== 200 && statusCode !== 206) {
                    console.error(`Storage returned status ${statusCode} for ${url}`);
                    res.writeHead(statusCode, { 'Content-Type': 'text/plain' });
                    return res.end(`Storage error: ${statusCode}`);
                }

                const responseHeaders = {
                    'Content-Type': upstreamRes.headers['content-type'] || (video?.mimeType || 'video/mp4'),
                    'Accept-Ranges': 'bytes',
                    'Cache-Control': 'public, max-age=31536000',
                };

                if (upstreamRes.headers['content-length']) {
                    responseHeaders['Content-Length'] = upstreamRes.headers['content-length'];
                }

                if (upstreamRes.headers['content-range']) {
                    responseHeaders['Content-Range'] = upstreamRes.headers['content-range'];
                }

                res.writeHead(statusCode, responseHeaders);
                upstreamRes.pipe(res);

                upstreamRes.on('error', (error) => {
                    console.error('Error streaming:', error);
                    if (!res.headersSent) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Stream error');
                    }
                });
            });

            upstreamReq.on('error', (error) => {
                console.error('Error connecting to storage:', error);
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Connection error');
                }
            });

            req.on('close', () => {
                upstreamReq.destroy();
            });

        } catch (error) {
            console.error('Error in streamFromUrl:', error);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal server error');
            }
        }
    }
}

module.exports = StreamController;

