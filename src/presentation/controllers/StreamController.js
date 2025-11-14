// @ts-check
// Presentation: StreamController
// Handles video streaming with Range request support

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class StreamController {
    /**
     * @param {*} videoService
     * @param {*} storageRepository
     * @param {*} incrementVideoViewsUseCase
     * @param {*} [videoQualityRepository]
     * @param {*} [redisCache] - Optional Redis cache for distributed view tracking
     */
    constructor(videoService, storageRepository, incrementVideoViewsUseCase, videoQualityRepository = null, redisCache = null) {
        this.videoService = videoService;
        this.storageRepository = storageRepository;
        this.incrementVideoViewsUseCase = incrementVideoViewsUseCase;
        this.videoQualityRepository = videoQualityRepository;
        this.redisCache = redisCache;

        // Fallback: In-memory tracking if Redis not available
        // Only used as backup - Redis is preferred for horizontal scaling
        this.viewedVideos = new Map();
        this.maxViewedVideosSize = 10000;
        this.viewExpiry = 60 * 60 * 1000; // 1 hour in milliseconds
        this.viewExpirySeconds = 3600; // 1 hour in seconds (for Redis)

        // Periodically cleanup in-memory cache (fallback only)
        this.cleanupInterval = setInterval(() => {
            if (!this.redisCache || !this.redisCache.isAvailable()) {
                this.cleanupOldViews();
            }
        }, 5 * 60 * 1000); // Check every 5 minutes

        if (this.redisCache) {
            console.log('✅ StreamController: Using Redis for distributed view tracking');
        } else {
            console.log('⚠️  StreamController: Using in-memory view tracking (not suitable for multiple instances)');
        }
    }

    /**
     * Remove expired view records (fallback for in-memory)
     */
    cleanupOldViews() {
        const now = Date.now();
        const expiredKeys = [];

        for (const [videoId, timestamp] of this.viewedVideos.entries()) {
            if (now - timestamp > this.viewExpiry) {
                expiredKeys.push(videoId);
            }
        }

        expiredKeys.forEach(key => this.viewedVideos.delete(key));

        if (expiredKeys.length > 0) {
            console.log(`🧹 Cleaned up ${expiredKeys.length} expired view records`);
        }

        // If still over limit, remove oldest entries (LRU)
        if (this.viewedVideos.size > this.maxViewedVideosSize) {
            const entriesToRemove = this.viewedVideos.size - this.maxViewedVideosSize;
            const sortedEntries = Array.from(this.viewedVideos.entries())
                .sort((a, b) => a[1] - b[1]);

            for (let i = 0; i < entriesToRemove; i++) {
                this.viewedVideos.delete(sortedEntries[i][0]);
            }

            console.log(`🧹 Removed ${entriesToRemove} oldest view records (size limit)`);
        }
    }

    /**
     * Check if video view should be counted
     * Uses Redis if available (distributed), falls back to in-memory
     * @param {string} videoId 
     * @param {string} [userId] - Optional user ID for per-user tracking
     * @returns {Promise<boolean>}
     */
    async shouldCountView(videoId, userId = null) {
        // Try Redis first (preferred for horizontal scaling)
        if (this.redisCache && this.redisCache.isAvailable()) {
            try {
                return await this.redisCache.shouldCountView(videoId, userId, this.viewExpirySeconds);
            } catch (error) {
                console.error('Redis view check failed, falling back to in-memory:', error.message);
                // Fall through to in-memory fallback
            }
        }

        // Fallback: In-memory tracking (single instance only)
        const lastViewed = this.viewedVideos.get(videoId);
        if (!lastViewed) {
            this.viewedVideos.set(videoId, Date.now());
            return true;
        }

        const now = Date.now();
        if (now - lastViewed > this.viewExpiry) {
            this.viewedVideos.set(videoId, now);
            return true;
        }

        return false;
    }

    /**
     * Cleanup resources (call on shutdown)
     */
    cleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.viewedVideos.clear();
    }

    /**
     * Stream video file with Range support
     * Supports two modes:
     * - redirect: Redirect to CDN/B2 URL (scalable, recommended for production)
     * - proxy: Stream through server (needed for private buckets/auth)
     */
    async streamVideo(req, res, fileKey) {
        try {
            // Log request method for debugging iOS seeking
            console.log(`[StreamController] ${req.method} request for: ${fileKey}`);

            // Check stream mode from environment (redirect = unlimited scale)
            const streamMode = process.env.STREAM_MODE || 'redirect'; // 'redirect' or 'proxy'

            // First, check if this is a quality variant
            let videoQuality = null;
            if (this.videoQualityRepository) {
                videoQuality = await this.videoQualityRepository.findByStorageKey(fileKey);
            }

            if (videoQuality) {
                // Streaming a quality variant - increment view count for the parent video
                const userId = req.user?.id || req.user?.userId || null;
                if (this.incrementVideoViewsUseCase && await this.shouldCountView(videoQuality.videoId, userId)) {
                    this.incrementVideoViewsUseCase.execute(videoQuality.videoId).catch(err => {
                        console.error('Failed to increment video views:', err);
                    });
                }

                // Always proxy HLS files to ensure CORS headers are present
                const ext = path.extname(videoQuality.storageKey || fileKey).toLowerCase();
                const isHLSFile = ext === '.m3u8' || ext === '.m3u' || ext === '.ts';

                // For CDN mode, redirect to direct URL (but never redirect HLS files)
                if (streamMode === 'redirect' && !isHLSFile && this.storageRepository.getUrl) {
                    return this.redirectToCDN(req, res, videoQuality.storageKey);
                }

                // Otherwise proxy through server (always for HLS files)
                return this.streamQualityVariant(req, res, videoQuality);
            }

            // Get video metadata from database by storage key
            let video = null;
            try {
                video = await this.videoService.getVideoByStorageKey(fileKey);
            } catch (lookupError) {
                console.error(`[StreamController] Error during lookup:`, lookupError);
            }

            if (!video) {
                // If not in database, try to serve as static file (for thumbnails)
                if (fileKey.startsWith('thumb_')) {
                    // For thumbnails, use CDN redirect if available
                    if (streamMode === 'redirect' && this.storageRepository.getUrl) {
                        return this.redirectToCDN(req, res, fileKey);
                    }
                    return await this.streamStaticFile(req, res, fileKey);
                }
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                return res.end('Video not found');
            }

            // Increment view count if this is the first time streaming this video or enough time has passed
            const userId = req.user?.id || req.user?.userId || null;
            if (this.incrementVideoViewsUseCase && await this.shouldCountView(video.id, userId)) {
                this.incrementVideoViewsUseCase.execute(video.id).catch(err => {
                    console.error('Failed to increment video views:', err);
                });
            }

            // For local storage, always stream from filesystem
            if (this.storageRepository.getFilePath) {
                const filePath = this.storageRepository.getFilePath(video.storageKey);
                if (filePath && require('fs').existsSync(filePath)) {
                    return this.streamLocalFile(req, res, filePath, video);
                }
            }

            // For cloud storage (B2/CDN)
            // Always proxy HLS files to ensure CORS headers are present
            const ext = path.extname(video.storageKey || fileKey).toLowerCase();
            const isHLSFile = ext === '.m3u8' || ext === '.m3u' || ext === '.ts';
            
            if (streamMode === 'redirect' && !isHLSFile) {
                // Redirect mode: offload to CDN (unlimited scale)
                // But never redirect HLS files - they need CORS headers
                return this.redirectToCDN(req, res, video.storageKey);
            } else {
                // Proxy mode: stream through server (for private buckets and HLS files)
                return this.streamFromB2(req, res, video.storageKey, video);
            }

        } catch (error) {
            console.error('Error streaming video:', error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal server error');
        }
    }

    /**
     * Redirect client directly to CDN/B2 URL
     * This offloads streaming to edge network for unlimited scalability
     */
    async redirectToCDN(req, res, storageKey) {
        try {
            const cdnUrl = await this.storageRepository.getUrl(storageKey);

            // 302 redirect to CDN (allows Range requests at CDN level)
            res.writeHead(302, {
                'Location': cdnUrl,
                'Cache-Control': 'public, max-age=300', // Cache redirect for 5 minutes
                'Access-Control-Allow-Origin': '*',
            });
            res.end();
        } catch (error) {
            console.error('Error getting CDN URL:', error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Failed to get video URL');
        }
    }

    /**
     * Stream a quality variant
     */
    async streamQualityVariant(req, res, quality) {
        const videoMetadata = {
            mimeType: 'video/mp4',
            storageKey: quality.storageKey
        };

        // For local storage, stream from filesystem
        if (this.storageRepository.getFilePath) {
            const filePath = this.storageRepository.getFilePath(quality.storageKey);
            if (filePath && require('fs').existsSync(filePath)) {
                return this.streamLocalFile(req, res, filePath, videoMetadata);
            }
        }

        // For cloud storage (B2), use authenticated streaming
        return this.streamFromB2(req, res, quality.storageKey, videoMetadata);
    }

    /**
     * Stream static file (like thumbnails) without database lookup
     */
    async streamStaticFile(req, res, fileKey) {
        try {
            // For local storage, stream from filesystem
            if (this.storageRepository.getFilePath) {
                const filePath = this.storageRepository.getFilePath(fileKey);

                if (filePath && fs.existsSync(filePath)) {
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
                        // HLS streaming formats
                        '.m3u8': 'application/vnd.apple.mpegurl',
                        '.ts': 'video/mp2t',
                        '.m3u': 'application/vnd.apple.mpegurl',
                    };
                    const contentType = contentTypes[ext] || 'application/octet-stream';

                    // HLS files need CORS headers and different cache settings
                    const headers = {
                        'Content-Type': contentType,
                        'Content-Length': fileSize,
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                        'Access-Control-Allow-Headers': 'Range',
                    };

                    // HLS playlists should have shorter cache, segments can be cached longer
                    if (ext === '.m3u8' || ext === '.m3u') {
                        headers['Cache-Control'] = 'public, max-age=0, must-revalidate'; // Playlists change
                    } else if (ext === '.ts') {
                        headers['Cache-Control'] = 'public, max-age=31536000'; // Segments are immutable
                    } else {
                        headers['Cache-Control'] = 'public, max-age=31536000';
                    }

                    // For HLS playlists, read and modify content to replace any B2 URLs
                    if (ext === '.m3u8' || ext === '.m3u') {
                        const playlistContent = fs.readFileSync(filePath, 'utf8');
                        const protocol = req.headers['x-forwarded-proto'] || (req.connection.encrypted ? 'https' : 'http');
                        const host = req.headers.host || 'localhost:3000';
                        
                        // Replace Backblaze B2 URLs with our proxy URLs
                        let modifiedContent = playlistContent.replace(
                            /https?:\/\/[^\/]+\/file\/[^\/]+\/([^\s\n]+)/g,
                            (match, storageKey) => {
                                // Use our streaming endpoint
                                return `${protocol}://${host}/video?file=${encodeURIComponent(storageKey)}`;
                            }
                        );

                        // Also handle relative paths in playlist
                        const lines = modifiedContent.split('\n');
                        
                        // Extract videoId from fileKey if it's in format "videoId_hls.m3u8" or "videoId_quality.m3u8"
                        let videoId = null;
                        const hlsMatch = fileKey.match(/^([^_]+)_hls\.m3u8$/);
                        if (hlsMatch) {
                            videoId = hlsMatch[1];
                        } else {
                            // Try to extract from other formats like "videoId_240p.m3u8"
                            const qualityMatch = fileKey.match(/^([^_]+)_[^_]+\.m3u8$/);
                            if (qualityMatch) {
                                videoId = qualityMatch[1];
                            }
                        }
                        
                        // Get the directory of the current playlist to resolve relative paths
                        const playlistDir = path.dirname(fileKey);
                        
                        const modifiedLines = lines.map(line => {
                            const trimmedLine = line.trim();
                            // If line is a segment path (ends with .ts or .m3u8) and is relative
                            if ((trimmedLine.endsWith('.ts') || trimmedLine.endsWith('.m3u8')) && 
                                !trimmedLine.startsWith('http') && 
                                !trimmedLine.startsWith('#') &&
                                trimmedLine.length > 0) {
                                // Remove ./ prefix if present
                                let segmentName = trimmedLine;
                                if (segmentName.startsWith('./')) {
                                    segmentName = segmentName.substring(2);
                                }
                                
                                // Construct storage key based on the playlist's fileKey
                                // For master playlist (videoId_hls.m3u8), quality playlists are stored as videoId_240p.m3u8
                                // For quality playlist (videoId_240p.m3u8), segments are in the same directory
                                let segmentKey;
                                
                                // If we have a videoId and this looks like a quality playlist name (e.g., "240p.m3u8")
                                if (videoId && segmentName.match(/^\d+p\.m3u8$/)) {
                                    // Master playlist referencing quality playlist: "240p.m3u8" -> "videoId_240p.m3u8"
                                    segmentKey = `${videoId}_${segmentName}`;
                                } else if (playlistDir && playlistDir !== '.') {
                                    // Quality playlist referencing segment: use directory structure
                                    segmentKey = `${playlistDir}/${segmentName}`;
                                } else {
                                    // Fallback: use segment name as-is
                                    segmentKey = segmentName;
                                }
                                
                                return `${protocol}://${host}/video?file=${encodeURIComponent(segmentKey)}`;
                            }
                            return line;
                        });

                        modifiedContent = modifiedLines.join('\n');

                        res.writeHead(200, {
                            ...headers,
                            'Content-Length': Buffer.byteLength(modifiedContent)
                        });
                        return res.end(modifiedContent);
                    }

                    res.writeHead(200, headers);

                    const stream = fs.createReadStream(filePath);

                    stream.on('error', (error) => {
                        console.error('Error reading static file:', error);
                        if (!res.headersSent) {
                            res.writeHead(500, { 'Content-Type': 'text/plain' });
                            res.end('Error reading file');
                        }
                    });

                    req.on('close', () => {
                        stream.destroy();
                    });

                    return stream.pipe(res);
                }
            }

            // For cloud storage (B2), use authenticated streaming
            console.log(`[StreamController] Static file not local, streaming from B2`);
            return this.streamFromB2(req, res, fileKey, null);

        } catch (error) {
            console.error('Error streaming static file:', error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal server error');
        }
    }

    /**
     * Stream file from local filesystem with Range support
     * iOS Safari requires HEAD request support for video seeking
     */
    streamLocalFile(req, res, filePath, video) {
        if (!fs.existsSync(filePath)) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('File not found');
        }

        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;
        
        // Determine content type - check file extension for HLS files
        const ext = path.extname(filePath).toLowerCase();
        let contentType = video?.mimeType || 'video/mp4';
        
        // Override for HLS files
        if (ext === '.m3u8' || ext === '.m3u') {
            contentType = 'application/vnd.apple.mpegurl';
        } else if (ext === '.ts') {
            contentType = 'video/mp2t';
        }

        // HLS files need CORS headers
        const baseHeaders = {
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Range',
        };

        // HLS playlists should have shorter cache, segments can be cached longer
        if (ext === '.m3u8' || ext === '.m3u') {
            baseHeaders['Cache-Control'] = 'public, max-age=0, must-revalidate';
        } else if (ext === '.ts') {
            baseHeaders['Cache-Control'] = 'public, max-age=31536000';
        } else {
            baseHeaders['Cache-Control'] = 'public, max-age=31536000';
        }

        // Handle HEAD requests - iOS Safari needs this for video seeking
        if (req.method === 'HEAD') {
            res.writeHead(200, {
                ...baseHeaders,
                'Content-Length': fileSize,
            });
            return res.end();
        }

        if (!range) {
            // For HLS playlists, read and modify content to replace any B2 URLs
            if (ext === '.m3u8' || ext === '.m3u') {
                const playlistContent = fs.readFileSync(filePath, 'utf8');
                const protocol = req.headers['x-forwarded-proto'] || (req.connection.encrypted ? 'https' : 'http');
                const host = req.headers.host || 'localhost:3000';
                
                // Replace Backblaze B2 URLs with our proxy URLs
                let modifiedContent = playlistContent.replace(
                    /https?:\/\/[^\/]+\/file\/[^\/]+\/([^\s\n]+)/g,
                    (match, storageKey) => {
                        // Use our streaming endpoint
                        return `${protocol}://${host}/video?file=${encodeURIComponent(storageKey)}`;
                    }
                );

                // Also handle relative paths in playlist
                const lines = modifiedContent.split('\n');
                const playlistDir = path.dirname(filePath);
                const modifiedLines = lines.map(line => {
                    const trimmedLine = line.trim();
                    // If line is a segment path (ends with .ts or .m3u8) and is relative
                    if ((trimmedLine.endsWith('.ts') || trimmedLine.endsWith('.m3u8')) && 
                        !trimmedLine.startsWith('http') && 
                        !trimmedLine.startsWith('#') &&
                        trimmedLine.length > 0) {
                        // Extract the segment filename
                        const segmentName = trimmedLine;
                        // Construct full path to segment
                        const segmentPath = path.join(playlistDir, segmentName);
                        // Get relative path from videos directory to construct storage key
                        // Assuming segments are in the same directory structure as playlist
                        const relativePath = path.relative(process.cwd(), segmentPath);
                        // Use the relative path as storage key (adjust based on your storage structure)
                        const segmentKey = relativePath.replace(/\\/g, '/'); // Normalize path separators
                        return `${protocol}://${host}/video?file=${encodeURIComponent(segmentKey)}`;
                    }
                    return line;
                });

                modifiedContent = modifiedLines.join('\n');

                res.writeHead(200, {
                    ...baseHeaders,
                    'Content-Length': Buffer.byteLength(modifiedContent)
                });
                return res.end(modifiedContent);
            }

            // Serve entire file
            res.writeHead(200, {
                ...baseHeaders,
                'Content-Length': fileSize,
            });

            const stream = fs.createReadStream(filePath);

            stream.on('error', (error) => {
                console.error('Error reading video file:', error);
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Error reading file');
                }
            });

            req.on('close', () => {
                stream.destroy();
            });

            return stream.pipe(res);
        }

        // Parse Range header
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match) {
            res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
            return res.end();
        }

        const start = match[1] ? parseInt(match[1], 10) : 0;
        let end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

        if (isNaN(start) || isNaN(end) || start >= fileSize) {
            res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
            return res.end();
        }

        if (end >= fileSize) end = fileSize - 1;

        const chunkSize = end - start + 1;

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            ...baseHeaders,
            'Content-Length': chunkSize,
        });

        const stream = fs.createReadStream(filePath, { start, end });

        stream.on('error', (error) => {
            console.error('Error reading video file (range):', error);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Error reading file');
            }
        });

        req.on('close', () => {
            stream.destroy();
        });

        stream.pipe(res);
    }

    /**
     * Stream file from B2 with authentication and Range support
     * iOS Safari requires HEAD request support for video seeking
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

            // Handle HEAD requests - iOS Safari needs this for video seeking
            if (req.method === 'HEAD') {
                const metadata = await this.storageRepository.getMetadata(storageKey);
                
                // Determine content type - check file extension for HLS files
                const ext = path.extname(storageKey).toLowerCase();
                let contentType = metadata.contentType || (video?.mimeType || 'video/mp4');
                
                // Override for HLS files
                if (ext === '.m3u8' || ext === '.m3u') {
                    contentType = 'application/vnd.apple.mpegurl';
                } else if (ext === '.ts') {
                    contentType = 'video/mp2t';
                }

                const headers = {
                    'Content-Type': contentType,
                    'Content-Length': metadata.size,
                    'Accept-Ranges': 'bytes',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                    'Access-Control-Allow-Headers': 'Range',
                };

                // HLS playlists should have shorter cache, segments can be cached longer
                if (ext === '.m3u8' || ext === '.m3u') {
                    headers['Cache-Control'] = 'public, max-age=0, must-revalidate';
                } else if (ext === '.ts') {
                    headers['Cache-Control'] = 'public, max-age=31536000';
                } else {
                    headers['Cache-Control'] = 'public, max-age=31536000';
                }

                res.writeHead(200, headers);
                return res.end();
            }

            // Get authenticated stream from B2
            const result = await this.storageRepository.getObjectStream(storageKey, range);

            // Determine content type - check file extension for HLS files
            const ext = path.extname(storageKey).toLowerCase();
            let contentType = result.contentType || (video?.mimeType || 'video/mp4');
            
            // Override for HLS files
            if (ext === '.m3u8' || ext === '.m3u') {
                contentType = 'application/vnd.apple.mpegurl';
            } else if (ext === '.ts') {
                contentType = 'video/mp2t';
            }

            // Build response headers
            const responseHeaders = {
                'Content-Type': contentType,
                'Accept-Ranges': 'bytes',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                'Access-Control-Allow-Headers': 'Range',
            };

            // HLS playlists should have shorter cache, segments can be cached longer
            if (ext === '.m3u8' || ext === '.m3u') {
                responseHeaders['Cache-Control'] = 'public, max-age=0, must-revalidate';
            } else if (ext === '.ts') {
                responseHeaders['Cache-Control'] = 'public, max-age=31536000';
            } else {
                responseHeaders['Cache-Control'] = 'public, max-age=31536000';
            }

            if (result.contentLength) {
                responseHeaders['Content-Length'] = result.contentLength;
            }

            if (result.contentRange) {
                responseHeaders['Content-Range'] = result.contentRange;
            }

            // Add CORS headers for ambient light canvas access
            responseHeaders['Access-Control-Allow-Origin'] = '*';
            responseHeaders['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS';
            responseHeaders['Access-Control-Allow-Headers'] = 'Range';

            // For HLS playlists, we need to modify the content to replace B2 URLs with our proxy URLs
            if ((ext === '.m3u8' || ext === '.m3u') && result.stream) {
                // Read the entire playlist content
                let playlistContent = '';
                result.stream.on('data', (chunk) => {
                    playlistContent += chunk.toString();
                });

                result.stream.on('end', () => {
                    // Replace Backblaze B2 URLs with our proxy URLs
                    let modifiedContent = playlistContent.replace(
                        /https?:\/\/[^\/]+\/file\/[^\/]+\/([^\s\n]+)/g,
                        (match, storageKey) => {
                            // Use our streaming endpoint
                            const protocol = req.headers['x-forwarded-proto'] || (req.connection.encrypted ? 'https' : 'http');
                            const host = req.headers.host || 'localhost:3000';
                            return `${protocol}://${host}/video?file=${encodeURIComponent(storageKey)}`;
                        }
                    );

                    // Also handle relative paths in playlist
                    const lines = modifiedContent.split('\n');
                    const protocol = req.headers['x-forwarded-proto'] || (req.connection.encrypted ? 'https' : 'http');
                    const host = req.headers.host || 'localhost:3000';
                    
                    // Extract videoId from storage key if it's in format "videoId_hls.m3u8" or "videoId_quality.m3u8"
                    // This helps resolve relative paths in master playlists
                    let videoId = null;
                    const hlsMatch = storageKey.match(/^([^_]+)_hls\.m3u8$/);
                    if (hlsMatch) {
                        videoId = hlsMatch[1];
                    } else {
                        // Try to extract from other formats like "videoId_240p.m3u8"
                        const qualityMatch = storageKey.match(/^([^_]+)_[^_]+\.m3u8$/);
                        if (qualityMatch) {
                            videoId = qualityMatch[1];
                        }
                    }
                    
                    // Get the directory of the current playlist to resolve relative paths
                    const playlistDir = path.dirname(storageKey);
                    
                    const modifiedLines = lines.map(line => {
                        const trimmedLine = line.trim();
                        // If line is a segment path (ends with .ts or .m3u8) and is relative
                        if ((trimmedLine.endsWith('.ts') || trimmedLine.endsWith('.m3u8')) && 
                            !trimmedLine.startsWith('http') && 
                            !trimmedLine.startsWith('#') &&
                            trimmedLine.length > 0) {
                            // Remove ./ prefix if present
                            let segmentName = trimmedLine;
                            if (segmentName.startsWith('./')) {
                                segmentName = segmentName.substring(2);
                            }
                            
                            // Construct storage key based on the playlist's storage key
                            // For master playlist (videoId_hls.m3u8), quality playlists are stored as videoId_240p.m3u8
                            // For quality playlist (videoId_240p.m3u8), segments are in the same directory
                            let segmentKey;
                            
                            // If we have a videoId and this looks like a quality playlist name (e.g., "240p.m3u8")
                            if (videoId && segmentName.match(/^\d+p\.m3u8$/)) {
                                // Master playlist referencing quality playlist: "240p.m3u8" -> "videoId_240p.m3u8"
                                segmentKey = `${videoId}_${segmentName}`;
                            } else if (playlistDir && playlistDir !== '.') {
                                // Quality playlist referencing segment: use directory structure
                                segmentKey = `${playlistDir}/${segmentName}`;
                            } else {
                                // Fallback: use segment name as-is
                                segmentKey = segmentName;
                            }
                            
                            return `${protocol}://${host}/video?file=${encodeURIComponent(segmentKey)}`;
                        }
                        return line;
                    });

                    const finalContent = modifiedLines.join('\n');

                    // Write headers and modified content
                    res.writeHead(result.statusCode, {
                        ...responseHeaders,
                        'Content-Length': Buffer.byteLength(finalContent)
                    });
                    res.end(finalContent);
                });

                result.stream.on('error', (error) => {
                    console.error('Error reading B2 playlist:', error);
                    if (!res.headersSent) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Error reading playlist');
                    }
                });
            } else {
                // For non-playlist files, pipe stream directly
                res.writeHead(result.statusCode, responseHeaders);

                if (result.stream && result.stream.pipe) {
                    // Handle stream errors
                    result.stream.on('error', (error) => {
                        console.error('Error in B2 stream:', error);
                        if (!res.headersSent) {
                            res.writeHead(500, { 'Content-Type': 'text/plain' });
                            res.end('Stream error');
                        } else if (res.destroy) {
                            res.destroy();
                        }
                    });

                    result.stream.pipe(res);
                } else {
                    throw new Error('Unsupported stream type');
                }
            }

            // Handle response errors
            res.on('error', (error) => {
                console.error('Error streaming to client:', error);
                if (result.stream && result.stream.destroy) {
                    result.stream.destroy();
                }
            });

            // Cleanup on client disconnect
            req.on('close', () => {
                if (result.stream && result.stream.destroy) {
                    result.stream.destroy();
                }
            });

        } catch (error) {
            console.error('Error streaming from B2:', error);

            // Provide more specific error messages based on error type
            if (!res.headersSent) {
                let statusCode = 500;
                let errorMessage = 'Internal server error';

                if (error.name === 'TimeoutError') {
                    statusCode = 504; // Gateway Timeout
                    errorMessage = 'Video streaming timeout - please try again';
                } else if (error.name === 'NetworkingError' || error.code === 'ENOTFOUND') {
                    statusCode = 503; // Service Unavailable
                    errorMessage = 'Storage service temporarily unavailable';
                } else if (error.message?.includes('NoSuchKey') || error.$metadata?.httpStatusCode === 404) {
                    statusCode = 404;
                    errorMessage = 'Video file not found in storage';
                }

                res.writeHead(statusCode, {
                    'Content-Type': 'text/plain',
                    'Retry-After': statusCode >= 500 ? '60' : undefined // Suggest retry after 60s for server errors
                });
                res.end(errorMessage);
            } else {
                // Headers already sent, just destroy the stream
                if (res.destroy) {
                    res.destroy();
                }
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

                // Add CORS headers for ambient light canvas access
                responseHeaders['Access-Control-Allow-Origin'] = '*';
                responseHeaders['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS';
                responseHeaders['Access-Control-Allow-Headers'] = 'Range';

                res.writeHead(statusCode, responseHeaders);
                upstreamRes.pipe(res);

                upstreamRes.on('error', (error) => {
                    console.error('Error streaming from URL:', error);
                    if (!res.headersSent) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Stream error');
                    } else if (res.destroy) {
                        res.destroy();
                    }
                    if (upstreamReq && !upstreamReq.destroyed) {
                        upstreamReq.destroy();
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

            // Cleanup on client disconnect
            req.on('close', () => {
                if (upstreamReq && !upstreamReq.destroyed) {
                    upstreamReq.destroy();
                }
            });

            // Cleanup on response error
            res.on('error', (error) => {
                console.error('Error in response stream:', error);
                if (upstreamReq && !upstreamReq.destroyed) {
                    upstreamReq.destroy();
                }
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

