// @ts-check
// Gateway Route Configuration
// Declarative routing configuration for API Gateway

/**
 * Route definition
 * @typedef {Object} Route
 * @property {string|RegExp} pattern - URL pattern to match (string for exact/startsWith, RegExp for regex)
 * @property {string[]} methods - HTTP methods to match (empty array = all methods)
 * @property {string} service - Target service: 'gateway', 'upload', 'streaming', 'social', 'channel', 'playlist'
 * @property {number} priority - Route priority (higher = checked first, specific routes should be higher)
 * @property {boolean} requiresAuth - Whether route requires authentication
 * @property {string} description - Route description for logging
 */

const routes = [
    // ============================================================
    // GATEWAY ROUTES (handled directly by gateway)
    // ============================================================
    {
        pattern: '/health',
        methods: ['GET'],
        service: 'gateway',
        priority: 1000,
        requiresAuth: false,
        description: 'Gateway health check'
    },
    {
        pattern: '/api/health',
        methods: ['GET'],
        service: 'gateway',
        priority: 1000,
        requiresAuth: false,
        description: 'Gateway health check (API)'
    },
    {
        pattern: '/health/quick',
        methods: ['GET'],
        service: 'gateway',
        priority: 1000,
        requiresAuth: false,
        description: 'Gateway quick health check'
    },
    {
        pattern: '/api/auth/register',
        methods: ['POST'],
        service: 'gateway',
        priority: 1000,
        requiresAuth: false,
        description: 'User registration'
    },
    {
        pattern: '/api/auth/login',
        methods: ['POST'],
        service: 'gateway',
        priority: 1000,
        requiresAuth: false,
        description: 'User login'
    },
    {
        pattern: '/api/auth/logout',
        methods: ['POST'],
        service: 'gateway',
        priority: 1000,
        requiresAuth: false,
        description: 'User logout'
    },
    {
        pattern: '/api/auth/me',
        methods: ['GET'],
        service: 'gateway',
        priority: 1000,
        requiresAuth: true,
        description: 'Get current user'
    },

    // ============================================================
    // STREAMING SERVICE ROUTES
    // ============================================================
    {
        pattern: '/video',
        methods: [],
        service: 'streaming',
        priority: 900,
        requiresAuth: false,
        description: 'Video streaming'
    },
    {
        pattern: /^\/api\/videos\/[^/]+\/qualities$/,
        methods: [],
        service: 'streaming',
        priority: 900,
        requiresAuth: false,
        description: 'Get video quality variants'
    },
    {
        pattern: /^\/api\/videos\/[^/]+\/views$/,
        methods: ['POST'],
        service: 'streaming',
        priority: 900,
        requiresAuth: false,
        description: 'Increment video views'
    },

    // ============================================================
    // SOCIAL SERVICE ROUTES (MUST come before catch-all /api/videos)
    // ============================================================
    {
        pattern: /^\/api\/videos\/[^/]+\/(like|likes)$/,
        methods: [],
        service: 'social',
        priority: 800,
        requiresAuth: false,
        description: 'Video likes (GET/POST/DELETE)'
    },
    {
        pattern: '/api/comments',
        methods: [],
        service: 'social',
        priority: 800,
        requiresAuth: false,
        description: 'Comments (GET/POST)'
    },
    {
        pattern: /^\/api\/comments\/[^/]+$/,
        methods: [],
        service: 'social',
        priority: 800,
        requiresAuth: false,
        description: 'Comment operations (GET/PUT/DELETE)'
    },
    {
        pattern: '/api/subscriptions',
        methods: [],
        service: 'social',
        priority: 800,
        requiresAuth: false,
        description: 'Subscriptions (GET/POST)'
    },
    {
        pattern: /^\/api\/subscriptions\/[^/]+/,
        methods: [],
        service: 'social',
        priority: 800,
        requiresAuth: false,
        description: 'Subscription operations (DELETE/GET)'
    },

    // ============================================================
    // UPLOAD SERVICE ROUTES
    // ============================================================
    {
        pattern: '/api/upload/',
        methods: [],
        service: 'upload',
        priority: 700,
        requiresAuth: false,
        description: 'File upload'
    },
    {
        pattern: '/api/queues',
        methods: [],
        service: 'upload',
        priority: 700,
        requiresAuth: false,
        description: 'Queue management'
    },
    {
        pattern: /^\/api\/videos$/,
        methods: ['GET', 'POST'],
        service: 'upload',
        priority: 600,
        requiresAuth: false,
        description: 'Video CRUD (list/create)'
    },
    {
        pattern: /^\/api\/videos\/[^/]+$/,
        methods: ['GET', 'PUT', 'DELETE', 'PATCH'],
        service: 'upload',
        priority: 600,
        requiresAuth: false,
        description: 'Video CRUD (get/update/delete)'
    },
    {
        pattern: /^\/api\/videos\/[^/]+\/.*$/,
        methods: [],
        service: 'upload',
        priority: 500,
        requiresAuth: false,
        description: 'Video operations (catch-all for /api/videos)'
    },

    // ============================================================
    // CHANNEL SERVICE ROUTES
    // ============================================================
    {
        pattern: '/api/channels',
        methods: [],
        service: 'channel',
        priority: 700,
        requiresAuth: false,
        description: 'Channel operations'
    },

    // ============================================================
    // PLAYLIST SERVICE ROUTES
    // ============================================================
    {
        pattern: '/api/playlists',
        methods: [],
        service: 'playlist',
        priority: 700,
        requiresAuth: false,
        description: 'Playlist operations'
    },
];

/**
 * Match a route against a pathname and method
 * @param {string} pathname - Request pathname
 * @param {string} method - HTTP method
 * @returns {Route|null} Matching route or null
 */
function matchRoute(pathname, method) {
    // Sort routes by priority (higher priority first)
    const sortedRoutes = [...routes].sort((a, b) => b.priority - a.priority);

    for (const route of sortedRoutes) {
        // Check method match
        if (route.methods.length > 0 && !route.methods.includes(method)) {
            continue;
        }

        // Check pattern match
        let matches = false;
        if (route.pattern instanceof RegExp) {
            matches = route.pattern.test(pathname);
        } else if (typeof route.pattern === 'string') {
            // Exact match or startsWith for strings ending with /
            if (route.pattern.endsWith('/')) {
                matches = pathname.startsWith(route.pattern);
            } else {
                matches = pathname === route.pattern || pathname.startsWith(route.pattern + '/');
            }
        }

        if (matches) {
            return route;
        }
    }

    return null;
}

module.exports = {
    routes,
    matchRoute
};

