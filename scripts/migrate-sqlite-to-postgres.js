#!/usr/bin/env node
/**
 * Migrate data from SQLite to PostgreSQL
 * 
 * This script exports data from SQLite and generates SQL INSERT statements
 * that can be used to import data into PostgreSQL.
 * 
 * Usage:
 *   1. Ensure your SQLite DATABASE_URL is set in .env
 *   2. Run: node scripts/migrate-sqlite-to-postgres.js
 *   3. The script will generate: data-export.sql
 *   4. Apply to PostgreSQL: psql $DATABASE_URL -f data-export.sql
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Initialize Prisma with SQLite
const prisma = new PrismaClient();

// Helper to escape SQL strings
function escapeSqlString(str) {
    if (str === null || str === undefined) return 'NULL';
    if (typeof str === 'boolean') return str ? 'TRUE' : 'FALSE';
    if (typeof str === 'number' || typeof str === 'bigint') return str.toString();
    return `'${str.toString().replace(/'/g, "''")}'`;
}

// Helper to format date for PostgreSQL
function formatDate(date) {
    if (!date) return 'NULL';
    return `'${date.toISOString()}'`;
}

async function exportData() {
    console.log('🔄 Starting data export from SQLite...\n');

    const sqlStatements = [];
    sqlStatements.push('-- SQLite to PostgreSQL Data Migration');
    sqlStatements.push('-- Generated: ' + new Date().toISOString());
    sqlStatements.push('');
    sqlStatements.push('BEGIN;');
    sqlStatements.push('');

    try {
        // Export Users
        console.log('📦 Exporting Users...');
        const users = await prisma.user.findMany();
        console.log(`   Found ${users.length} users`);

        if (users.length > 0) {
            sqlStatements.push('-- Users');
            for (const user of users) {
                sqlStatements.push(
                    `INSERT INTO "User" (id, email, username, "passwordHash", "createdAt", "updatedAt") ` +
                    `VALUES (${escapeSqlString(user.id)}, ${escapeSqlString(user.email)}, ` +
                    `${escapeSqlString(user.username)}, ${escapeSqlString(user.passwordHash)}, ` +
                    `${formatDate(user.createdAt)}, ${formatDate(user.updatedAt)});`
                );
            }
            sqlStatements.push('');
        }

        // Export Channels
        console.log('📦 Exporting Channels...');
        const channels = await prisma.channel.findMany();
        console.log(`   Found ${channels.length} channels`);

        if (channels.length > 0) {
            sqlStatements.push('-- Channels');
            for (const channel of channels) {
                sqlStatements.push(
                    `INSERT INTO "Channel" (id, "userId", name, description, "avatarUrl", "bannerUrl", ` +
                    `"subscriberCount", "videoCount", "createdAt", "updatedAt") ` +
                    `VALUES (${escapeSqlString(channel.id)}, ${escapeSqlString(channel.userId)}, ` +
                    `${escapeSqlString(channel.name)}, ${escapeSqlString(channel.description)}, ` +
                    `${escapeSqlString(channel.avatarUrl)}, ${escapeSqlString(channel.bannerUrl)}, ` +
                    `${channel.subscriberCount}, ${channel.videoCount}, ` +
                    `${formatDate(channel.createdAt)}, ${formatDate(channel.updatedAt)});`
                );
            }
            sqlStatements.push('');
        }

        // Export Subscriptions
        console.log('📦 Exporting Subscriptions...');
        const subscriptions = await prisma.subscription.findMany();
        console.log(`   Found ${subscriptions.length} subscriptions`);

        if (subscriptions.length > 0) {
            sqlStatements.push('-- Subscriptions');
            for (const sub of subscriptions) {
                sqlStatements.push(
                    `INSERT INTO "Subscription" (id, "userId", "channelId", "subscribedAt") ` +
                    `VALUES (${escapeSqlString(sub.id)}, ${escapeSqlString(sub.userId)}, ` +
                    `${escapeSqlString(sub.channelId)}, ${formatDate(sub.subscribedAt)});`
                );
            }
            sqlStatements.push('');
        }

        // Export Videos
        console.log('📦 Exporting Videos...');
        const videos = await prisma.video.findMany();
        console.log(`   Found ${videos.length} videos`);

        if (videos.length > 0) {
            sqlStatements.push('-- Videos');
            for (const video of videos) {
                sqlStatements.push(
                    `INSERT INTO "Video" (id, title, description, "fileName", "storageKey", "storageUrl", ` +
                    `"cdnUrl", "mimeType", "sizeBytes", "durationMs", width, height, status, ` +
                    `"uploadedAt", "updatedAt", "userId", "thumbnailUrl", views) ` +
                    `VALUES (${escapeSqlString(video.id)}, ${escapeSqlString(video.title)}, ` +
                    `${escapeSqlString(video.description)}, ${escapeSqlString(video.fileName)}, ` +
                    `${escapeSqlString(video.storageKey)}, ${escapeSqlString(video.storageUrl)}, ` +
                    `${escapeSqlString(video.cdnUrl)}, ${escapeSqlString(video.mimeType)}, ` +
                    `${video.sizeBytes}, ${video.durationMs || 'NULL'}, ${video.width || 'NULL'}, ` +
                    `${video.height || 'NULL'}, ${escapeSqlString(video.status)}, ` +
                    `${formatDate(video.uploadedAt)}, ${formatDate(video.updatedAt)}, ` +
                    `${escapeSqlString(video.userId)}, ${escapeSqlString(video.thumbnailUrl)}, ${video.views});`
                );
            }
            sqlStatements.push('');
        }

        // Export VideoQuality
        console.log('📦 Exporting Video Qualities...');
        const qualities = await prisma.videoQuality.findMany();
        console.log(`   Found ${qualities.length} video qualities`);

        if (qualities.length > 0) {
            sqlStatements.push('-- Video Qualities');
            for (const quality of qualities) {
                sqlStatements.push(
                    `INSERT INTO "VideoQuality" (id, "videoId", quality, "storageKey", "storageUrl", ` +
                    `"cdnUrl", width, height, "sizeBytes", bitrate, status, "createdAt", "updatedAt") ` +
                    `VALUES (${escapeSqlString(quality.id)}, ${escapeSqlString(quality.videoId)}, ` +
                    `${escapeSqlString(quality.quality)}, ${escapeSqlString(quality.storageKey)}, ` +
                    `${escapeSqlString(quality.storageUrl)}, ${escapeSqlString(quality.cdnUrl)}, ` +
                    `${quality.width}, ${quality.height}, ${quality.sizeBytes}, ${quality.bitrate || 'NULL'}, ` +
                    `${escapeSqlString(quality.status)}, ${formatDate(quality.createdAt)}, ` +
                    `${formatDate(quality.updatedAt)});`
                );
            }
            sqlStatements.push('');
        }

        // Export Comments
        console.log('📦 Exporting Comments...');
        const comments = await prisma.comment.findMany();
        console.log(`   Found ${comments.length} comments`);

        if (comments.length > 0) {
            sqlStatements.push('-- Comments');
            for (const comment of comments) {
                sqlStatements.push(
                    `INSERT INTO "Comment" (id, "videoId", "userId", content, "createdAt", "updatedAt") ` +
                    `VALUES (${escapeSqlString(comment.id)}, ${escapeSqlString(comment.videoId)}, ` +
                    `${escapeSqlString(comment.userId)}, ${escapeSqlString(comment.content)}, ` +
                    `${formatDate(comment.createdAt)}, ${formatDate(comment.updatedAt)});`
                );
            }
            sqlStatements.push('');
        }

        // Export VideoLikes
        console.log('📦 Exporting Video Likes...');
        const likes = await prisma.videoLike.findMany();
        console.log(`   Found ${likes.length} video likes`);

        if (likes.length > 0) {
            sqlStatements.push('-- Video Likes');
            for (const like of likes) {
                sqlStatements.push(
                    `INSERT INTO "VideoLike" (id, "videoId", "userId", "isLike", "createdAt", "updatedAt") ` +
                    `VALUES (${escapeSqlString(like.id)}, ${escapeSqlString(like.videoId)}, ` +
                    `${escapeSqlString(like.userId)}, ${like.isLike ? 'TRUE' : 'FALSE'}, ` +
                    `${formatDate(like.createdAt)}, ${formatDate(like.updatedAt)});`
                );
            }
            sqlStatements.push('');
        }

        // Export Playlists
        console.log('📦 Exporting Playlists...');
        const playlists = await prisma.playlist.findMany();
        console.log(`   Found ${playlists.length} playlists`);

        if (playlists.length > 0) {
            sqlStatements.push('-- Playlists');
            for (const playlist of playlists) {
                sqlStatements.push(
                    `INSERT INTO "Playlist" (id, title, description, "isPublic", slug, "createdAt", "updatedAt", "userId") ` +
                    `VALUES (${escapeSqlString(playlist.id)}, ${escapeSqlString(playlist.title)}, ` +
                    `${escapeSqlString(playlist.description)}, ${playlist.isPublic ? 'TRUE' : 'FALSE'}, ` +
                    `${escapeSqlString(playlist.slug)}, ${formatDate(playlist.createdAt)}, ` +
                    `${formatDate(playlist.updatedAt)}, ${escapeSqlString(playlist.userId)});`
                );
            }
            sqlStatements.push('');
        }

        // Export PlaylistVideos
        console.log('📦 Exporting Playlist Videos...');
        const playlistVideos = await prisma.playlistVideo.findMany();
        console.log(`   Found ${playlistVideos.length} playlist videos`);

        if (playlistVideos.length > 0) {
            sqlStatements.push('-- Playlist Videos');
            for (const pv of playlistVideos) {
                sqlStatements.push(
                    `INSERT INTO "PlaylistVideo" (id, "playlistId", "videoId", position, "addedAt") ` +
                    `VALUES (${escapeSqlString(pv.id)}, ${escapeSqlString(pv.playlistId)}, ` +
                    `${escapeSqlString(pv.videoId)}, ${pv.position}, ${formatDate(pv.addedAt)});`
                );
            }
            sqlStatements.push('');
        }

        // Export UploadSessions
        console.log('📦 Exporting Upload Sessions...');
        const sessions = await prisma.uploadSession.findMany();
        console.log(`   Found ${sessions.length} upload sessions`);

        if (sessions.length > 0) {
            sqlStatements.push('-- Upload Sessions');
            for (const session of sessions) {
                sqlStatements.push(
                    `INSERT INTO "UploadSession" (id, "userId", "fileName", "fileSize", "mimeType", ` +
                    `"totalChunks", "uploadedChunks", metadata, status, "createdAt", "expiresAt") ` +
                    `VALUES (${escapeSqlString(session.id)}, ${escapeSqlString(session.userId)}, ` +
                    `${escapeSqlString(session.fileName)}, ${session.fileSize}, ${escapeSqlString(session.mimeType)}, ` +
                    `${session.totalChunks}, ${escapeSqlString(session.uploadedChunks)}, ` +
                    `${escapeSqlString(session.metadata)}, ${escapeSqlString(session.status)}, ` +
                    `${formatDate(session.createdAt)}, ${formatDate(session.expiresAt)});`
                );
            }
            sqlStatements.push('');
        }

        sqlStatements.push('COMMIT;');
        sqlStatements.push('');
        sqlStatements.push('-- Migration complete!');

        // Write to file
        const outputFile = path.join(process.cwd(), 'data-export.sql');
        fs.writeFileSync(outputFile, sqlStatements.join('\n'));

        console.log('\n✅ Data export complete!');
        console.log(`📄 Output file: ${outputFile}`);
        console.log('\n📝 Next steps:');
        console.log('   1. Set up PostgreSQL database on Railway');
        console.log('   2. Get the PostgreSQL DATABASE_URL from Railway');
        console.log('   3. Run migrations: npx prisma migrate deploy');
        console.log('   4. Import data: psql $DATABASE_URL -f data-export.sql');
        console.log('   5. Verify data integrity\n');

    } catch (error) {
        console.error('❌ Error during export:');
        console.error(error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run export
exportData()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });

