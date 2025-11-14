// @ts-check
// Presentation: User Context Middleware
// Validates and extracts user context from gateway headers
// This middleware should only be used in microservices that receive requests from the gateway

const JWTService = require('../../infrastructure/auth/JWTService');

/**
 * Middleware to validate and extract user context from gateway headers
 * In a production environment, these headers should be signed/encrypted by the gateway
 * For now, we validate the format and optionally verify a signature if configured
 * 
 * @param {Object} [options] - Configuration options
 * @param {boolean} [options.requireAuth=false] - If true, reject requests without valid user context
 * @param {string} [options.gatewaySecret] - Secret to verify header signature (if implemented)
 * @returns {Function} Express-style middleware
 */
function userContextMiddleware(options = {}) {
    const { requireAuth = false, gatewaySecret = null } = options;
    const jwtService = gatewaySecret ? new JWTService() : null;

    return (req, res, next) => {
        const userId = req.headers['x-user-id'];
        const userEmail = req.headers['x-user-email'];
        const username = req.headers['x-user-username'];
        const userSignature = req.headers['x-user-signature']; // Future: signed header

        // If no user context provided
        if (!userId) {
            if (requireAuth) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({
                    success: false,
                    error: {
                        message: 'User context required',
                        code: 'MISSING_USER_CONTEXT'
                    }
                }));
            }
            // Not required, continue without user
            return next();
        }

        // Validate user ID format (should be UUID)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userId)) {
            if (requireAuth) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({
                    success: false,
                    error: {
                        message: 'Invalid user context format',
                        code: 'INVALID_USER_CONTEXT'
                    }
                }));
            }
            // Invalid format but not required - continue without user
            return next();
        }

        // Future: Verify signature if gateway secret is configured
        if (gatewaySecret && userSignature) {
            try {
                // TODO: Implement signature verification
                // const isValid = verifySignature(userId, userEmail, username, userSignature, gatewaySecret);
                // if (!isValid) {
                //     throw new Error('Invalid signature');
                // }
            } catch (error) {
                console.error('User context signature verification failed:', error);
                if (requireAuth) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({
                        success: false,
                        error: {
                            message: 'Invalid user context signature',
                            code: 'INVALID_SIGNATURE'
                        }
                    }));
                }
                // Signature invalid but not required - continue without user
                return next();
            }
        }

        // Set user context on request object
        req.user = {
            id: userId,
            userId: userId,
            email: userEmail || '',
            username: username || ''
        };

        next();
    };
}

module.exports = userContextMiddleware;

