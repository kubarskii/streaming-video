// @ts-check
const { Queue } = require('bullmq');
const QueueConfig = require('../config/QueueConfig');

/**
 * Queue Manager
 * Manages all application queues (Singleton pattern)
 */
class QueueManager {
    constructor() {
        // Implement singleton pattern properly
        if (QueueManager.instance) {
            return QueueManager.instance;
        }

        this.queueConfig = new QueueConfig();
        this.connection = this.queueConfig.getConnection();
        this.queues = {};

        this.initializeQueues();

        // Store instance
        QueueManager.instance = this;
    }

    /**
     * Initialize all queues
     */
    initializeQueues() {
        const queueNames = QueueConfig.getQueueNames();
        const priorities = QueueConfig.getPriorities();
        const defaultJobOptions = this.queueConfig.getDefaultJobOptions();

        // Create Video Transcoding Queue
        this.queues[queueNames.VIDEO_TRANSCODING] = new Queue(
            queueNames.VIDEO_TRANSCODING,
            {
                connection: /** @type {any} */ (this.connection),
                defaultJobOptions: {
                    ...defaultJobOptions,
                    priority: priorities.HIGH,
                },
            }
        );

        // Create Thumbnail Generation Queue
        this.queues[queueNames.THUMBNAIL_GENERATION] = new Queue(
            queueNames.THUMBNAIL_GENERATION,
            {
                connection: /** @type {any} */ (this.connection),
                defaultJobOptions: {
                    ...defaultJobOptions,
                    priority: priorities.NORMAL,
                },
            }
        );

        // Create MOV Conversion Queue
        this.queues[queueNames.MOV_CONVERSION] = new Queue(
            queueNames.MOV_CONVERSION,
            {
                connection: /** @type {any} */ (this.connection),
                defaultJobOptions: {
                    ...defaultJobOptions,
                    priority: priorities.BACKGROUND,
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
     * @returns {Promise<any>} BullMQ Job instance
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
     * @returns {Promise<any>} BullMQ Job instance
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
     * Add a job to the MOV conversion queue
     * @param {Object} data - Job data
     * @param {string} data.videoId - Video ID
     * @param {string} data.storageKey - Original MOV storage key
     * @param {string} data.fileName - Original file name
     * @param {string} data.mimeType - Original MIME type
     * @param {Object} options - Job options
     * @returns {Promise<any>} BullMQ Job instance
     */
    async addMovConversionJob(data, options = {}) {
        const queueName = QueueConfig.getQueueNames().MOV_CONVERSION;
        const queue = this.getQueue(queueName);

        console.log(`📤 Adding MOV conversion job for video: ${data.videoId}`);
        console.log(`   Storage key: ${data.storageKey}`);
        console.log(`   File name: ${data.fileName}`);

        const job = await queue.add('convert-mov-to-webm', data, {
            jobId: `mov-convert-${data.videoId}`, // Prevent duplicate jobs
            ...options,
        });

        console.log(`✅ MOV conversion job queued: ${job.id}`);
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

        // Clear singleton instance
        QueueManager.instance = null;

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

// Static singleton instance
QueueManager.instance = null;

/**
 * Get QueueManager singleton instance
 * @returns {QueueManager}
 */
function getQueueManager() {
    return new QueueManager(); // Constructor handles singleton
}

/**
 * Reset singleton instance (useful for testing)
 * @returns {Promise<void>}
 */
async function resetQueueManager() {
    if (QueueManager.instance) {
        await QueueManager.instance.close();
    }
}

module.exports = {
    QueueManager,
    getQueueManager,
    resetQueueManager,
};

