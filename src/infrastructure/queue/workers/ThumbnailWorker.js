const { Worker, Queue } = require('bullmq');
const path = require('path');
const fs = require('fs');
const QueueConfig = require('../../config/QueueConfig');
const ThumbnailGenerator = require('../../media/ThumbnailGenerator');

/**
 * Worker for processing thumbnail generation jobs
 */
class ThumbnailWorker {
    constructor(videoRepository, storageRepository) {
        this.videoRepository = videoRepository;
        this.storageRepository = storageRepository;

        this.queueConfig = new QueueConfig();
        this.connection = this.queueConfig.getConnection();
        this.worker = null;
        this.queue = null;

        this.thumbnailGenerator = new ThumbnailGenerator();
    }

    /**
     * Start the worker
     */
    start() {
        const queueName = QueueConfig.getQueueNames().THUMBNAIL_GENERATION;

        // Create queue instance for re-enqueuing failed jobs
        this.queue = new Queue(queueName, { connection: this.connection });

        this.worker = new Worker(
            queueName,
            async (job) => {
                return await this.processJob(job);
            },
            {
                connection: this.connection,
                concurrency: 2, // Can process multiple thumbnails concurrently
                removeOnComplete: { count: 200 },
                removeOnFail: { count: 50 },
            }
        );

        // Event listeners
        this.worker.on('completed', (job) => {
            // Job completed silently
        });

        this.worker.on('failed', async (job, err) => {
            console.error(`❌ Thumbnail job failed: ${job?.id}`, err.message);

            // Re-enqueue after all retries exhausted
            if (job && job.attemptsMade >= (job.opts?.attempts || 3)) {
                // Don't re-enqueue if video doesn't exist (permanent failure)
                if (err.message && err.message.includes('Video not found')) {
                    console.log(`⚠️  Video ${job.data?.videoId} not found - removing thumbnail job from queue permanently`);
                    return;
                }

                console.log(`🔄 Re-enqueueing failed thumbnail job: ${job.id}`);
                try {
                    await this.queue.add('generate-thumbnail', job.data, {
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 2000, // Start with 2s delay for thumbnails
                        },
                        delay: 15000, // Wait 15s before retrying
                    });
                    console.log(`✅ Thumbnail job re-enqueued: ${job.id}`);
                } catch (requeueErr) {
                    console.error(`❌ Failed to re-enqueue thumbnail job ${job.id}:`, requeueErr);
                }
            }
        });

        this.worker.on('error', (err) => {
            console.error('❌ Worker error:', err);
        });

        this.worker.on('active', (job) => {
            // Processing job silently
        });

        console.log(`✅ Thumbnail worker started`);
    }

    /**
     * Process a thumbnail generation job
     * @param {Job} job - BullMQ job
     */
    async processJob(job) {
        const { videoId, storageKey, videoPath } = job.data;

        try {
            await job.updateProgress(10);

            // Get video from database
            const video = await this.videoRepository.findById(videoId);
            if (!video) {
                throw new Error(`Video not found: ${videoId}`);
            }

            // Skip if video already has a thumbnail
            if (video.thumbnailUrl) {
                return {
                    success: true,
                    videoId,
                    skipped: true,
                    thumbnailUrl: video.thumbnailUrl,
                };
            }

            await job.updateProgress(25);

            // Determine video path (local or download from storage)
            let localVideoPath = videoPath;
            let shouldCleanup = false;

            if (!localVideoPath || !fs.existsSync(localVideoPath)) {
                // Download video from storage
                const tempDir = path.join(process.cwd(), 'videos', 'temp');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                localVideoPath = path.join(tempDir, `temp_${videoId}${path.extname(storageKey || '.mp4')}`);

                await this.storageRepository.download(storageKey || video.storageKey, localVideoPath);
                shouldCleanup = true;
            }

            await job.updateProgress(50);

            // Generate thumbnail
            const thumbnailTempPath = path.join(
                process.cwd(),
                'videos',
                'temp',
                `thumb_${videoId}.jpg`
            );

            const generatedThumbnailPath = await this.thumbnailGenerator.generateFromVideo(
                localVideoPath,
                thumbnailTempPath,
                { size: '640x360' }
            );

            await job.updateProgress(75);

            // Upload thumbnail to storage
            const fileExt = path.extname(generatedThumbnailPath).toLowerCase();
            const contentType = fileExt === '.svg' ? 'image/svg+xml' : 'image/jpeg';
            const thumbnailKey = `thumb_${videoId}${fileExt}`;

            const thumbnailUpload = await this.storageRepository.upload(
                generatedThumbnailPath,
                thumbnailKey,
                {
                    contentType,
                    originalName: `${videoId}_thumbnail${fileExt}`,
                }
            );

            // Update video record with thumbnail URL
            video.thumbnailUrl = thumbnailUpload.cdnUrl || thumbnailUpload.storageUrl;
            await this.videoRepository.update(video);

            await job.updateProgress(90);

            // Cleanup temporary files
            try {
                if (fs.existsSync(generatedThumbnailPath)) {
                    fs.unlinkSync(generatedThumbnailPath);
                }
                if (shouldCleanup && fs.existsSync(localVideoPath)) {
                    fs.unlinkSync(localVideoPath);
                }
            } catch (cleanupError) {
                console.warn('⚠️  Failed to cleanup temp files:', cleanupError.message);
            }

            await job.updateProgress(100);

            return {
                success: true,
                videoId,
                thumbnailUrl: video.thumbnailUrl,
            };
        } catch (error) {
            console.error(`❌ Thumbnail generation failed for video ${videoId}:`, error);
            throw error; // Re-throw to mark job as failed
        }
    }

    /**
     * Stop the worker gracefully
     */
    async stop() {
        if (this.worker) {
            console.log('🔄 Stopping thumbnail worker...');
            await this.worker.close();
            console.log('✅ Thumbnail worker stopped');
        }
    }
}

module.exports = ThumbnailWorker;

