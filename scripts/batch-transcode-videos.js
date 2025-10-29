// @ts-check
// Batch transcoding script for existing videos
// Run: node scripts/batch-transcode-videos.js

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function batchTranscodeVideos() {
    console.log('🎬 Batch Video Transcoding\n');

    try {
        // Get all videos that don't have quality variants yet
        const videos = await prisma.video.findMany({
            where: {
                status: 'ready'
            },
            include: {
                qualities: true
            }
        });

        if (videos.length === 0) {
            console.log('ℹ️  No videos found to transcode\n');
            await prisma.$disconnect();
            return;
        }

        console.log(`Found ${videos.length} video(s)\n`);

        // Filter videos that don't have quality variants
        const videosToTranscode = videos.filter(v => v.qualities.length === 0);

        if (videosToTranscode.length === 0) {
            console.log('✅ All videos already have quality variants!\n');

            // Show summary
            console.log('📊 Quality Variants Summary:');
            for (const video of videos) {
                console.log(`\n   ${video.title || video.fileName}`);
                console.log(`   ID: ${video.id}`);
                console.log(`   Qualities: ${video.qualities.map(q => q.quality).join(', ')}`);
            }
            console.log('');

            await prisma.$disconnect();
            return;
        }

        console.log(`📋 Videos to transcode: ${videosToTranscode.length}\n`);

        // Display videos that will be transcoded
        for (let i = 0; i < videosToTranscode.length; i++) {
            const video = videosToTranscode[i];
            console.log(`${i + 1}. ${video.title || video.fileName}`);
            console.log(`   ID: ${video.id}`);
            console.log(`   Resolution: ${video.width}x${video.height}`);
            console.log(`   Size: ${(Number(video.sizeBytes) / (1024 * 1024)).toFixed(2)} MB`);
            console.log('');
        }

        console.log('\n⚠️  Note: This script will trigger transcoding but not wait for completion.');
        console.log('   Transcoding happens in the background on the server.\n');

        console.log('📝 To actually transcode these videos, you need to:');
        console.log('   1. Ensure your server is running');
        console.log('   2. Make POST requests to /api/videos/{videoId}/transcode for each video\n');

        console.log('Example curl commands:\n');
        for (const video of videosToTranscode.slice(0, 3)) {
            console.log(`curl -X POST http://localhost:3000/api/videos/${video.id}/transcode \\`);
            console.log(`  -H "Authorization: Bearer YOUR_TOKEN"`);
            console.log('');
        }

        if (videosToTranscode.length > 3) {
            console.log(`... and ${videosToTranscode.length - 3} more video(s)\n`);
        }

        // Generate a Node.js script that can be used to trigger transcoding
        console.log('Or use this Node.js script:\n');
        console.log('```javascript');
        console.log('const axios = require("axios");');
        console.log('const token = "YOUR_AUTH_TOKEN";');
        console.log('const videoIds = [');
        for (const video of videosToTranscode) {
            console.log(`  "${video.id}",`);
        }
        console.log('];');
        console.log('');
        console.log('async function transcodeAll() {');
        console.log('  for (const videoId of videoIds) {');
        console.log('    try {');
        console.log('      const response = await axios.post(');
        console.log('        `http://localhost:3000/api/videos/${videoId}/transcode`,');
        console.log('        {},');
        console.log('        { headers: { Authorization: `Bearer ${token}` } }');
        console.log('      );');
        console.log('      console.log(`✅ Started transcoding: ${videoId}`);');
        console.log('    } catch (error) {');
        console.log('      console.error(`❌ Failed: ${videoId}`, error.response?.data || error.message);');
        console.log('    }');
        console.log('  }');
        console.log('}');
        console.log('');
        console.log('transcodeAll();');
        console.log('```\n');

        console.log('💡 Tip: Monitor server logs to see transcoding progress\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the script
batchTranscodeVideos();


