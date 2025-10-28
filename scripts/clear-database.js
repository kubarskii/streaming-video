// Clear all videos from database
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearDatabase() {
    console.log('🗑️  Clearing database...');

    const deleted = await prisma.video.deleteMany({});

    console.log(`✅ Deleted ${deleted.count} video(s)`);

    await prisma.$disconnect();
}

clearDatabase().catch(console.error);

