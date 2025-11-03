// @ts-check
// Error Handling Middleware
// Wraps controller methods to catch and handle errors consistently

/**
 * Wraps an async handler to catch errors and send proper error responses
 * @param {Function} handler - The async controller method
 * @returns {Function} Wrapped handler with error handling
 */
function errorHandler(handler) {
    return async (req, res, ...args) => {
        try {
            await handler(req, res, ...args);
        } catch (error) {
            console.error(`[${req.method}] ${req.url}:`, error);

            // Determine status code
            const statusCode = error.statusCode || error.status || 500;

            // Determine error message
            const message = statusCode < 500 ? error.message : 'Internal server error';

            // Build error response
            const errorResponse = {
                success: false,
                error: {
                    message,
                    code: error.code || 'INTERNAL_ERROR',
                }
            };

            // Add stack trace in development
            if (process.env.NODE_ENV === 'development') {
                errorResponse.error.stack = error.stack;
            }

            // Send error response
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(errorResponse));
        }
    };
}

module.exports = { errorHandler };


