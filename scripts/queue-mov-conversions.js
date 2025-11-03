#!/usr/bin/env node

/**
 * Queue MOV Conversion Script
 * Finds all unprocessed MOV files in the database and queues them for conversion to WebM
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { getQueueManager } = require('../src/infrastructure/queue/QueueManager');

async function main() {
    console.log('🎬 MOV to WebM Conversion Queue Script');
    console.log('========================================\n');

    // Check required environment variables
    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL is required');
        process.exit(1);
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    console.log(`📦 Redis URL: ${redisUrl}`);
    console.log(`📦 Database: Connected\n`);

    // Initialize Prisma client
    const prisma = new PrismaClient();

    try {
        // Test database connection
        await prisma.$connect();
        console.log('✅ Database connected\n');

        // Find all MOV videos that haven't been converted
        console.log('🔍 Searching for MOV videos...\n');
        
        const movVideos = await prisma.video.findMany({
            where: {
                OR: [
                    {
                        mimeType: 'video/quicktime'
                    },
                    {
                        fileName: {
                            endsWith: '.mov'
                        }
                    },
                    {
                        fileName: {
                            endsWith: '.MOV'
                        }
                    }
                ]
            },
            select: {
                id: true,
                title: true,
                fileName: true,
                storageKey: true,
                mimeType: true,
                sizeBytes: true,
                uploadedAt: true,
                status: true
            },
            orderBy: {
                uploadedAt: 'desc'
            }
        });

        console.log(`📊 Found ${movVideos.length} MOV video(s)\n`);

        if (movVideos.length === 0) {
            console.log('✅ No MOV videos found. Nothing to do!');
            await prisma.$disconnect();
            process.exit(0);
        }

        // Display videos found
        console.log('Videos to be queued for conversion:');
        console.log('─'.repeat(100));
        movVideos.forEach((video, index) => {
            const sizeMB = (Number(video.sizeBytes) / (1024 * 1024)).toFixed(2);
            console.log(`${index + 1}. ${video.title}`);
            console.log(`   ID: ${video.id}`);
            console.log(`   File: ${video.fileName}`);
            console.log(`   Size: ${sizeMB} MB`);
            console.log(`   MIME: ${video.mimeType}`);
            console.log(`   Status: ${video.status}`);
            console.log(`   Uploaded: ${video.uploadedAt.toISOString()}`);
            console.log();
        });
        console.log('─'.repeat(100));
        console.log();

        // Ask for confirmation (in production, you might want to skip this)
        console.log('⚠️  This will queue all these videos for conversion to WebM format.');
        console.log('The original MOV files will be replaced with WebM versions.\n');

        // Initialize queue manager
        const queueManager = getQueueManager();

        let successCount = 0;
        let errorCount = 0;

        console.log('📤 Queueing conversion jobs...\n');

        // Queue each video for conversion
        for (const video of movVideos) {
            try {
                await queueManager.addMovConversionJob({
                    videoId: video.id,
                    storageKey: video.storageKey,
                    fileName: video.fileName,
                    mimeType: video.mimeType,
                });

                successCount++;
                console.log(`✅ Queued: ${video.title} (${video.id})`);
            } catch (error) {
                errorCount++;
                console.error(`❌ Failed to queue ${video.title} (${video.id}):`, error.message);
            }
        }

        console.log();
        console.log('═'.repeat(100));
        console.log('📊 Summary:');
        console.log(`   Total videos found: ${movVideos.length}`);
        console.log(`   Successfully queued: ${successCount}`);
        console.log(`   Failed: ${errorCount}`);
        console.log('═'.repeat(100));
        console.log();

        if (successCount > 0) {
            console.log('✅ Jobs queued successfully!');
            console.log('💡 Make sure the worker is running to process these jobs.');
            console.log('   Run: npm run worker\n');
        }

        // Close connections
        await queueManager.close();
        await prisma.$disconnect();

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        await prisma.$disconnect();
        process.exit(1);
    }
}

// Run the script
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});


