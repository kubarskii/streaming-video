// @ts-check
// Redis Cache Service
// Provides distributed caching for view tracking and other features

const { default: Redis } = require('ioredis');

/**
 * Redis-based cache service for distributed state management
 * Enables horizontal scaling across multiple server instances
 */
class RedisCache {
    constructor(redisUrl = null) {
        this.redisUrl = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
        this.client = null;
        this.isConnected = false;
    }

    /**
     * Initialize Redis connection
     */
    async connect() {
        if (this.client) {
            return;
        }

        const connectionOptions = {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            retryStrategy(times) {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            lazyConnect: true, // Don't connect immediately
        };

        // Handle SSL connections
        if (this.redisUrl.startsWith('rediss://')) {
            connectionOptions.tls = {
                rejectUnauthorized: false,
            };
        }

        this.client = new Redis(this.redisUrl, connectionOptions);

        this.client.on('error', (err) => {
            console.error('❌ Redis cache error:', err.message);
            this.isConnected = false;
        });

        this.client.on('connect', () => {
            console.log('✅ Redis cache connected');
            this.isConnected = true;
        });

        this.client.on('close', () => {
            console.log('⚠️  Redis cache connection closed');
            this.isConnected = false;
        });

        try {
            await this.client.connect();
        } catch (error) {
            console.error('❌ Failed to connect to Redis cache:', error.message);
            // Continue without Redis - degrade gracefully
        }
    }

    /**
     * Check if Redis is available
     */
    isAvailable() {
        return this.client && this.isConnected;
    }

    /**
     * Set a key with expiration (in seconds)
     */
    async set(key, value, expirySeconds = null) {
        if (!this.isAvailable()) {
            return false;
        }

        try {
            if (expirySeconds) {
                await this.client.set(key, value, 'EX', expirySeconds);
            } else {
                await this.client.set(key, value);
            }
            return true;
        } catch (error) {
            console.error(`Redis SET error for key ${key}:`, error.message);
            return false;
        }
    }

    /**
     * Get a key
     */
    async get(key) {
        if (!this.isAvailable()) {
            return null;
        }

        try {
            return await this.client.get(key);
        } catch (error) {
            console.error(`Redis GET error for key ${key}:`, error.message);
            return null;
        }
    }

    /**
     * Delete a key
     */
    async delete(key) {
        if (!this.isAvailable()) {
            return false;
        }

        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            console.error(`Redis DEL error for key ${key}:`, error.message);
            return false;
        }
    }

    /**
     * Check if key exists and set it with expiry if not (atomic operation)
     * Returns true if key was set (didn't exist), false if key already existed
     */
    async setNX(key, value, expirySeconds) {
        if (!this.isAvailable()) {
            return false;
        }

        try {
            const result = await this.client.set(key, value, 'EX', expirySeconds, 'NX');
            return result === 'OK';
        } catch (error) {
            console.error(`Redis SETNX error for key ${key}:`, error.message);
            return false;
        }
    }

    /**
     * Get time-to-live for a key (in seconds)
     */
    async ttl(key) {
        if (!this.isAvailable()) {
            return -2;
        }

        try {
            return await this.client.ttl(key);
        } catch (error) {
            console.error(`Redis TTL error for key ${key}:`, error.message);
            return -2;
        }
    }

    /**
     * Increment a counter
     */
    async increment(key, expiry = null) {
        if (!this.isAvailable()) {
            return null;
        }

        try {
            const value = await this.client.incr(key);
            if (expiry && value === 1) {
                // Set expiry only if this is the first increment
                await this.client.expire(key, expiry);
            }
            return value;
        } catch (error) {
            console.error(`Redis INCR error for key ${key}:`, error.message);
            return null;
        }
    }

    /**
     * Get multiple keys at once
     */
    async mget(keys) {
        if (!this.isAvailable() || !keys.length) {
            return [];
        }

        try {
            return await this.client.mget(...keys);
        } catch (error) {
            console.error('Redis MGET error:', error.message);
            return [];
        }
    }

    /**
     * Close connection
     */
    async disconnect() {
        if (this.client) {
            try {
                await this.client.quit();
                console.log('✅ Redis cache disconnected');
            } catch (error) {
                console.error('Error disconnecting Redis cache:', error.message);
            }
            this.client = null;
            this.isConnected = false;
        }
    }

    /**
     * View Tracking - Check if view should be counted for a video
     * Uses distributed cache to work across multiple server instances
     */
    async shouldCountView(videoId, userId = null, expirySeconds = 3600) {
        if (!this.isAvailable()) {
            // Fallback: always count if Redis unavailable (better than nothing)
            return true;
        }

        // Create a unique key based on video and optional user
        // If userId is provided, track per-user views
        // Otherwise, use a session-based approach (less accurate but works)
        const key = userId
            ? `view:${videoId}:user:${userId}`
            : `view:${videoId}:anon:${Date.now() % 100000}`; // Rough anonymous tracking

        try {
            // Try to set the key with expiry. Returns true if key didn't exist
            const wasSet = await this.setNX(key, '1', expirySeconds);
            return wasSet;
        } catch (error) {
            console.error(`Error checking view count for video ${videoId}:`, error.message);
            // On error, count the view (fail open)
            return true;
        }
    }
}

module.exports = RedisCache;

