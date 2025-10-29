// @ts-check
/**
 * @fileoverview Infrastructure Layer - Validation Utilities
 * @module infrastructure/validation/validator
 * @description Enterprise-grade validation utilities following DDD principles.
 * This module is part of the Infrastructure layer and provides:
 * - Input validation and sanitization
 * - Error formatting for API responses
 * - Type-safe validation helpers
 * 
 * @remarks
 * DDD Layer: Infrastructure
 * Purpose: Validate data format and structure before domain processing
 * Does NOT enforce business rules (that's the domain layer's responsibility)
 */

const { ZodError } = require('zod');

/**
 * Format Zod validation errors into a user-friendly structure
 * @function formatValidationErrors
 * @param {ZodError} error - Zod validation error object
 * @returns {{error: string, details: Object.<string, string[]>, fields: string[]}} Formatted error response
 * @description Transforms Zod's technical validation errors into a client-friendly format
 * with field-specific error messages. Note: ZodError uses 'issues' property, not 'errors'.
 * @example
 * // Input: ZodError with multiple field errors
 * // Output:
 * {
 *   error: 'Validation failed',
 *   details: {
 *     email: ['Invalid email address'],
 *     password: ['Password must contain at least one uppercase letter']
 *   },
 *   fields: ['email', 'password']
 * }
 */
function formatValidationErrors(error) {
    /** @type {Object.<string, string[]>} */
    const errors = {};
    
    // Check if error has issues array (ZodError structure uses 'issues', not 'errors')
    if (!error || !error.issues || !Array.isArray(error.issues)) {
        return {
            error: 'Validation failed',
            details: { general: [error?.message || 'Unknown validation error'] },
            fields: ['general']
        };
    }
    
    error.issues.forEach((err) => {
        const path = err.path && err.path.length > 0 ? err.path.join('.') : 'general';
        const field = path;
        
        if (!errors[field]) {
            errors[field] = [];
        }
        
        errors[field].push(err.message || 'Validation error');
    });
    
    return {
        error: 'Validation failed',
        details: errors,
        fields: Object.keys(errors)
    };
}

/**
 * @typedef {Object} ValidationSuccess
 * @property {true} success
 * @property {any} data
 * 
 * @typedef {Object} ValidationError
 * @property {string} error
 * @property {Object.<string, string[]>} details
 * @property {string[]} fields
 * 
 * @typedef {Object} ValidationFailure
 * @property {false} success
 * @property {ValidationError} error
 * 
 * @typedef {ValidationSuccess | ValidationFailure} ValidationResult
 */

/**
 * Validate request body against a Zod schema
 * @function validateBody
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @param {any} data - Request body data to validate
 * @returns {ValidationResult} Validation result
 * @description Validates request body data and returns either validated data or formatted errors.
 * Part of the Infrastructure layer - validates structure before passing to Application layer.
 * @example
 * const result = validateBody(registerSchema, req.body);
 * if (result.success) {
 *   const user = await authService.register(result.data);
 * } else {
 *   return sendValidationError(res, result.error);
 * }
 */
function validateBody(schema, data) {
    try {
        const validatedData = schema.parse(data);
        return { success: true, data: validatedData };
    } catch (error) {
        if (error instanceof ZodError) {
            return { success: false, error: formatValidationErrors(error) };
        }
        return { success: false, error: { error: 'Validation failed', details: { general: [error.message] }, fields: ['general'] } };
    }
}

/**
 * Validate query parameters against a Zod schema
 * @function validateQuery
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @param {Object.<string, string|string[]>} query - Query parameters from URL (all strings)
 * @returns {ValidationResult} Validation result
 * @description Validates and coerces query parameters. Handles type coercion for numbers.
 * @example
 * // URL: /api/videos?limit=50&offset=10
 * const result = validateQuery(paginationSchema, req.query);
 * // result.data = { limit: 50, offset: 10 } (numbers, not strings)
 */
function validateQuery(schema, query) {
    try {
        const validatedQuery = schema.parse(query);
        return { success: true, data: validatedQuery };
    } catch (error) {
        if (error instanceof ZodError) {
            return { success: false, error: formatValidationErrors(error) };
        }
        return { success: false, error: { error: 'Validation failed', details: { general: [error.message] }, fields: ['general'] } };
    }
}

/**
 * Validate URL path parameters against a Zod schema
 * @function validateParams
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @param {Object.<string, string>} params - Path parameters (e.g., {id: "123"})
 * @returns {ValidationResult} Validation result
 * @description Validates path parameters like :id, :videoId, etc.
 * Commonly used to validate UUIDs and other path segments.
 * @example
 * // Route: /api/videos/:id
 * const result = validateParams(z.object({ id: uuidSchema }), { id: videoId });
 * if (!result.success) {
 *   return sendValidationError(res, result.error, 400);
 * }
 */
function validateParams(schema, params) {
    try {
        const validatedParams = schema.parse(params);
        return { success: true, data: validatedParams };
    } catch (error) {
        if (error instanceof ZodError) {
            return { success: false, error: formatValidationErrors(error) };
        }
        return { success: false, error: { error: 'Validation failed', details: { general: [error.message] }, fields: ['general'] } };
    }
}

/**
 * Validate uploaded files against custom rules
 * @function validateFiles
 * @param {Object.<string, Array<{size: number, mimetype: string}>>} files - Files from formidable
 * @param {{required?: string[], maxSize?: number, minSize?: number, allowedTypes?: string[]}} rules - Validation rules
 * @returns {{success: true} | {success: false, error: Object}} Validation result
 * @description Validates file uploads including size constraints and MIME types.
 * Useful for video/image uploads before processing.
 * @example
 * const result = validateFiles(files, {
 *   required: ['video'],
 *   maxSize: 5 * 1024 * 1024 * 1024, // 5GB
 *   allowedTypes: ['video/mp4', 'video/quicktime']
 * });
 */
function validateFiles(files, rules = {}) {
    const errors = {};

    // Check required files
    if (rules.required) {
        rules.required.forEach(fieldName => {
            if (!files[fieldName] || files[fieldName].length === 0) {
                errors[fieldName] = [`${fieldName} is required`];
            }
        });
    }

    // Validate each file
    Object.keys(files).forEach(fieldName => {
        const fileArray = files[fieldName];
        if (!fileArray || fileArray.length === 0) return;

        const file = fileArray[0]; // Take first file
        const fieldErrors = [];

        // Check file size
        if (rules.maxSize && file.size > rules.maxSize) {
            fieldErrors.push(`File size exceeds maximum of ${(rules.maxSize / (1024 * 1024)).toFixed(2)}MB`);
        }

        if (rules.minSize && file.size < rules.minSize) {
            fieldErrors.push(`File size is below minimum of ${(rules.minSize / (1024 * 1024)).toFixed(2)}MB`);
        }

        // Check MIME type
        if (rules.allowedTypes && !rules.allowedTypes.includes(file.mimetype)) {
            fieldErrors.push(`Invalid file type. Allowed: ${rules.allowedTypes.join(', ')}`);
        }

        if (fieldErrors.length > 0) {
            errors[fieldName] = fieldErrors;
        }
    });

    if (Object.keys(errors).length > 0) {
        return {
            success: false,
            error: {
                error: 'File validation failed',
                details: errors,
                fields: Object.keys(errors)
            }
        };
    }

    return { success: true };
}

/**
 * Send validation error response to client
 * @function sendValidationError
 * @param {import('http').ServerResponse} res - HTTP response object
 * @param {{error: string, details: Object, fields?: string[]}} error - Formatted validation error
 * @param {number} [statusCode=400] - HTTP status code (default: 400 Bad Request)
 * @returns {void}
 * @description Sends a standardized validation error response with appropriate headers.
 * Always use this function to ensure consistent error format across the API.
 * @example
 * if (!validation.success) {
 *   return sendValidationError(res, validation.error, 400);
 * }
 */
function sendValidationError(res, error, statusCode = 400) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(error));
}

/**
 * Parse and validate JSON body from HTTP request
 * @async
 * @function parseAndValidateBody
 * @param {import('http').IncomingMessage} req - HTTP request object
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @returns {Promise<any>} Parsed and validated request body
 * @throws {Error} If JSON is invalid or validation fails (error.validationError contains details)
 * @description Reads request body stream, parses JSON, and validates against schema.
 * Throws descriptive errors for JSON syntax errors and validation failures.
 * Use in controllers to parse and validate in one step.
 * @example
 * async register(req, res) {
 *   try {
 *     const validatedData = await parseAndValidateBody(req, registerSchema);
 *     // validatedData is type-safe and validated
 *   } catch (error) {
 *     if (error.validationError) {
 *       return sendValidationError(res, error.validationError);
 *     }
 *     // Handle other errors
 *   }
 * }
 */
async function parseAndValidateBody(req, schema) {
    let body = '';

    for await (const chunk of req) {
        body += chunk;
    }

    if (!body) {
        throw new Error('Request body is empty');
    }

    try {
        const parsed = JSON.parse(body);
        const result = validateBody(schema, parsed);
        
        if (result.success === false) {
            const error = /** @type {any} */ (new Error('Validation failed'));
            error.validationError = result.error;
            throw error;
        }

        return result.data;
    } catch (error) {
        const err = /** @type {any} */ (error);
        if (err.validationError) {
            throw error;
        }
        if (error instanceof SyntaxError) {
            const validationError = /** @type {any} */ (new Error('Invalid JSON in request body'));
            validationError.validationError = {
                error: 'Invalid JSON',
                details: { body: ['Request body must be valid JSON'] },
                fields: ['body']
            };
            throw validationError;
        }
        throw error;
    }
}

/**
 * Sanitize string input to prevent XSS attacks
 * @function sanitizeString
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string with HTML entities escaped
 * @description Escapes potentially dangerous HTML characters.
 * Note: This is a basic sanitizer. For rich text, use a dedicated library.
 * @example
 * sanitizeString('<script>alert("xss")</script>')
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 */
function sanitizeString(str) {
    if (typeof str !== 'string') return str;

    return str
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Recursively sanitize all string values in an object
 * @function sanitizeObject
 * @param {any} obj - Object, array, or primitive to sanitize
 * @returns {any} Deep copy with all strings sanitized
 * @description Traverses object structure and sanitizes all string values.
 * Handles nested objects and arrays. Non-string values are preserved.
 * @example
 * sanitizeObject({
 *   title: '<b>Video</b>',
 *   tags: ['<script>', 'safe'],
 *   metadata: { author: '<img>' }
 * })
 * // Returns sanitized version with HTML escaped
 */
function sanitizeObject(obj) {
    if (typeof obj === 'string') {
        return sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
    }

    if (obj !== null && typeof obj === 'object') {
        const sanitized = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                sanitized[key] = sanitizeObject(obj[key]);
            }
        }
        return sanitized;
    }

    return obj;
}

/**
 * @exports ValidationUtilities
 * @description Validation utilities for the Infrastructure layer
 * @namespace ValidationUtilities
 * @remarks
 * These utilities are part of the Infrastructure layer in DDD architecture.
 * They provide technical validation capabilities without business logic.
 * 
 * DDD Layer Responsibilities:
 * - Infrastructure: Data validation and sanitization (this module)
 * - Application: Use case orchestration
 * - Domain: Business rules and invariants
 * 
 * @example
 * // In a controller (Presentation layer):
 * const { parseAndValidateBody, sendValidationError } = require('../../infrastructure/validation/validator');
 * const { registerSchema } = require('../../infrastructure/validation/schemas');
 * 
 * async register(req, res) {
 *   try {
 *     const data = await parseAndValidateBody(req, registerSchema);
 *     // data is validated, now pass to Application layer
 *     const user = await authService.register(data);
 *     res.json({ user });
 *   } catch (error) {
 *     if (error.validationError) {
 *       return sendValidationError(res, error.validationError);
 *     }
 *     // Handle domain/application errors
 *   }
 * }
 */
module.exports = {
    formatValidationErrors,
    validateBody,
    validateQuery,
    validateParams,
    validateFiles,
    sendValidationError,
    parseAndValidateBody,
    sanitizeString,
    sanitizeObject
};

