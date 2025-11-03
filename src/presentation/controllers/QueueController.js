// @ts-check
// Presentation: QueueController
// Handles queue status and job monitoring endpoints

const { getQueueManager } = require('../../infrastructure/queue/QueueManager');
const QueueConfig = require('../../infrastructure/config/QueueConfig');

class QueueController {
    constructor() {
        this.queueManager = getQueueManager();
    }

    /**
     * Helper to send JSON response
     */
    sendJson(res, statusCode, data) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }

    /**
     * Get processing status for a video
     * GET /api/videos/:videoId/processing-status
     */
    async getVideoProcessingStatus(req, res, videoId) {
        try {
            const queueNames = QueueConfig.getQueueNames();

            // Check transcoding job
            const transcodingJobId = `transcode-${videoId}`;
            const transcodingStatus = await this.queueManager.getJobStatus(
                queueNames.VIDEO_TRANSCODING,
                transcodingJobId
            );

            // Check thumbnail job
            const thumbnailJobId = `thumbnail-${videoId}`;
            const thumbnailStatus = await this.queueManager.getJobStatus(
                queueNames.THUMBNAIL_GENERATION,
                thumbnailJobId
            );

            // Determine overall status
            let overallStatus = 'completed';
            let progress = 100;

            if (transcodingStatus.status === 'active' || thumbnailStatus.status === 'active') {
                overallStatus = 'processing';
                progress = Math.round((
                    (transcodingStatus.progress || 0) +
                    (thumbnailStatus.progress || 0)
                ) / 2);
            } else if (transcodingStatus.status === 'waiting' || thumbnailStatus.status === 'waiting') {
                overallStatus = 'waiting';
                progress = 0;
            } else if (transcodingStatus.status === 'failed' || thumbnailStatus.status === 'failed') {
                overallStatus = 'failed';
                progress = 0;
            } else if (transcodingStatus.status === 'not_found' && thumbnailStatus.status === 'not_found') {
                overallStatus = 'not_found';
                progress = 0;
            }

            return this.sendJson(res, 200, {
                videoId,
                status: overallStatus,
                progress,
                transcoding: {
                    status: transcodingStatus.status,
                    progress: transcodingStatus.progress || 0,
                    error: transcodingStatus.error,
                },
                thumbnail: {
                    status: thumbnailStatus.status,
                    progress: thumbnailStatus.progress || 0,
                    error: thumbnailStatus.error,
                },
            });
        } catch (error) {
            console.error('Error getting processing status:', error);
            return this.sendJson(res, 500, {
                error: 'Failed to get processing status',
            });
        }
    }

    /**
     * Get queue metrics
     * GET /api/queues/metrics
     */
    async getQueueMetrics(req, res) {
        try {
            const queueNames = QueueConfig.getQueueNames();

            const [transcodingMetrics, thumbnailMetrics] = await Promise.all([
                this.queueManager.getQueueMetrics(queueNames.VIDEO_TRANSCODING),
                this.queueManager.getQueueMetrics(queueNames.THUMBNAIL_GENERATION),
            ]);

            return this.sendJson(res, 200, {
                transcoding: transcodingMetrics,
                thumbnail: thumbnailMetrics,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            console.error('Error getting queue metrics:', error);
            return this.sendJson(res, 500, {
                error: 'Failed to get queue metrics',
            });
        }
    }

    /**
     * Retry a failed job
     * POST /api/queues/:queueName/jobs/:jobId/retry
     */
    async retryJob(req, res, queueName, jobId) {
        try {
            const queue = this.queueManager.getQueue(queueName);
            const job = await queue.getJob(jobId);

            if (!job) {
                return this.sendJson(res, 404, {
                    error: 'Job not found',
                });
            }

            await job.retry();

            return this.sendJson(res, 200, {
                message: 'Job retry requested',
                jobId,
                queueName,
            });
        } catch (error) {
            console.error('Error retrying job:', error);
            return this.sendJson(res, 500, {
                error: 'Failed to retry job',
            });
        }
    }

    /**
     * Get health status of queues
     * GET /api/queues/health
     */
    async getQueueHealth(req, res) {
        try {
            const queueNames = QueueConfig.getQueueNames();

            // Try to get metrics to verify connection
            await this.queueManager.getQueueMetrics(queueNames.VIDEO_TRANSCODING);

            return this.sendJson(res, 200, {
                status: 'healthy',
                redis: 'connected',
                queues: Object.values(queueNames),
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            console.error('Queue health check failed:', error);
            return this.sendJson(res, 503, {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString(),
            });
        }
    }
}

module.exports = QueueController;

