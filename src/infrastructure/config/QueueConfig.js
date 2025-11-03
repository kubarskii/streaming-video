const Redis = require('ioredis');

/**
 * Queue Configuration
 * Manages Redis connection and queue settings
 */
class QueueConfig {
    constructor() {
        this.redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        this.connection = null;
    }

    /**
     * Get Redis connection instance
     * @returns {Redis} Redis connection
     */
    getConnection() {
        if (!this.connection) {
            // Parse Redis URL for connection options
            const connectionOptions = {
                maxRetriesPerRequest: null, // Required for BullMQ
                enableReadyCheck: false,
                retryStrategy(times) {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
            };

            // Handle both redis:// and rediss:// (SSL) URLs
            if (this.redisUrl.startsWith('rediss://')) {
                connectionOptions.tls = {
                    rejectUnauthorized: false, // For self-signed certs (Railway uses proper certs)
                };
            }

            this.connection = new Redis(this.redisUrl, connectionOptions);

            this.connection.on('error', (err) => {
                console.error('❌ Redis connection error:', err.message);
            });

            this.connection.on('connect', () => {
                console.log('✅ Redis connected');
            });

            this.connection.on('ready', () => {
                console.log('✅ Redis ready');
            });

            this.connection.on('close', () => {
                console.log('⚠️  Redis connection closed');
            });
        }

        return this.connection;
    }

    /**
     * Close Redis connection
     */
    async close() {
        if (this.connection) {
            await this.connection.quit();
            this.connection = null;
        }
    }

    /**
     * Get default job options for all queues
     * @returns {Object} Default job options
     */
    getDefaultJobOptions() {
        return {
            attempts: 3, // Retry failed jobs up to 3 times
            backoff: {
                type: 'exponential',
                delay: 5000, // Start with 5 seconds, then 10s, 20s, etc.
            },
            removeOnComplete: {
                age: 24 * 3600, // Keep completed jobs for 24 hours
                count: 1000, // Keep last 1000 completed jobs
            },
            removeOnFail: {
                age: 7 * 24 * 3600, // Keep failed jobs for 7 days
            },
        };
    }

    /**
     * Get queue names
     * @returns {Object} Queue names
     */
    static getQueueNames() {
        return {
            VIDEO_TRANSCODING: 'video-transcoding',
            THUMBNAIL_GENERATION: 'thumbnail-generation',
        };
    }
}

module.exports = QueueConfig;

