// Infrastructure: DatabaseConfig
// Prisma client singleton

const { PrismaClient } = require('@prisma/client');

let prismaInstance = null;

class DatabaseConfig {
    static getPrismaClient() {
        if (!prismaInstance) {
            prismaInstance = new PrismaClient({
                log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
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

