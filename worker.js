/**
 * Worker Process
 * Runs background jobs for video processing
 * 
 * Usage:
 *   node worker.js
 * 
 * Environment Variables:
 *   REDIS_URL - Redis connection URL (default: redis://localhost:6379)
 *   DATABASE_URL - PostgreSQL connection URL
 *   All other environment variables from .env
 */

require('dotenv').config();
const WorkerManager = require('./src/infrastructure/queue/workers/WorkerManager');
const DatabaseConfig = require('./src/infrastructure/config/DatabaseConfig');

// Import repositories
const PrismaVideoRepository = require('./src/infrastructure/persistence/PrismaVideoRepository');
const PrismaVideoQualityRepository = require('./src/infrastructure/persistence/PrismaVideoQualityRepository');
const StorageConfig = require('./src/infrastructure/config/StorageConfig');
const VideoTranscoder = require('./src/infrastructure/media/VideoTranscoder');

async function main() {
    console.log('🎬 Video Processing Worker');
    console.log('==========================\n');

    // Check required environment variables
    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL is required');
        process.exit(1);
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    console.log(`📦 Redis URL: ${redisUrl}`);
    console.log(`📦 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
    console.log(`📦 Storage Mode: ${process.env.STORAGE_MODE || 'local'}\n`);

    // Use singleton Prisma client to avoid connection pool exhaustion
    const prisma = DatabaseConfig.getPrismaClient();

    try {
        // Test database connection
        await prisma.$connect();
        console.log('✅ Database connected\n');
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        process.exit(1);
    }

    // Initialize repositories
    const videoRepository = new PrismaVideoRepository(prisma);
    const videoQualityRepository = new PrismaVideoQualityRepository(prisma);

    // Initialize storage
    const storageRepository = StorageConfig.createStorageRepository();

    // Initialize video transcoder
    const videoTranscoder = new VideoTranscoder();

    // Create worker manager
    const workerManager = new WorkerManager({
        videoRepository,
        videoQualityRepository,
        storageRepository,
        videoTranscoder,
    });

    // Start all workers
    await workerManager.startAll();

    console.log('\n✅ Worker is running. Press Ctrl+C to stop.\n');
    console.log('📊 Worker Status:');
    console.log(workerManager.getStatus());
    console.log('');
}

// Start the worker
main().catch((error) => {
    console.error('❌ Worker failed to start:', error);
    process.exit(1);
});

