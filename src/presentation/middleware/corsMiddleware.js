// @ts-check
// Presentation: CORS Middleware

function corsMiddleware(req, res, next) {
    // Get allowed origins from environment variable
    const allowedOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
        : [];

    const origin = req.headers.origin;

    const rejectOrigin = () => {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            success: false,
            error: {
                code: 'CORS_ERROR',
                message: 'Origin not allowed'
            }
        }));
    };

    const isAllowedInProduction = () => allowedOrigins.length > 0 && allowedOrigins.includes(origin);
    const hasConfiguredOrigins = allowedOrigins.length > 0;

    if (origin) {
        if (hasConfiguredOrigins) {
            if (!isAllowedInProduction()) {
                return rejectOrigin();
            }
            res.setHeader('Access-Control-Allow-Origin', origin);
        } else {
            // No whitelist configured - allow the request and log a warning so uploads
            // aren't blocked by a missing ALLOWED_ORIGINS value.
            res.setHeader('Access-Control-Allow-Origin', origin);
            if (!corsMiddleware.hasLoggedMissingOriginsWarning && !hasConfiguredOrigins) {
                console.warn('[CORS] ALLOWED_ORIGINS not configured - allowing all origins by default');
                corsMiddleware.hasLoggedMissingOriginsWarning = true;
            }
        }
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
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

