// @ts-check
// scripts/import-videos.js
// Utility script to import existing videos from the videos/ directory into the database

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Import application components
const DatabaseConfig = require('../src/infrastructure/config/DatabaseConfig');
const StorageConfig = require('../src/infrastructure/config/StorageConfig');
const PrismaVideoRepository = require('../src/infrastructure/persistence/PrismaVideoRepository');
const VideoService = require('../src/application/services/VideoService');

const VIDEO_DIR = path.join(__dirname, '..', 'videos');

const MIME_TYPES = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.m4v': 'video/x-m4v',
    '.avi': 'video/x-msvideo',
};

async function importVideos() {
    console.log('📹 Video Import Utility');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Initialize dependencies
    const prismaClient = DatabaseConfig.getPrismaClient();
    const videoRepository = new PrismaVideoRepository(prismaClient);
    const storageRepository = StorageConfig.createStorageRepository();
    const videoService = new VideoService(videoRepository, storageRepository);

    console.log(`📂 Scanning directory: ${VIDEO_DIR}\n`);

    // Read videos directory
    if (!fs.existsSync(VIDEO_DIR)) {
        console.error('❌ Videos directory not found!');
        process.exit(1);
    }

    const files = fs.readdirSync(VIDEO_DIR);
    const videoFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return MIME_TYPES[ext] !== undefined;
    });

    if (videoFiles.length === 0) {
        console.log('ℹ️  No video files found in videos/ directory');
        process.exit(0);
    }

    console.log(`Found ${videoFiles.length} video file(s)\n`);

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const fileName of videoFiles) {
        try {
            // Check if video already exists
            const existing = await videoService.getVideoByFileName(fileName);
            if (existing) {
                console.log(`⏭️  Skipped: ${fileName} (already in database)`);
                skipped++;
                continue;
            }

            const filePath = path.join(VIDEO_DIR, fileName);
            const stats = fs.statSync(filePath);
            const ext = path.extname(fileName).toLowerCase();
            const mimeType = MIME_TYPES[ext];

            // Generate title from filename
            const title = path.basename(fileName, ext)
                .replace(/[-_]/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase());

            console.log(`📤 Importing: ${fileName}`);

            // Upload video
            const video = await videoService.uploadVideo({
                filePath,
                fileName,
                title,
                description: `Imported from ${fileName}`,
                mimeType,
                sizeBytes: stats.size,
            });

            console.log(`   ✅ Imported successfully (ID: ${video.id})`);
            console.log(`   📊 Size: ${formatBytes(stats.size)}`);
            console.log(`   🔗 URL: ${video.getPlaybackUrl()}\n`);

            imported++;

        } catch (error) {
            console.error(`   ❌ Failed: ${error.message}\n`);
            failed++;
        }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Import Summary:');
    console.log(`   ✅ Imported: ${imported}`);
    console.log(`   ⏭️  Skipped:  ${skipped}`);
    console.log(`   ❌ Failed:   ${failed}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await DatabaseConfig.disconnect();
    process.exit(0);
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Run import
importVideos().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

