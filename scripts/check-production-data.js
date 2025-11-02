#!/usr/bin/env node
/**
 * Check what data exists in production SQLite database
 */

const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

const dbPath = process.env.SQLITE_PATH || '/app/data/dev.db';

async function checkData() {
    console.log(`📂 Opening database: ${dbPath}\n`);

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error('❌ Error opening database:', err.message);
            process.exit(1);
        }
    });

    const all = promisify(db.all.bind(db));

    try {
        const tables = [
            'User', 'Channel', 'Subscription', 'Video',
            'VideoQuality', 'Comment', 'VideoLike',
            'Playlist', 'PlaylistVideo', 'UploadSession'
        ];

        console.log('📊 Production Database Contents:\n');

        for (const table of tables) {
            try {
                const result = await all(`SELECT COUNT(*) as count FROM "${table}"`);
                const count = result[0].count;
                console.log(`   ${table.padEnd(20)} ${count} rows`);
            } catch (err) {
                console.log(`   ${table.padEnd(20)} Error: ${err.message}`);
            }
        }

        // Show some sample data
        console.log('\n📝 Sample Data:\n');

        const users = await all('SELECT id, username, email FROM User LIMIT 3');
        console.log('   Users:', users.map(u => u.username).join(', ') || 'None');

        const videos = await all('SELECT id, title FROM Video LIMIT 3');
        console.log('   Videos:', videos.map(v => v.title).join(', ') || 'None');

        console.log('\n✅ Database check complete!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        db.close();
    }
}

checkData();

