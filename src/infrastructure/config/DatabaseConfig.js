// @ts-check
// Infrastructure: DatabaseConfig
// Prisma client singleton with configurable connection pooling

const { PrismaClient } = require('@prisma/client');

let prismaInstance = null;

// Default connection limits per service type
const DEFAULT_CONNECTION_LIMITS = {
    gateway: 3,
    upload: 5,
    streaming: 5,
    social: 5,
    channel: 3,
    playlist: 3,
    worker: 2,
    default: 5
};

class DatabaseConfig {
    /**
     * Get Prisma client with configurable connection pooling
     * @param {Object} [options] - Configuration options
     * @param {string} [options.serviceType] - Service type (gateway, upload, streaming, worker)
     * @param {number} [options.connectionLimit] - Override connection limit
     * @returns {PrismaClient} Prisma client instance
     */
    static getPrismaClient(options = {}) {
        if (!prismaInstance) {
            let databaseUrl = process.env.DATABASE_URL;
            
            // Determine connection limit
            let connectionLimit = options.connectionLimit;
            if (!connectionLimit) {
                const serviceType = options.serviceType || process.env.SERVICE_NAME || 'default';
                connectionLimit = DEFAULT_CONNECTION_LIMITS[serviceType] || DEFAULT_CONNECTION_LIMITS.default;
            }
            
            // Add connection pool parameters to DATABASE_URL if not present
            if (databaseUrl && !databaseUrl.includes('connection_limit')) {
                const separator = databaseUrl.includes('?') ? '&' : '?';
                databaseUrl = `${databaseUrl}${separator}connection_limit=${connectionLimit}&pool_timeout=10`;
            }
            
            prismaInstance = new PrismaClient({
                log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
                datasources: {
                    db: {
                        url: databaseUrl,
                    }
                },
            });
        }
        return prismaInstance;
    }

    static async disconnect() {
        if (prismaInstance) {
            await prismaInstance.$disconnect();
            prismaInstance = null;
        }
    }
}

module.exports = DatabaseConfig;

