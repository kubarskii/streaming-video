// @ts-check
const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
require('dotenv').config();

const client = new S3Client({
    endpoint: process.env.B2_ENDPOINT,
    region: process.env.B2_REGION,
    credentials: {
        accessKeyId: process.env.B2_KEY_ID,
        secretAccessKey: process.env.B2_KEY_SECRET,
    },
});

async function testB2() {
    console.log('🔍 Testing B2 Connection...\n');
    console.log('Configuration:');
    console.log('- Endpoint:', process.env.B2_ENDPOINT);
    console.log('- Region:', process.env.B2_REGION);
    console.log('- Bucket:', process.env.B2_BUCKET);
    console.log('- Key ID:', process.env.B2_KEY_ID?.substring(0, 10) + '...\n');

    try {
        // Test 1: List objects
        console.log('📋 Test 1: Listing objects in bucket...');
        const listCommand = new ListObjectsV2Command({
            Bucket: process.env.B2_BUCKET,
            MaxKeys: 5,
        });
        const listResult = await client.send(listCommand);
        console.log('✅ List successful! Files:', (listResult.Contents || []).length);

        // Test 2: Upload a test file
        console.log('\n📤 Test 2: Uploading test file...');
        const testContent = 'Hello from B2 test!';
        const uploadCommand = new PutObjectCommand({
            Bucket: process.env.B2_BUCKET,
            Key: 'test-' + Date.now() + '.txt',
            Body: Buffer.from(testContent),
            ContentType: 'text/plain',
        });
        await client.send(uploadCommand);
        console.log('✅ Upload successful!');

        console.log('\n🎉 B2 is working correctly!');
    } catch (error) {
        console.error('\n❌ B2 Error:', error.message);
        console.error('Details:', error);
    }
}

testB2();

