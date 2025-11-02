#!/usr/bin/env node
/**
 * Clear all data from PostgreSQL database (keep schema)
 * This truncates all tables but preserves the structure
 */

require('dotenv').config();
const { Client } = require('pg');

async function clearData() {
    const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;

    if (!postgresUrl) {
        console.error('❌ POSTGRES_URL or DATABASE_URL environment variable is required!');
        process.exit(1);
    }

    console.log('🗑️  Clearing all data from PostgreSQL...\n');
    console.log('📍 Database:', postgresUrl.replace(/:[^:@]+@/, ':****@'), '\n');

    const client = new Client({ connectionString: postgresUrl });

    try {
        await client.connect();
        console.log('✅ Connected to PostgreSQL\n');

        // Tables in order (respecting foreign key dependencies)
        const tables = [
            'PlaylistVideo',
            'VideoLike',
            'Comment',
            'VideoQuality',
            'Video',
            'Playlist',
            'Subscription',
            'Channel',
            'UploadSession',
            'User'
        ];

        console.log('🧹 Truncating tables...\n');

        // Use TRUNCATE CASCADE to handle foreign key constraints
        for (const table of tables) {
            try {
                await client.query(`TRUNCATE TABLE "${table}" CASCADE;`);
                console.log(`   ✓ ${table}`);
            } catch (err) {
                console.log(`   ✗ ${table}: ${err.message}`);
            }
        }

        // Verify tables are empty
        console.log('\n🔍 Verifying...\n');
        for (const table of tables) {
            const result = await client.query(`SELECT COUNT(*) FROM "${table}"`);
            console.log(`   ${table.padEnd(20)} ${result.rows[0].count} rows`);
        }

        console.log('\n✅ All data cleared! Schema remains intact.\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

clearData();

