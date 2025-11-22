const { Worker, Queue } = require('bullmq');
const QueueConfig = require('../../config/QueueConfig');
const TranscodeVideoUseCase = require('../../../application/use-cases/TranscodeVideoUseCase');
const { getQueueManager } = require('../QueueManager');

/**
 * Worker for processing video transcoding jobs
 */
class TranscodingWorker {
    constructor(videoRepository, videoQualityRepository, storageRepository, videoTranscoder) {
        this.videoRepository = videoRepository;
        this.videoQualityRepository = videoQualityRepository;
        this.storageRepository = storageRepository;
        this.videoTranscoder = videoTranscoder;

        this.queueConfig = new QueueConfig();
        this.connection = this.queueConfig.getConnection();
        this.worker = null;
        this.queue = null;
        this.queueManager = getQueueManager();

        this.transcodeUseCase = new TranscodeVideoUseCase(
            videoRepository,
            videoQualityRepository,
            storageRepository,
            videoTranscoder
        );
    }

    /**
     * Start the worker
     */
    start() {
        const queueName = QueueConfig.getQueueNames().VIDEO_TRANSCODING;

        // Create queue instance for re-enqueuing failed jobs
        this.queue = new Queue(queueName, { connection: /** @type {any} */ (this.connection) });

        this.worker = new Worker(
            queueName,
            async (job) => {
                return await this.processJob(job);
            },
            {
                connection: /** @type {any} */ (this.connection),
                concurrency: 1, // Process one video at a time (CPU intensive)
                removeOnComplete: { count: 100 },
                removeOnFail: { count: 50 },
                // Stalled job handling (jobs that were active when worker crashed)
                lockDuration: 3600000 * 3, // 3 hours (transcoding can take long)
                lockRenewTime: 60000, // Renew lock every minute
                stalledInterval: 300000, // Check for stalled jobs every 5 minutes
                maxStalledCount: 1, // Only retry once if genuinely stalled
            }
        );

        // Event listeners
        this.worker.on('completed', (job) => {
            // Job completed silently
        });

        this.worker.on('failed', async (job, err) => {
            console.error(`❌ Transcoding job failed: ${job?.id}`, err.message);

            // Re-enqueue after all retries exhausted, but cap the number of manual requeues
            if (job && job.attemptsMade >= (job.opts?.attempts || 3)) {
                const requeueCount = job.data?._requeueCount || 0;
                const MAX_REQUEUES = 1;

                // Don't re-enqueue if video doesn't exist (permanent failure)
                if (err.message && err.message.includes('Video not found')) {
                    console.log(`⚠️  Video ${job.data?.videoId} not found - removing from queue permanently`);
                    return;
                }

                if (requeueCount >= MAX_REQUEUES) {
                    console.log(`🛑 Max requeues reached for job ${job.id}; leaving failed to avoid infinite loop`);
                    return;
                }

                console.log(`🔄 Re-enqueueing failed job: ${job.id} (attempt ${job.attemptsMade}, requeue #${requeueCount + 1})`);
                try {
                    await this.queue.add('transcode-video', {
                        ...job.data,
                        _requeueCount: requeueCount + 1,
                    }, {
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 5000, // Start with 5s delay
                        },
                        delay: 30000, // Wait 30s before retrying
                    });
                    console.log(`✅ Job re-enqueued: ${job.id}`);
                } catch (requeueErr) {
                    console.error(`❌ Failed to re-enqueue job ${job.id}:`, requeueErr);
                }
            }
        });

        this.worker.on('error', (err) => {
            console.error('❌ Worker error:', err);
        });

        this.worker.on('active', (job) => {
            // Processing job silently
        });

        this.worker.on('stalled', (jobId) => {
            console.warn(`⚠️  Job stalled and will be reprocessed: ${jobId}`);
        });

        this.worker.on('resumed', () => {
            console.log('🔄 Worker resumed - picking up pending jobs');
        });

        console.log(`✅ Transcoding worker started`);
    }

    /**
     * Process a transcoding job
     * @param {any} job - BullMQ job
     */
    async processJob(job) {
        const { videoId } = job.data;

        try {
            console.log(`🎬 Processing transcoding for video: ${videoId}`);

            // Update job progress
            await job.updateProgress(0);

            // Execute transcoding use case
            const result = await this.transcodeUseCase.execute(videoId);

            // Update job progress to 100%
            await job.updateProgress(100);

            // After transcoding completes, queue thumbnail generation if needed
            try {
                const video = await this.videoRepository.findById(videoId);
                if (video && !video.thumbnailUrl) {
                    console.log(`📤 Queueing thumbnail generation for video ${videoId}...`);
                    await this.queueManager.addThumbnailJob({
                        videoId: video.id,
                        storageKey: video.storageKey,
                        videoPath: '', // Video is in storage, will be downloaded by worker
                    });
                    console.log(`✅ Thumbnail job queued for video ${videoId}`);
                } else if (video && video.thumbnailUrl) {
                    console.log(`⏭️  Video ${videoId} already has a thumbnail - skipping`);
                }
            } catch (thumbnailQueueError) {
                console.error(`❌ Failed to queue thumbnail job after transcoding:`, thumbnailQueueError.message);
                // Don't fail the transcoding job if thumbnail queue fails
            }

            return {
                success: true,
                videoId,
                qualitiesCreated: Array.isArray(result) ? result.length : 0,
                thumbnailGenerated: false, // Thumbnail is now queued separately
            };
        } catch (error) {
            console.error(`❌ Transcoding failed for video ${videoId}:`, error);

            // Update video status to failed
            try {
                const video = await this.videoRepository.findById(videoId);
                if (video) {
                    video.status = 'failed';
                    await this.videoRepository.update(video);
                }
            } catch (dbError) {
                console.error('Failed to update video status:', dbError);
            }

            throw error; // Re-throw to mark job as failed
        }
    }

    /**
     * Stop the worker gracefully
     */
    async stop() {
        if (this.worker) {
            console.log('🔄 Stopping transcoding worker...');
            await this.worker.close();
            console.log('✅ Transcoding worker stopped');
        }
    }
}

module.exports = TranscodingWorker;

