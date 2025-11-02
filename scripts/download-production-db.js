#!/usr/bin/env node
/**
 * Download production SQLite database
 * Run this on Railway to get the database file
 */

const fs = require('fs');
const path = require('path');

const dbPath = '/app/data/dev.db';
const outputPath = process.argv[2] || 'production.db';

try {
    console.log(`📂 Reading database from: ${dbPath}`);
    const data = fs.readFileSync(dbPath);

    // Output to stdout as base64 so it can be captured
    console.log('DATABASE_START');
    process.stdout.write(data.toString('base64'));
    console.log('\nDATABASE_END');

    console.log(`✅ Database size: ${(data.length / 1024 / 1024).toFixed(2)} MB`);
} catch (error) {
    console.error('❌ Error reading database:', error.message);
    process.exit(1);
}

