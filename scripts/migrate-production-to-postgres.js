#!/usr/bin/env node
/**
 * Migrate data from production SQLite to PostgreSQL
 * This script should be run on Railway with access to both databases
 * 
 * Usage:
 *   Set SQLITE_URL and POSTGRES_URL environment variables
 *   node scripts/migrate-production-to-postgres.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Client } = require('pg');

async function migrateData() {
    console.log('🔄 Starting production data migration...\n');

    // SQLite source (current production database)
    const sqliteUrl = process.env.SQLITE_URL || process.env.DATABASE_URL;
    console.log('📂 Source (SQLite):', sqliteUrl);

    const prismaSqlite = new PrismaClient({
        datasources: { db: { url: sqliteUrl } }
    });

    // PostgreSQL target
    const postgresUrl = process.env.POSTGRES_URL;
    if (!postgresUrl) {
        console.error('❌ POSTGRES_URL environment variable is required!');
        console.error('   Set it to your new PostgreSQL connection string');
        process.exit(1);
    }
    console.log('🎯 Target (PostgreSQL):', postgresUrl.replace(/:[^:@]+@/, ':****@'), '\n');

    const pgClient = new Client({ connectionString: postgresUrl });

    try {
        // Connect to both databases
        console.log('🔗 Connecting to databases...');
        await pgClient.connect();
        console.log('✅ Connected to PostgreSQL\n');

        // Start transaction
        await pgClient.query('BEGIN;');

        // Migrate Users
        console.log('📦 Migrating Users...');
        const users = await prismaSqlite.user.findMany();
        console.log(`   Found ${users.length} users`);
        for (const user of users) {
            await pgClient.query(
                `INSERT INTO "User" (id, email, username, "passwordHash", "createdAt", "updatedAt") 
                 VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
                [user.id, user.email, user.username, user.passwordHash, user.createdAt, user.updatedAt]
            );
        }

        // Migrate Channels
        console.log('📦 Migrating Channels...');
        const channels = await prismaSqlite.channel.findMany();
        console.log(`   Found ${channels.length} channels`);
        for (const channel of channels) {
            await pgClient.query(
                `INSERT INTO "Channel" (id, "userId", name, description, "avatarUrl", "bannerUrl", 
                 "subscriberCount", "videoCount", "createdAt", "updatedAt") 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
                [channel.id, channel.userId, channel.name, channel.description, channel.avatarUrl,
                channel.bannerUrl, channel.subscriberCount, channel.videoCount, channel.createdAt, channel.updatedAt]
            );
        }

        // Migrate Subscriptions
        console.log('📦 Migrating Subscriptions...');
        const subscriptions = await prismaSqlite.subscription.findMany();
        console.log(`   Found ${subscriptions.length} subscriptions`);
        for (const sub of subscriptions) {
            await pgClient.query(
                `INSERT INTO "Subscription" (id, "userId", "channelId", "subscribedAt") 
                 VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
                [sub.id, sub.userId, sub.channelId, sub.subscribedAt]
            );
        }

        // Migrate Videos
        console.log('📦 Migrating Videos...');
        const videos = await prismaSqlite.video.findMany();
        console.log(`   Found ${videos.length} videos`);
        for (const video of videos) {
            await pgClient.query(
                `INSERT INTO "Video" (id, title, description, "fileName", "storageKey", "storageUrl", 
                 "cdnUrl", "mimeType", "sizeBytes", "durationMs", width, height, status, 
                 "uploadedAt", "updatedAt", "userId", "thumbnailUrl", views) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) 
                 ON CONFLICT (id) DO NOTHING`,
                [video.id, video.title, video.description, video.fileName, video.storageKey, video.storageUrl,
                video.cdnUrl, video.mimeType, video.sizeBytes, video.durationMs, video.width, video.height,
                video.status, video.uploadedAt, video.updatedAt, video.userId, video.thumbnailUrl, video.views]
            );
        }

        // Migrate VideoQuality
        console.log('📦 Migrating Video Qualities...');
        const qualities = await prismaSqlite.videoQuality.findMany();
        console.log(`   Found ${qualities.length} video qualities`);
        for (const quality of qualities) {
            await pgClient.query(
                `INSERT INTO "VideoQuality" (id, "videoId", quality, "storageKey", "storageUrl", 
                 "cdnUrl", width, height, "sizeBytes", bitrate, status, "createdAt", "updatedAt") 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) ON CONFLICT (id) DO NOTHING`,
                [quality.id, quality.videoId, quality.quality, quality.storageKey, quality.storageUrl,
                quality.cdnUrl, quality.width, quality.height, quality.sizeBytes, quality.bitrate,
                quality.status, quality.createdAt, quality.updatedAt]
            );
        }

        // Migrate Comments
        console.log('📦 Migrating Comments...');
        const comments = await prismaSqlite.comment.findMany();
        console.log(`   Found ${comments.length} comments`);
        for (const comment of comments) {
            await pgClient.query(
                `INSERT INTO "Comment" (id, "videoId", "userId", content, "createdAt", "updatedAt") 
                 VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
                [comment.id, comment.videoId, comment.userId, comment.content, comment.createdAt, comment.updatedAt]
            );
        }

        // Migrate VideoLikes
        console.log('📦 Migrating Video Likes...');
        const likes = await prismaSqlite.videoLike.findMany();
        console.log(`   Found ${likes.length} video likes`);
        for (const like of likes) {
            await pgClient.query(
                `INSERT INTO "VideoLike" (id, "videoId", "userId", "isLike", "createdAt", "updatedAt") 
                 VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
                [like.id, like.videoId, like.userId, like.isLike, like.createdAt, like.updatedAt]
            );
        }

        // Migrate Playlists
        console.log('📦 Migrating Playlists...');
        const playlists = await prismaSqlite.playlist.findMany();
        console.log(`   Found ${playlists.length} playlists`);
        for (const playlist of playlists) {
            await pgClient.query(
                `INSERT INTO "Playlist" (id, title, description, "isPublic", slug, "createdAt", "updatedAt", "userId") 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`,
                [playlist.id, playlist.title, playlist.description, playlist.isPublic, playlist.slug,
                playlist.createdAt, playlist.updatedAt, playlist.userId]
            );
        }

        // Migrate PlaylistVideos
        console.log('📦 Migrating Playlist Videos...');
        const playlistVideos = await prismaSqlite.playlistVideo.findMany();
        console.log(`   Found ${playlistVideos.length} playlist videos`);
        for (const pv of playlistVideos) {
            await pgClient.query(
                `INSERT INTO "PlaylistVideo" (id, "playlistId", "videoId", position, "addedAt") 
                 VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
                [pv.id, pv.playlistId, pv.videoId, pv.position, pv.addedAt]
            );
        }

        // Migrate UploadSessions
        console.log('📦 Migrating Upload Sessions...');
        const sessions = await prismaSqlite.uploadSession.findMany();
        console.log(`   Found ${sessions.length} upload sessions`);
        for (const session of sessions) {
            await pgClient.query(
                `INSERT INTO "UploadSession" (id, "userId", "fileName", "fileSize", "mimeType", 
                 "totalChunks", "uploadedChunks", metadata, status, "createdAt", "expiresAt") 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING`,
                [session.id, session.userId, session.fileName, session.fileSize, session.mimeType,
                session.totalChunks, session.uploadedChunks, session.metadata, session.status,
                session.createdAt, session.expiresAt]
            );
        }

        // Commit transaction
        await pgClient.query('COMMIT;');

        console.log('\n✅ Migration complete!');
        console.log('\n🔍 Verifying data:');

        const tables = [
            'User', 'Channel', 'Subscription', 'Video',
            'VideoQuality', 'Comment', 'VideoLike',
            'Playlist', 'PlaylistVideo', 'UploadSession'
        ];

        for (const table of tables) {
            const result = await pgClient.query(`SELECT COUNT(*) FROM "${table}"`);
            console.log(`   ${table}: ${result.rows[0].count} rows`);
        }

        console.log('\n🎉 Production data successfully migrated to PostgreSQL!');

    } catch (error) {
        await pgClient.query('ROLLBACK;');
        console.error('\n❌ Error during migration:');
        console.error(error.message);
        throw error;
    } finally {
        await prismaSqlite.$disconnect();
        await pgClient.end();
    }
}

migrateData()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });

