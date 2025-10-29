// @ts-check
/**
 * @fileoverview Presentation Layer - Authentication Controller
 * @module presentation/controllers/AuthController
 * @description Handles HTTP requests for user authentication.
 * Part of the Presentation layer in DDD architecture.
 * 
 * @remarks
 * DDD Responsibilities:
 * - Presentation: HTTP handling, validation, response formatting (this layer)
 * - Application: Business logic orchestration (AuthService)
 * - Domain: Business rules and entities (User, etc.)
 * - Infrastructure: Technical capabilities (validation, persistence)
 */

const { registerSchema, loginSchema } = require('../../infrastructure/validation/schemas');
const { parseAndValidateBody, sendValidationError } = require('../../infrastructure/validation/validator');

/**
 * Authentication controller
 * @class AuthController
 * @description Handles user registration, login, logout, and session management.
 * Validates inputs, calls application services, and formats responses.
 */
class AuthController {
    /**
     * Creates an instance of AuthController
     * @constructor
     * @param {import('../../application/services/AuthService')} authService - Authentication service from Application layer
     */
    constructor(authService) {
        this.authService = authService;
    }

    /**
     * Register a new user
     * @async
     * @method register
     * @param {import('http').IncomingMessage} req - HTTP request
     * @param {import('http').ServerResponse} res - HTTP response
     * @returns {Promise<void>}
     * @description 
     * POST /api/auth/register
     * 
     * Validates user registration data and creates a new user account.
     * Enforces enterprise-grade password requirements.
     * 
     * @example
     * // Request body:
     * {
     *   "email": "user@example.com",
     *   "username": "john_doe",
     *   "password": "SecureP@ss123"
     * }
     * 
     * // Success response (201):
     * {
     *   "message": "User registered successfully",
     *   "user": {
     *     "id": "uuid",
     *     "email": "user@example.com",
     *     "username": "john_doe"
     *   }
     * }
     * 
     * // Validation error (400):
     * {
     *   "error": "Validation failed",
     *   "details": {
     *     "password": ["Password must contain at least one uppercase letter"]
     *   }
     * }
     * 
     * // Business logic error (409):
     * {
     *   "error": "Email already exists"
     * }
     */
    async register(req, res) {
        try {
            // Infrastructure layer: Validate and parse request body
            const validatedData = await parseAndValidateBody(req, registerSchema);

            // Application layer: Execute registration use case
            const user = await this.authService.register({
                email: validatedData.email,
                username: validatedData.username,
                password: validatedData.password,
            });

            // Presentation layer: Format and send response
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                message: 'User registered successfully',
                user: user.toPublicObject(),
            }));
        } catch (error) {
            console.error('Registration error:', error);

            // Handle validation errors (Infrastructure layer)
            if (error.validationError) {
                return sendValidationError(res, error.validationError, 400);
            }

            // Handle business logic errors (Domain/Application layer)
            const statusCode = error.message.includes('already') ? 409 : 400;
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    /**
     * Authenticate user and create session
     * @async
     * @method login
     * @param {import('http').IncomingMessage} req - HTTP request
     * @param {import('http').ServerResponse} res - HTTP response
     * @returns {Promise<void>}
     * @description
     * POST /api/auth/login
     * 
     * Validates credentials and creates JWT session cookie.
     * Returns user data and auth token.
     * 
     * @example
     * // Request body:
     * {
     *   "email": "user@example.com",
     *   "password": "SecureP@ss123"
     * }
     * 
     * // Success response (200) + Set-Cookie header:
     * {
     *   "message": "Login successful",
     *   "user": { "id": "uuid", "email": "...", "username": "..." },
     *   "token": "jwt.token.here"
     * }
     * 
     * // Error response (401):
     * {
     *   "error": "Invalid credentials"
     * }
     */
    async login(req, res) {
        try {
            // Infrastructure layer: Validate and parse request body
            const validatedData = await parseAndValidateBody(req, loginSchema);

            // Application layer: Authenticate user
            const result = await this.authService.login({
                emailOrUsername: validatedData.emailOrUsername,
                password: validatedData.password,
            });

            // Presentation layer: Set secure cookie and send response
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Set-Cookie': `token=${result.token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`,
            });
            res.end(JSON.stringify({
                message: 'Login successful',
                user: result.user,
                token: result.token,
            }));
        } catch (error) {
            console.error('Login error:', error);

            // Handle validation errors (Infrastructure layer)
            if (error.validationError) {
                return sendValidationError(res, error.validationError, 400);
            }

            // Handle authentication errors (Application/Domain layer)
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    /**
     * Logout user and destroy session
     * @async
     * @method logout
     * @param {import('http').IncomingMessage} req - HTTP request
     * @param {import('http').ServerResponse} res - HTTP response
     * @returns {Promise<void>}
     * @description
     * POST /api/auth/logout
     * 
     * Clears the authentication cookie and invalidates the session.
     * No authentication required (idempotent operation).
     * 
     * @example
     * // Success response (200):
     * {
     *   "message": "Logged out successfully"
     * }
     */
    async logout(req, res) {
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Set-Cookie': 'token=; HttpOnly; Path=/; Max-Age=0',
        });
        res.end(JSON.stringify({ message: 'Logged out successfully' }));
    }

    /**
     * Get current authenticated user
     * @async
     * @method me
     * @param {import('http').IncomingMessage} req - HTTP request (with user attached by auth middleware)
     * @param {import('http').ServerResponse} res - HTTP response
     * @returns {Promise<void>}
     * @description
     * GET /api/auth/me
     * 
     * Returns the currently authenticated user's information.
     * Requires valid JWT token in cookie or Authorization header.
     * 
     * @example
     * // Success response (200):
     * {
     *   "user": {
     *     "id": "uuid",
     *     "email": "user@example.com",
     *     "username": "john_doe",
     *     "createdAt": "2025-01-01T00:00:00.000Z"
     *   }
     * }
     * 
     * // Error response (401):
     * {
     *   "error": "Not authenticated"
     * }
     */
    async me(req, res) {
        try {
            // @ts-ignore - user property added by auth middleware
            if (!req.user) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not authenticated' }));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            // @ts-ignore - user property added by auth middleware
            res.end(JSON.stringify({ user: req.user.toPublicObject() }));
        } catch (error) {
            console.error('Get me error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }

    parseJSON(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => (body += chunk.toString()));
            req.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (error) {
                    reject(new Error('Invalid JSON'));
                }
            });
            req.on('error', reject);
        });
    }
}

module.exports = AuthController;

