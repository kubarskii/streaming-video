#!/usr/bin/env node
/**
 * Check Job Status Script
 * Displays status of all queued jobs across all queues
 * 
 * Usage:
 *   node scripts/check-jobs.js
 * 
 * Shows:
 *   - Waiting jobs (not yet started)
 *   - Active jobs (currently processing)
 *   - Completed jobs (successful)
 *   - Failed jobs (need attention)
 *   - Delayed jobs (scheduled for later)
 */

require('dotenv').config();
const { Queue } = require('bullmq');
const Redis = require('ioredis');

const QUEUE_NAMES = {
    VIDEO_TRANSCODING: 'video-transcoding',
    THUMBNAIL_GENERATION: 'thumbnail-generation',
    MOV_CONVERSION: 'mov-conversion',
};

async function checkJobs() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    console.log('🔍 Checking Job Status');
    console.log('======================\n');
    console.log(`Redis: ${redisUrl}\n`);

    // Create Redis connection
    const connection = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });

    try {
        // Test connection
        await connection.ping();
        console.log('✅ Connected to Redis\n');

        // Check each queue
        for (const [name, queueName] of Object.entries(QUEUE_NAMES)) {
            await checkQueue(connection, queueName, name);
        }

        console.log('\n✅ Job status check complete');
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await connection.quit();
    }
}

async function checkQueue(connection, queueName, displayName) {
    const queue = new Queue(queueName, { connection });

    console.log(`📦 ${displayName}`);
    console.log(`   Queue: ${queueName}`);

    try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
            queue.getDelayedCount(),
        ]);

        const total = waiting + active + completed + failed + delayed;

        console.log(`   Waiting:   ${waiting}`);
        console.log(`   Active:    ${active}`);
        console.log(`   Completed: ${completed}`);
        console.log(`   Failed:    ${failed}`);
        console.log(`   Delayed:   ${delayed}`);
        console.log(`   Total:     ${total}`);

        // Show details of waiting jobs (up to 5)
        if (waiting > 0) {
            const waitingJobs = await queue.getWaiting(0, 4);
            console.log(`\n   📋 Waiting Jobs (showing up to 5):`);
            for (const job of waitingJobs) {
                console.log(`      - Job ${job.id}: ${JSON.stringify(job.data).substring(0, 100)}`);
            }
        }

        // Show details of active jobs
        if (active > 0) {
            const activeJobs = await queue.getActive(0, 4);
            console.log(`\n   ⚙️  Active Jobs:`);
            for (const job of activeJobs) {
                const progress = job.progress || 0;
                console.log(`      - Job ${job.id}: ${progress}% - ${JSON.stringify(job.data).substring(0, 80)}`);
            }
        }

        // Show details of failed jobs (up to 5)
        if (failed > 0) {
            const failedJobs = await queue.getFailed(0, 4);
            console.log(`\n   ❌ Failed Jobs (showing up to 5):`);
            for (const job of failedJobs) {
                console.log(`      - Job ${job.id}: ${job.failedReason || 'Unknown error'}`);
                console.log(`        Data: ${JSON.stringify(job.data).substring(0, 80)}`);
                console.log(`        Attempts: ${job.attemptsMade}/${job.opts?.attempts || 3}`);
            }
        }

        console.log('');
    } catch (error) {
        console.error(`   ❌ Error checking queue: ${error.message}\n`);
    } finally {
        await queue.close();
    }
}

// Run the script
if (require.main === module) {
    checkJobs().catch((error) => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { checkJobs };

