const { Worker, Queue } = require('bullmq');
const path = require('path');
const fs = require('fs');
const QueueConfig = require('../../config/QueueConfig');

/**
 * Worker for converting MOV files to WebM format
 * Converts MOV files to WebM for better browser compatibility
 */
class ConversionWorker {
    constructor(videoRepository, storageRepository, videoTranscoder) {
        this.videoRepository = videoRepository;
        this.storageRepository = storageRepository;
        this.videoTranscoder = videoTranscoder;

        this.queueConfig = new QueueConfig();
        this.connection = this.queueConfig.getConnection();
        this.worker = null;
        this.queue = null;
    }

    /**
     * Start the worker
     */
    start() {
        const queueName = QueueConfig.getQueueNames().MOV_CONVERSION;

        // Create queue instance for re-enqueuing failed jobs
        this.queue = new Queue(queueName, { connection: this.connection });

        this.worker = new Worker(
            queueName,
            async (job) => {
                return await this.processJob(job);
            },
            {
                connection: this.connection,
                concurrency: 1, // Process one video at a time (CPU intensive)
                removeOnComplete: { count: 100 },
                removeOnFail: { count: 50 },
            }
        );

        // Event listeners
        this.worker.on('completed', (job) => {
            console.log(`✅ MOV conversion completed: ${job.id}`);
        });

        this.worker.on('failed', async (job, err) => {
            console.error(`❌ MOV conversion job failed: ${job?.id}`, err.message);

            // Re-enqueue after all retries exhausted
            if (job && job.attemptsMade >= (job.opts?.attempts || 3)) {
                // Don't re-enqueue if video doesn't exist (permanent failure)
                if (err.message && err.message.includes('Video not found')) {
                    console.log(`⚠️  Video ${job.data?.videoId} not found - removing from queue permanently`);
                    return;
                }

                console.log(`🔄 Re-enqueueing failed job: ${job.id} (attempt ${job.attemptsMade})`);
                try {
                    await this.queue.add('convert-mov-to-webm', job.data, {
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 10000, // Start with 10s delay
                        },
                        delay: 60000, // Wait 1 minute before retrying
                    });
                    console.log(`✅ Job re-enqueued: ${job.id}`);
                } catch (requeueErr) {
                    console.error(`❌ Failed to re-enqueue job ${job.id}:`, requeueErr);
                }
            }
        });

        this.worker.on('error', (err) => {
            console.error('❌ Conversion worker error:', err);
        });

        this.worker.on('active', (job) => {
            console.log(`🔄 Processing MOV conversion: ${job.id}`);
        });

        console.log(`✅ MOV Conversion worker started`);
    }

    /**
     * Process a MOV conversion job
     * @param {Job} job - BullMQ job
     */
    async processJob(job) {
        const { videoId, storageKey, fileName, mimeType } = job.data;

        try {
            console.log(`🎬 Converting MOV to WebM for video: ${videoId}`);
            console.log(`   Storage key: ${storageKey}`);
            console.log(`   MIME type: ${mimeType}`);

            // Update job progress
            await job.updateProgress(10);

            // Get video from database
            const video = await this.videoRepository.findById(videoId);
            if (!video) {
                throw new Error(`Video not found: ${videoId}`);
            }

            // Skip if already converted (check if fileName already ends with .webm)
            if (fileName.toLowerCase().endsWith('.webm') || mimeType === 'video/webm') {
                console.log(`⏭️  Video ${videoId} is already in WebM format - skipping`);
                return {
                    success: true,
                    skipped: true,
                    videoId,
                    message: 'Already in WebM format',
                };
            }

            // Create temp directory for processing
            const tempDir = path.join(process.cwd(), 'videos', 'temp', 'conversion', videoId);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            await job.updateProgress(20);

            // Download original MOV file from storage
            console.log(`📥 Downloading original file from storage...`);
            const originalPath = path.join(tempDir, fileName);

            // Use getObjectStream to download the file
            const { stream } = await this.storageRepository.getObjectStream(storageKey);
            const writeStream = fs.createWriteStream(originalPath);

            // Pipe the stream to file
            await new Promise((resolve, reject) => {
                stream.pipe(writeStream);
                stream.on('error', reject);
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });

            await job.updateProgress(40);

            // Convert MOV to WebM
            console.log(`🔄 Converting to WebM...`);
            const webmFileName = fileName.replace(/\.(mov|MOV)$/, '.webm');
            const webmPath = path.join(tempDir, webmFileName);

            await this.videoTranscoder.convertToWebm(originalPath, webmPath, {
                crf: 32, // Quality (lower = better, range: 4-63)
                audioBitrate: '128k'
            });

            await job.updateProgress(70);

            // Upload WebM file to storage
            console.log(`📤 Uploading WebM file to storage...`);
            const webmStorageKey = storageKey.replace(/\.(mov|MOV)$/, '.webm');
            const webmFileSize = fs.statSync(webmPath).size;

            const uploadResult = await this.storageRepository.upload(
                webmPath,
                webmStorageKey,
                {
                    contentType: 'video/webm',
                    originalName: webmFileName,
                }
            );

            await job.updateProgress(85);

            // Update video record in database
            console.log(`💾 Updating video record...`);
            video.fileName = webmFileName;
            video.storageKey = webmStorageKey;
            video.storageUrl = uploadResult.url || video.storageUrl;
            video.mimeType = 'video/webm';
            video.sizeBytes = BigInt(webmFileSize);

            await this.videoRepository.update(video);

            await job.updateProgress(95);

            // Clean up temp files
            console.log(`🧹 Cleaning up temp files...`);
            try {
                fs.unlinkSync(originalPath);
                fs.unlinkSync(webmPath);
                fs.rmdirSync(tempDir, { recursive: true });
            } catch (cleanupErr) {
                console.error(`⚠️  Failed to clean up temp files:`, cleanupErr.message);
            }

            // Delete old MOV file from storage
            try {
                console.log(`🗑️  Deleting original MOV file from storage...`);
                await this.storageRepository.deleteFile(storageKey);
            } catch (deleteErr) {
                console.error(`⚠️  Failed to delete original MOV file:`, deleteErr.message);
            }

            await job.updateProgress(100);

            console.log(`✅ Successfully converted video ${videoId} from MOV to WebM`);

            return {
                success: true,
                videoId,
                originalFile: fileName,
                convertedFile: webmFileName,
                originalSize: video.sizeBytes.toString(),
                convertedSize: webmFileSize.toString(),
            };
        } catch (error) {
            console.error(`❌ Conversion failed for video ${videoId}:`, error);

            // Update video status to failed if conversion fails
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
            console.log('🔄 Stopping MOV conversion worker...');
            await this.worker.close();
            console.log('✅ MOV conversion worker stopped');
        }
    }
}

module.exports = ConversionWorker;

