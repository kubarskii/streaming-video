const TranscodingWorker = require('./TranscodingWorker');
const ThumbnailWorker = require('./ThumbnailWorker');
const ConversionWorker = require('./ConversionWorker');

/**
 * Manages all workers
 */
class WorkerManager {
    constructor(repositories) {
        this.repositories = repositories;
        this.workers = [];
        this.isShuttingDown = false;
    }

    /**
     * Start all workers
     */
    async startAll() {
        console.log('🚀 Starting all workers...');

        // Create and start transcoding worker
        const transcodingWorker = new TranscodingWorker(
            this.repositories.videoRepository,
            this.repositories.videoQualityRepository,
            this.repositories.storageRepository,
            this.repositories.videoTranscoder
        );
        transcodingWorker.start();
        this.workers.push(transcodingWorker);

        // Create and start thumbnail worker
        const thumbnailWorker = new ThumbnailWorker(
            this.repositories.videoRepository,
            this.repositories.storageRepository
        );
        thumbnailWorker.start();
        this.workers.push(thumbnailWorker);

        // Create and start MOV conversion worker
        const conversionWorker = new ConversionWorker(
            this.repositories.videoRepository,
            this.repositories.storageRepository,
            this.repositories.videoTranscoder
        );
        conversionWorker.start();
        this.workers.push(conversionWorker);

        console.log(`✅ All workers started (${this.workers.length} workers)`);

        // Set up graceful shutdown handlers
        this.setupGracefulShutdown();
    }

    /**
     * Setup graceful shutdown handlers
     */
    setupGracefulShutdown() {
        const shutdownHandler = async (signal) => {
            if (this.isShuttingDown) {
                console.log('⚠️  Already shutting down, please wait...');
                return;
            }

            this.isShuttingDown = true;
            console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);

            try {
                await this.stopAll();
                console.log('✅ Graceful shutdown complete');
                process.exit(0);
            } catch (error) {
                console.error('❌ Error during shutdown:', error);
                process.exit(1);
            }
        };

        // Handle various shutdown signals
        process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
        process.on('SIGINT', () => shutdownHandler('SIGINT'));

        // Handle uncaught errors - log but don't shut down workers
        process.on('uncaughtException', (error) => {
            console.error('❌ Uncaught exception in worker:', error);
            console.error('Stack:', error.stack);
            console.log('⚠️  Workers will continue running...');
            // Don't shut down - workers should continue processing jobs
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('❌ Unhandled rejection in worker at:', promise, 'reason:', reason);
            console.log('⚠️  Workers will continue running...');
            // Don't shut down - workers should continue processing jobs
        });
    }

    /**
     * Stop all workers gracefully
     */
    async stopAll() {
        console.log('🔄 Stopping all workers...');

        const stopPromises = this.workers.map(worker =>
            worker.stop().catch(err => {
                console.error('Error stopping worker:', err);
            })
        );

        await Promise.all(stopPromises);

        this.workers = [];
        console.log('✅ All workers stopped');
    }

    /**
     * Get worker status
     */
    getStatus() {
        return {
            workersRunning: this.workers.length,
            isShuttingDown: this.isShuttingDown,
        };
    }
}

module.exports = WorkerManager;

