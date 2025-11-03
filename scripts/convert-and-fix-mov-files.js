#!/usr/bin/env node
/**
 * Script to find, fix status, and queue all MOV files for conversion to WebM
 * 
 * Usage:
 *   node scripts/convert-and-fix-mov-files.js
 * 
 * What it does:
 * - Finds all videos with MOV/QuickTime format
 * - Resets their status from "failed" to "ready"
 * - Queues them for conversion to WebM format
 */

const { PrismaClient } = require('@prisma/client');
const { getQueueManager } = require('../src/infrastructure/queue/QueueManager');

const prisma = new PrismaClient();

async function convertAndFixMovFiles() {
    console.log('🔍 Finding MOV files that need conversion...\n');

    try {
        // Find all MOV videos
        const movVideos = await prisma.video.findMany({
            where: {
                OR: [
                    { mimeType: 'video/quicktime' },
                    { fileName: { endsWith: '.mov' } },
                    { fileName: { endsWith: '.MOV' } },
                ]
            },
            select: {
                id: true,
                title: true,
                fileName: true,
                storageKey: true,
                mimeType: true,
                status: true,
                sizeBytes: true,
            },
            orderBy: {
                uploadedAt: 'desc'
            }
        });

        if (movVideos.length === 0) {
            console.log('✅ No MOV files found. All videos are already in compatible formats!');
            return;
        }

        console.log(`📊 Found ${movVideos.length} MOV file(s):\n`);

        // Display found videos
        movVideos.forEach((video, index) => {
            const sizeMB = (Number(video.sizeBytes) / 1024 / 1024).toFixed(2);
            console.log(`${index + 1}. ${video.title}`);
            console.log(`   ID: ${video.id}`);
            console.log(`   File: ${video.fileName}`);
            console.log(`   Size: ${sizeMB} MB`);
            console.log(`   Status: ${video.status} ${video.status === 'failed' ? '⚠️' : ''}`);
            console.log(`   MIME: ${video.mimeType}`);
            console.log('');
        });

        // Step 1: Fix status for failed videos
        const failedVideos = movVideos.filter(v => v.status === 'failed');
        if (failedVideos.length > 0) {
            console.log(`\n🔧 Fixing status for ${failedVideos.length} failed video(s)...\n`);

            for (const video of failedVideos) {
                await prisma.video.update({
                    where: { id: video.id },
                    data: { status: 'ready' }
                });
                console.log(`✅ Fixed status: ${video.title} (failed → ready)`);
            }
            console.log('');
        }

        // Step 2: Queue for conversion
        console.log('📤 Queueing videos for conversion...\n');

        const queueManager = getQueueManager();
        let successCount = 0;
        let errorCount = 0;

        for (const video of movVideos) {
            try {
                await queueManager.addMovConversionJob({
                    videoId: video.id,
                    storageKey: video.storageKey,
                    fileName: video.fileName,
                    mimeType: video.mimeType,
                });

                console.log(`✅ Queued: ${video.title}`);
                successCount++;

                // Small delay to avoid overwhelming the queue
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error) {
                console.error(`❌ Failed to queue ${video.title}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 Conversion Queue Summary:');
        console.log('='.repeat(60));
        if (failedVideos.length > 0) {
            console.log(`🔧 Status fixed: ${failedVideos.length}`);
        }
        console.log(`✅ Successfully queued: ${successCount}`);
        if (errorCount > 0) {
            console.log(`❌ Failed to queue: ${errorCount}`);
        }
        console.log('');
        console.log('🔄 Videos will be converted in the background.');
        console.log('   Make sure the worker is running: node worker.js');
        console.log('   Converted videos will be in WebM format.');
        console.log('   Original MOV files will remain as backup.');
        console.log('');
        console.log('💡 After conversion completes:');
        console.log('   - Videos will be playable on Android & Windows');
        console.log('   - WebM provides better compatibility');
        console.log('   - Original MOV files remain in storage');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Check if running directly
if (require.main === module) {
    convertAndFixMovFiles()
        .then(() => {
            console.log('\n✅ Script completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = { convertAndFixMovFiles };

