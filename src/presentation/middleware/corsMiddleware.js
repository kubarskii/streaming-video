// @ts-check
// Presentation: CORS Middleware

function corsMiddleware(req, res, next) {
    // Allow the requesting origin (or * if no origin)
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
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

