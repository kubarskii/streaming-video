// @ts-check
// Presentation: CORS Middleware

function corsMiddleware(req, res, next) {
    // Get allowed origins from environment variable
    const allowedOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
        : [];

    const origin = req.headers.origin;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range, X-User-Id, X-User-Email, X-User-Username');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');

    // Handle preflight (OPTIONS and HEAD)
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    next();
}

module.exports = corsMiddleware;

