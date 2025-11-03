#!/usr/bin/env node
/**
 * Retry Failed Jobs Script
 * Retries all failed jobs in specified queue
 * 
 * Usage:
 *   node scripts/retry-failed-jobs.js [queue-name]
 * 
 * Examples:
 *   node scripts/retry-failed-jobs.js video-transcoding
 *   node scripts/retry-failed-jobs.js all
 * 
 * If no queue specified, shows available queues
 */

require('dotenv').config();
const { Queue } = require('bullmq');
const Redis = require('ioredis');

const QUEUE_NAMES = {
    'video-transcoding': 'Video Transcoding',
    'thumbnail-generation': 'Thumbnail Generation',
    'mov-conversion': 'MOV Conversion',
};

async function retryFailedJobs(queueName) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    console.log('🔄 Retry Failed Jobs');
    console.log('===================\n');

    // Create Redis connection
    const connection = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });

    try {
        await connection.ping();
        console.log('✅ Connected to Redis\n');

        if (queueName === 'all') {
            // Retry all queues
            for (const queue of Object.keys(QUEUE_NAMES)) {
                await retryQueue(connection, queue);
            }
        } else if (QUEUE_NAMES[queueName]) {
            // Retry specific queue
            await retryQueue(connection, queueName);
        } else {
            console.error('❌ Invalid queue name\n');
            console.log('Available queues:');
            for (const [name, display] of Object.entries(QUEUE_NAMES)) {
                console.log(`  - ${name} (${display})`);
            }
            console.log('  - all (retry all queues)');
            process.exit(1);
        }

        console.log('\n✅ Retry complete');
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await connection.quit();
    }
}

async function retryQueue(connection, queueName) {
    const queue = new Queue(queueName, { connection });

    try {
        console.log(`📦 ${QUEUE_NAMES[queueName] || queueName}`);

        // Get failed jobs
        const failedJobs = await queue.getFailed();

        if (failedJobs.length === 0) {
            console.log('   No failed jobs to retry\n');
            return;
        }

        console.log(`   Found ${failedJobs.length} failed job(s)`);

        // Retry each failed job
        let retried = 0;
        for (const job of failedJobs) {
            try {
                await job.retry();
                retried++;
                console.log(`   ✅ Retried job ${job.id}`);
            } catch (error) {
                console.error(`   ❌ Failed to retry job ${job.id}: ${error.message}`);
            }
        }

        console.log(`   Retried ${retried}/${failedJobs.length} jobs\n`);
    } catch (error) {
        console.error(`   ❌ Error processing queue: ${error.message}\n`);
    } finally {
        await queue.close();
    }
}

// Parse command line arguments
const queueName = process.argv[2];

if (!queueName) {
    console.log('Usage: node scripts/retry-failed-jobs.js [queue-name|all]\n');
    console.log('Available queues:');
    for (const [name, display] of Object.entries(QUEUE_NAMES)) {
        console.log(`  - ${name} (${display})`);
    }
    console.log('  - all (retry all queues)');
    process.exit(1);
}

// Run the script
retryFailedJobs(queueName).catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});

