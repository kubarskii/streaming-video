// @ts-check
// Infrastructure: DatabaseConfig
// Prisma client singleton

const { PrismaClient } = require('@prisma/client');

let prismaInstance = null;

class DatabaseConfig {
    static getPrismaClient() {
        if (!prismaInstance) {
            // Add connection pool parameters to DATABASE_URL if not present
            // This limits each service to 3-5 connections max
            let databaseUrl = process.env.DATABASE_URL;
            
            // Only add parameters if they're not already present
            if (databaseUrl && !databaseUrl.includes('connection_limit')) {
                const separator = databaseUrl.includes('?') ? '&' : '?';
                databaseUrl = `${databaseUrl}${separator}connection_limit=5&pool_timeout=10`;
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

