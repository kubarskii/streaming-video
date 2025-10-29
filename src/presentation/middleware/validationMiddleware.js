// @ts-check
// Presentation: Validation Middleware
// Express-style middleware for request validation

const { validateQuery, sendValidationError } = require('../../infrastructure/validation/validator');

/**
 * Create middleware to validate query parameters
 * @param {any} schema - Zod schema for validation
 * @returns {Function} Middleware function
 */
function validateQueryParams(schema) {
    return (req, res, next) => {
        const result = validateQuery(schema, req.query || {});
        
        if (result.success === false) {
            sendValidationError(res, result.error);
            return;
        }
        
        // Attach validated data to request
        req.validatedQuery = result.data;
        next();
    };
}

/**
 * Validation middleware factory
 * Creates middleware for different validation scenarios
 */
const validationMiddleware = {
    /**
     * Validate query parameters
     */
    query: validateQueryParams
};

module.exports = validationMiddleware;

