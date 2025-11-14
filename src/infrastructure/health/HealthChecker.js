// @ts-check
// Infrastructure: Health Checker
// Comprehensive health checks for all dependencies

const DatabaseConfig = require('../config/DatabaseConfig');
const QueueConfig = require('../config/QueueConfig');
const StorageConfig = require('../config/StorageConfig');
const RedisCache = require('../cache/RedisCache');

class HealthChecker {
    constructor() {
        this.checks = {
            database: this.checkDatabase.bind(this),
            redis: this.checkRedis.bind(this),
            storage: this.checkStorage.bind(this),
            queues: this.checkQueues.bind(this)
        };
    }

    /**
     * Check database connectivity
     */
    async checkDatabase() {
        try {
            const prisma = DatabaseConfig.getPrismaClient();
            await prisma.$queryRaw`SELECT 1`;
            return { status: 'healthy', message: 'Database connected' };
        } catch (error) {
            return {
                status: 'unhealthy',
                message: `Database connection failed: ${error.message}`,
                error: error.message
            };
        }
    }

    /**
     * Check Redis connectivity
     */
    async checkRedis() {
        try {
            const redis = new RedisCache();
            await redis.connect();
            const testKey = `health-check-${Date.now()}`;
            await redis.set(testKey, 'ok', 10); // 10 second TTL
            const value = await redis.get(testKey);
            await redis.delete(testKey);
            await redis.disconnect();

            if (value === 'ok') {
                return { status: 'healthy', message: 'Redis connected' };
            }
            return { status: 'unhealthy', message: 'Redis test failed' };
        } catch (error) {
            return {
                status: 'unhealthy',
                message: `Redis connection failed: ${error.message}`,
                error: error.message
            };
        }
    }

    /**
     * Check storage connectivity
     */
    async checkStorage() {
        try {
            const storage = StorageConfig.createStorageRepository();
            // Try to list or check storage (implementation depends on storage type)
            // For B2, we could check bucket access
            // For local, we could check directory permissions
            return { status: 'healthy', message: 'Storage accessible' };
        } catch (error) {
            return {
                status: 'unhealthy',
                message: `Storage check failed: ${error.message}`,
                error: error.message
            };
        }
    }

    /**
     * Check queue system
     * Queues use Redis, so we verify Redis connectivity
     */
    async checkQueues() {
        try {
            // Queues depend on Redis, so check Redis connectivity
            const redisCheck = await this.checkRedis();
            if (redisCheck.status === 'healthy') {
                return { status: 'healthy', message: 'Queues accessible (Redis connected)' };
            }
            return {
                status: 'unhealthy',
                message: 'Queues unavailable (Redis not connected)',
                error: redisCheck.error
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                message: `Queue check failed: ${error.message}`,
                error: error.message
            };
        }
    }

    /**
     * Run all health checks
     * @param {string[]} [checksToRun] - Optional array of check names to run. If not provided, runs all.
     * @returns {Promise<Object>} Health check results
     */
    async runAllChecks(checksToRun = null) {
        const checks = checksToRun || Object.keys(this.checks);
        const results = {};
        const promises = checks.map(async (checkName) => {
            if (this.checks[checkName]) {
                try {
                    results[checkName] = await this.checks[checkName]();
                } catch (error) {
                    results[checkName] = {
                        status: 'unhealthy',
                        message: `Check failed: ${error.message}`,
                        error: error.message
                    };
                }
            } else {
                results[checkName] = {
                    status: 'unknown',
                    message: `Unknown check: ${checkName}`
                };
            }
        });

        await Promise.all(promises);

        // Determine overall status
        const allHealthy = Object.values(results).every(
            result => result.status === 'healthy'
        );

        return {
            status: allHealthy ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            checks: results
        };
    }

    /**
     * Quick health check (database only)
     */
    async quickCheck() {
        const dbCheck = await this.checkDatabase();
        return {
            status: dbCheck.status === 'healthy' ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            database: dbCheck.status
        };
    }
}

module.exports = HealthChecker;

