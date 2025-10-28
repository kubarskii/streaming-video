// Presentation: Auth Middleware

function authMiddleware(authService) {
    return async (req, res, next) => {
        try {
            // Get token from Authorization header or cookie
            let token = null;

            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            } else if (req.headers.cookie) {
                const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
                    const [key, value] = cookie.trim().split('=');
                    acc[key] = value;
                    return acc;
                }, {});
                token = cookies.token;
            }

            if (token) {
                const user = await authService.getUserFromToken(token);
                if (user) {
                    req.user = user;
                }
            }

            next();
        } catch (error) {
            console.error('Auth middleware error:', error);
            next();
        }
    };
}

function requireAuth(req, res, next) {
    if (!req.user) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Authentication required' }));
    }
    next();
}

module.exports = { authMiddleware, requireAuth };

