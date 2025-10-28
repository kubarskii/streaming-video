// server.js
// Node.js video streaming demo (no external deps)
// Supports Range requests and seeking from exact positions

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const HOST = '127.0.0.1';
const PORT = 3000;

const PUBLIC_DIR = path.join(__dirname, 'public');
const VIDEO_DIR = path.join(__dirname, 'videos');

const MIME = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.m4v': 'video/x-m4v'
};

// Helper to prevent path traversal
function safeJoin(base, target) {
    const resolved = path.resolve(path.join(base, target));
    return resolved.startsWith(base + path.sep) ? resolved : null;
}

function serveFile(res, filePath, contentType = 'text/plain') {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('404 Not Found');
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

// Serve video stream with Range support
function serveVideo(req, res, urlObj) {
    const fileName = urlObj.searchParams.get('file');
    if (!fileName) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        return res.end('Missing ?file parameter');
    }

    const filePath = safeJoin(VIDEO_DIR, fileName);
    if (!filePath) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        return res.end('Invalid file path');
    }

    fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('File not found');
        }

        const fileSize = stat.size;
        const range = req.headers.range;
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME[ext] || 'application/octet-stream';

        if (!range) {
            // Serve entire file
            res.writeHead(200, {
                'Content-Type': contentType,
                'Content-Length': fileSize,
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'no-store'
            });
            return fs.createReadStream(filePath).pipe(res);
        }

        // Parse Range header, e.g. "bytes=1000-"
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
            'Cache-Control': 'no-store'
        });

        const stream = fs.createReadStream(filePath, { start, end });
        stream.pipe(res);
    });
}

const server = http.createServer((req, res) => {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);

    if (urlObj.pathname === '/') {
        return serveFile(res, path.join(PUBLIC_DIR, 'index.html'), 'text/html');
    }

    if (urlObj.pathname === '/video') {
        return serveVideo(req, res, urlObj);
    }

    // Serve static files from public/
    const safePath = safeJoin(PUBLIC_DIR, urlObj.pathname.replace(/^\/+/, ''));
    if (safePath && fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
        const ext = path.extname(safePath).toLowerCase();
        const contentType = MIME[ext] || 'text/plain';
        return serveFile(res, safePath, contentType);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
});

server.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
    console.log(`Videos directory: ${VIDEO_DIR}`);
});
