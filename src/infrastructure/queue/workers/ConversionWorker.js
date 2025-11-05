const { Worker, Queue } = require('bullmq');
const path = require('path');
const fs = require('fs');
const QueueConfig = require('../../config/QueueConfig');
const { getQueueManager } = require('../QueueManager');

/**
 * Worker for converting MOV files to MP4 format
 * Converts MOV files to MP4 for better compatibility
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
        this.queueManager = getQueueManager();
    }

    /**
     * Start the worker
     */
    start() {
        const queueName = QueueConfig.getQueueNames().MOV_CONVERSION;

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
                lockDuration: 1800000, // 30 minutes (conversion can take long)
                lockRenewTime: 60000, // Renew lock every minute
                stalledInterval: 300000, // Check for stalled jobs every 5 minutes
                maxStalledCount: 1, // Only retry once if genuinely stalled
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
                    await this.queue.add('convert-mov-to-mp4', job.data, {
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

        this.worker.on('stalled', (jobId) => {
            console.warn(`⚠️  MOV conversion job stalled and will be reprocessed: ${jobId}`);
        });

        this.worker.on('resumed', () => {
            console.log('🔄 MOV conversion worker resumed - picking up pending jobs');
        });

        console.log(`✅ MOV Conversion worker started`);
    }

    /**
     * Process a MOV conversion job
     * @param {any} job - BullMQ job
     */
    async processJob(job) {
        const { videoId, storageKey, fileName, mimeType } = job.data;

        let tempDir = null;
        let originalPath = null;
        let mp4Path = null;

        try {
            console.log(`🎬 Converting MOV to MP4 for video: ${videoId}`);
            console.log(`   Storage key: ${storageKey}`);
            console.log(`   MIME type: ${mimeType}`);

            // Update job progress
            await job.updateProgress(10);

            // Get video from database
            const video = await this.videoRepository.findById(videoId);
            if (!video) {
                throw new Error(`Video not found: ${videoId}`);
            }

            // Skip if already in MP4 format
            if (fileName.toLowerCase().endsWith('.mp4') || mimeType === 'video/mp4') {
                console.log(`⏭️  Video ${videoId} is already in MP4 format - skipping`);
                return {
                    success: true,
                    skipped: true,
                    videoId,
                    message: 'Already in MP4 format',
                };
            }

            // Create temp directory for processing
            tempDir = path.join(process.cwd(), 'videos', 'temp', 'conversion', videoId);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            await job.updateProgress(20);

            // Download original MOV file from storage
            console.log(`📥 Downloading original file from storage...`);
            originalPath = path.join(tempDir, fileName);

            // Use getObjectStream to download the file
            const { stream } = await this.storageRepository.getObjectStream(storageKey);
            const writeStream = fs.createWriteStream(originalPath);

            // Pipe the stream to file
            await new Promise((resolve, reject) => {
                stream.pipe(writeStream);
                stream.on('error', (err) => reject(err));
                writeStream.on('finish', () => resolve());
                writeStream.on('error', (err) => reject(err));
            });

            await job.updateProgress(40);

            // Convert MOV to MP4
            console.log(`🔄 Converting to MP4...`);
            const mp4FileName = fileName.replace(/\.(mov|MOV)$/, '.mp4');
            mp4Path = path.join(tempDir, mp4FileName);

            // Use standard MP4 conversion with H.264 codec
            await this.videoTranscoder.convertToMp4(originalPath, mp4Path, {
                videoCodec: 'libx264',
                audioCodec: 'aac',
                crf: 23, // Quality (lower = better, 18-28 is good range)
                preset: 'medium', // Encoding speed vs compression
                audioBitrate: '128k'
            });

            await job.updateProgress(70);

            // Upload MP4 file to storage
            console.log(`📤 Uploading MP4 file to storage...`);
            const mp4StorageKey = storageKey.replace(/\.(mov|MOV)$/, '.mp4');
            const mp4FileSize = fs.statSync(mp4Path).size;

            const uploadResult = await this.storageRepository.upload(
                mp4Path,
                mp4StorageKey,
                {
                    contentType: 'video/mp4',
                    originalName: mp4FileName,
                }
            );

            await job.updateProgress(85);

            // Update video record in database
            console.log(`💾 Updating video record...`);
            video.fileName = mp4FileName;
            video.storageKey = mp4StorageKey;
            video.storageUrl = uploadResult.url || video.storageUrl;
            video.mimeType = 'video/mp4';
            video.sizeBytes = BigInt(mp4FileSize);

            await this.videoRepository.update(video);

            await job.updateProgress(95);

            // Delete old MOV file from storage
            try {
                console.log(`🗑️  Deleting original MOV file from storage...`);
                await this.storageRepository.deleteFile(storageKey);
            } catch (deleteErr) {
                console.error(`⚠️  Failed to delete original MOV file:`, deleteErr.message);
            }

            await job.updateProgress(100);

            console.log(`✅ Successfully converted video ${videoId} from MOV to MP4`);

            // Queue transcoding job for the converted MP4 file
            try {
                console.log(`📤 Queueing transcoding job for converted video ${videoId}...`);
                await this.queueManager.addTranscodingJob({
                    videoId: video.id,
                    storageKey: video.storageKey, // Updated storage key (now .mp4)
                    userId: video.userId,
                });
                console.log(`✅ Transcoding job queued for converted video ${videoId}`);
            } catch (queueError) {
                console.error(`❌ Failed to queue transcoding job after conversion:`, queueError.message);
                // Don't fail the conversion job if transcoding queue fails
                // Set video to ready so it can still be watched
                try {
                    video.status = 'ready';
                    await this.videoRepository.update(video);
                } catch (updateError) {
                    console.error(`❌ Failed to update video status:`, updateError.message);
                }
            }

            return {
                success: true,
                videoId,
                originalFile: fileName,
                convertedFile: mp4FileName,
                originalSize: video.sizeBytes.toString(),
                convertedSize: mp4FileSize.toString(),
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
        } finally {
            // ALWAYS clean up temp files, even if errors occurred
            console.log(`🧹 Cleaning up temp files...`);
            try {
                if (originalPath && fs.existsSync(originalPath)) {
                    fs.unlinkSync(originalPath);
                }
                if (mp4Path && fs.existsSync(mp4Path)) {
                    fs.unlinkSync(mp4Path);
                }
                if (tempDir && fs.existsSync(tempDir)) {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                }
            } catch (cleanupErr) {
                console.error(`⚠️  Failed to clean up temp files:`, cleanupErr.message);
            }
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

