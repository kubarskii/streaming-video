#!/usr/bin/env node
/**
 * Import data from SQL file to PostgreSQL
 * Usage: node scripts/import-data.js data-export.sql
 */

require('dotenv').config();

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function importData() {
    const sqlFile = process.argv[2] || 'data-export.sql';
    const sqlFilePath = path.join(process.cwd(), sqlFile);

    if (!fs.existsSync(sqlFilePath)) {
        console.error(`❌ File not found: ${sqlFilePath}`);
        process.exit(1);
    }

    console.log(`📂 Reading SQL file: ${sqlFile}`);
    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    console.log(`🔗 Connecting to PostgreSQL...`);
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('✅ Connected to PostgreSQL\n');

        console.log('📥 Importing data...');
        await client.query(sql);

        console.log('✅ Data imported successfully!\n');

        // Verify import
        console.log('🔍 Verifying data:');
        const tables = [
            'User', 'Channel', 'Subscription', 'Video',
            'VideoQuality', 'Comment', 'VideoLike',
            'Playlist', 'PlaylistVideo', 'UploadSession'
        ];

        for (const table of tables) {
            try {
                const result = await client.query(`SELECT COUNT(*) FROM "${table}"`);
                console.log(`   ${table}: ${result.rows[0].count} rows`);
            } catch (err) {
                console.log(`   ${table}: Table exists but may be empty`);
            }
        }

        console.log('\n🎉 Import complete!');

    } catch (error) {
        console.error('❌ Error importing data:');
        console.error(error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

importData();

