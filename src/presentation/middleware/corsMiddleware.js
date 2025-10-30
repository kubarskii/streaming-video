// @ts-check
// Presentation: CORS Middleware

function corsMiddleware(req, res, next) {
    const origin = req.headers.origin;

    // Get allowed origins from environment variable or use defaults for development
    const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || '';
    const allowedOrigins = allowedOriginsEnv
        ? allowedOriginsEnv.split(',').map(o => o.trim())
        : [];

    if (process.env.NODE_ENV === 'development') {
        // In development, allow all origins
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    } else if (origin && allowedOrigins.includes(origin)) {
        // In production, only allow configured origins
        res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    next();
}

module.exports = corsMiddleware;

