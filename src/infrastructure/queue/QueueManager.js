const { Queue } = require('bullmq');
const QueueConfig = require('../config/QueueConfig');

/**
 * Queue Manager
 * Manages all application queues
 */
class QueueManager {
    constructor() {
        this.queueConfig = new QueueConfig();
        this.connection = this.queueConfig.getConnection();
        this.queues = {};

        this.initializeQueues();
    }

    /**
     * Initialize all queues
     */
    initializeQueues() {
        const queueNames = QueueConfig.getQueueNames();
        const defaultJobOptions = this.queueConfig.getDefaultJobOptions();

        // Create Video Transcoding Queue
        this.queues[queueNames.VIDEO_TRANSCODING] = new Queue(
            queueNames.VIDEO_TRANSCODING,
            {
                connection: this.connection,
                defaultJobOptions: {
                    ...defaultJobOptions,
                    priority: 1, // Higher priority for transcoding
                },
            }
        );

        // Create Thumbnail Generation Queue
        this.queues[queueNames.THUMBNAIL_GENERATION] = new Queue(
            queueNames.THUMBNAIL_GENERATION,
            {
                connection: this.connection,
                defaultJobOptions: {
                    ...defaultJobOptions,
                    priority: 2, // Lower priority (higher number = lower priority)
                },
            }
        );

        console.log('✅ Queues initialized:', Object.keys(this.queues));
    }

    /**
     * Get a specific queue
     * @param {string} queueName - Name of the queue
     * @returns {Queue} BullMQ Queue instance
     */
    getQueue(queueName) {
        const queue = this.queues[queueName];
        if (!queue) {
            throw new Error(`Queue not found: ${queueName}`);
        }
        return queue;
    }

    /**
     * Add a job to the video transcoding queue
     * @param {Object} data - Job data
     * @param {string} data.videoId - Video ID
     * @param {string} data.storageKey - Storage key for the video
     * @param {string} data.userId - User ID
     * @param {Object} options - Job options (priority, delay, etc.)
     * @returns {Promise<Job>} BullMQ Job instance
     */
    async addTranscodingJob(data, options = {}) {
        const queueName = QueueConfig.getQueueNames().VIDEO_TRANSCODING;
        const queue = this.getQueue(queueName);

        console.log(`📤 Adding transcoding job for video: ${data.videoId}`);
        console.log(`   Storage key: ${data.storageKey}`);

        const job = await queue.add('transcode-video', data, {
            jobId: `transcode-${data.videoId}`, // Prevent duplicate jobs
            ...options,
        });

        console.log(`✅ Transcoding job queued: ${job.id}`);
        return job;
    }

    /**
     * Add a job to the thumbnail generation queue
     * @param {Object} data - Job data
     * @param {string} data.videoId - Video ID
     * @param {string} data.storageKey - Storage key for the video
     * @param {string} data.videoPath - Optional local path to video
     * @param {Object} options - Job options
     * @returns {Promise<Job>} BullMQ Job instance
     */
    async addThumbnailJob(data, options = {}) {
        const queueName = QueueConfig.getQueueNames().THUMBNAIL_GENERATION;
        const queue = this.getQueue(queueName);

        const job = await queue.add('generate-thumbnail', data, {
            jobId: `thumbnail-${data.videoId}`, // Prevent duplicate jobs
            ...options,
        });

        console.log(`📤 Thumbnail job added: ${job.id} for video ${data.videoId}`);
        return job;
    }

    /**
     * Get job status
     * @param {string} queueName - Queue name
     * @param {string} jobId - Job ID
     * @returns {Promise<Object>} Job state and data
     */
    async getJobStatus(queueName, jobId) {
        const queue = this.getQueue(queueName);
        const job = await queue.getJob(jobId);

        if (!job) {
            return { status: 'not_found' };
        }

        const state = await job.getState();
        const progress = job.progress;
        const returnValue = job.returnvalue;
        const failedReason = job.failedReason;

        return {
            status: state,
            progress,
            data: job.data,
            result: returnValue,
            error: failedReason,
            attemptsMade: job.attemptsMade,
            timestamp: job.timestamp,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
        };
    }

    /**
     * Get queue metrics
     * @param {string} queueName - Queue name
     * @returns {Promise<Object>} Queue metrics
     */
    async getQueueMetrics(queueName) {
        const queue = this.getQueue(queueName);

        const [waiting, active, completed, failed, delayed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
            queue.getDelayedCount(),
        ]);

        return {
            waiting,
            active,
            completed,
            failed,
            delayed,
            total: waiting + active + completed + failed + delayed,
        };
    }

    /**
     * Close all queues and connections
     */
    async close() {
        console.log('🔄 Closing all queues...');

        const closePromises = Object.values(this.queues).map(queue =>
            queue.close()
        );

        await Promise.all(closePromises);
        await this.queueConfig.close();

        console.log('✅ All queues closed');
    }

    /**
     * Obliterate a queue (remove all jobs - use with caution!)
     * @param {string} queueName - Queue name
     */
    async obliterateQueue(queueName) {
        const queue = this.getQueue(queueName);
        await queue.obliterate({ force: true });
        console.log(`🗑️  Queue obliterated: ${queueName}`);
    }
}

// Singleton instance
let instance = null;

/**
 * Get QueueManager singleton instance
 * @returns {QueueManager}
 */
function getQueueManager() {
    if (!instance) {
        instance = new QueueManager();
    }
    return instance;
}

module.exports = {
    QueueManager,
    getQueueManager,
};

