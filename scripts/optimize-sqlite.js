#!/usr/bin/env node
/**
 * Optimize SQLite for production use
 * Enables WAL mode, sets optimal pragmas
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function optimizeSQLite() {
    const dbUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db';
    const dbPath = dbUrl.replace('file:', '');

    console.log('⚙️  Optimizing SQLite for production...\n');
    console.log(`Database: ${dbPath}\n`);

    const pragmas = [
        // Enable WAL mode for better concurrency and crash recovery
        { cmd: 'PRAGMA journal_mode=WAL;', desc: 'Enable WAL mode' },

        // Optimize performance
        { cmd: 'PRAGMA synchronous=NORMAL;', desc: 'Set synchronous mode' },
        { cmd: 'PRAGMA cache_size=-64000;', desc: 'Set cache to 64MB' },
        { cmd: 'PRAGMA temp_store=MEMORY;', desc: 'Use memory for temp storage' },
        { cmd: 'PRAGMA mmap_size=268435456;', desc: 'Enable memory-mapped I/O (256MB)' },

        // Auto-vacuum to prevent database bloat
        { cmd: 'PRAGMA auto_vacuum=FULL;', desc: 'Enable auto-vacuum' },

        // Foreign keys enforcement
        { cmd: 'PRAGMA foreign_keys=ON;', desc: 'Enable foreign keys' },
    ];

    try {
        // Check if sqlite3 CLI is available
        try {
            await execAsync('which sqlite3 || command -v sqlite3');
        } catch (checkError) {
            console.warn('⚠️  sqlite3 CLI not found. Skipping optimization.');
            console.warn('   Database will still work, but some optimizations will be skipped.');
            console.warn('   To enable optimization, ensure sqlite3 CLI is installed.');
            return; // Exit gracefully if sqlite3 CLI is not available
        }

        for (const { cmd, desc } of pragmas) {
            const { stdout } = await execAsync(`sqlite3 ${dbPath} "${cmd}"`);
            console.log(`✅ ${desc}`);
            if (stdout.trim()) {
                console.log(`   Result: ${stdout.trim()}`);
            }
        }

        console.log('\n✅ SQLite optimization complete!\n');
        console.log('📝 WAL mode benefits:');
        console.log('   • Better concurrency (readers don\'t block writers)');
        console.log('   • Improved crash recovery');
        console.log('   • Reduced database corruption risk');
        console.log('   • Faster performance\n');

    } catch (error) {
        console.error('❌ Error optimizing database:');
        console.error(error.message);
        // Don't throw - allow deployment to continue even if optimization fails
        console.warn('⚠️  Continuing deployment despite optimization failure...');
    }
}

optimizeSQLite()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });

