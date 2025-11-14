// @ts-check
// Presentation: CORS Middleware

function corsMiddleware(req, res, next) {
    // Get allowed origins from environment variable
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
        : [];
    
    const origin = req.headers.origin;
    
    // In development, allow all origins if ALLOWED_ORIGINS is not set
    // In production, only allow specified origins
    if (process.env.NODE_ENV === 'development' && allowedOrigins.length === 0) {
        // Development: allow any origin
        if (origin) {
            res.setHeader('Access-Control-Allow-Origin', origin);
        } else {
            res.setHeader('Access-Control-Allow-Origin', '*');
        }
    } else {
        // Production: only allow specified origins
        if (origin && allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
        } else if (allowedOrigins.length === 0) {
            // Fallback: if no origins configured, allow none (most secure)
            // This prevents accidental exposure in production
            if (origin) {
                // Origin provided but not allowed - reject
                res.writeHead(403, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ 
                    success: false,
                    error: { 
                        message: 'Origin not allowed',
                        code: 'CORS_ERROR'
                    }
                }));
            }
        }
    }
    
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

