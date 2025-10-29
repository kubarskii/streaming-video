// @ts-check
// Setup script for video quality feature
// Run: node scripts/setup-video-quality.js

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setupVideoQuality() {
    console.log('🎬 Setting up Video Quality feature...\n');

    try {
        // Check if VideoQuality table exists by trying to query it
        try {
            await prisma.$queryRaw`SELECT COUNT(*) FROM VideoQuality LIMIT 1`;
            console.log('✅ VideoQuality table already exists');

            // Show current status
            const qualityCount = await prisma.videoQuality.count();
            console.log(`   Found ${qualityCount} quality variant(s) in database\n`);
        } catch (error) {
            console.log('ℹ️  VideoQuality table does not exist, creating it...\n');

            // Create the table
            await prisma.$executeRawUnsafe(`
                CREATE TABLE "VideoQuality" (
                    "id" TEXT NOT NULL PRIMARY KEY,
                    "videoId" TEXT NOT NULL,
                    "quality" TEXT NOT NULL,
                    "storageKey" TEXT NOT NULL,
                    "storageUrl" TEXT NOT NULL,
                    "cdnUrl" TEXT,
                    "width" INTEGER NOT NULL,
                    "height" INTEGER NOT NULL,
                    "sizeBytes" INTEGER NOT NULL,
                    "bitrate" INTEGER,
                    "status" TEXT NOT NULL DEFAULT 'pending',
                    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" DATETIME NOT NULL,
                    FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
                )
            `);

            console.log('✅ Created VideoQuality table');

            // Create indexes
            await prisma.$executeRawUnsafe(`
                CREATE UNIQUE INDEX "VideoQuality_storageKey_key" ON "VideoQuality"("storageKey")
            `);
            console.log('✅ Created index: VideoQuality_storageKey_key');

            await prisma.$executeRawUnsafe(`
                CREATE UNIQUE INDEX "VideoQuality_videoId_quality_key" ON "VideoQuality"("videoId", "quality")
            `);
            console.log('✅ Created index: VideoQuality_videoId_quality_key');

            await prisma.$executeRawUnsafe(`
                CREATE INDEX "VideoQuality_videoId_idx" ON "VideoQuality"("videoId")
            `);
            console.log('✅ Created index: VideoQuality_videoId_idx');

            await prisma.$executeRawUnsafe(`
                CREATE INDEX "VideoQuality_status_idx" ON "VideoQuality"("status")
            `);
            console.log('✅ Created index: VideoQuality_status_idx\n');
        }

        // Check ffmpeg availability
        console.log('🔍 Checking dependencies...');
        try {
            const { execSync } = require('child_process');
            const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
            execSync(`"${ffmpegPath}" -version`, { stdio: 'ignore' });
            console.log('✅ ffmpeg is available\n');
        } catch (error) {
            console.log('⚠️  ffmpeg might not be properly installed');
            console.log('   The @ffmpeg-installer/ffmpeg package should handle this automatically\n');
        }

        // Show statistics
        const videoCount = await prisma.video.count();
        console.log('📊 Current Statistics:');
        console.log(`   Total videos: ${videoCount}`);

        if (videoCount > 0) {
            console.log('\n💡 Tip: To transcode existing videos, use:');
            console.log('   POST /api/videos/{videoId}/transcode');
            console.log('   Or create a batch transcoding script\n');
        }

        console.log('✅ Video Quality feature setup complete!');
        console.log('\n📖 See VIDEO_QUALITY_GUIDE.md for full documentation');
        console.log('🚀 Restart your server to start using the feature\n');

    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        console.error('\nFull error:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run setup
setupVideoQuality();


