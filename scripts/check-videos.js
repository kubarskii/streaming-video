// @ts-check
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkVideos() {
    const videos = await prisma.video.findMany();
    console.log('Videos in database:');
    videos.forEach(video => {
        console.log('---');
        console.log('ID:', video.id);
        console.log('Title:', video.title);
        console.log('Storage Key:', video.storageKey);
        console.log('Storage URL:', video.storageUrl);
        console.log('CDN URL:', video.cdnUrl);
        console.log('Thumbnail URL:', video.thumbnailUrl);
    });
    await prisma.$disconnect();
}

checkVideos();

