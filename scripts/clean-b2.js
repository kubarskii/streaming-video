const { S3Client, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const client = new S3Client({
    endpoint: process.env.B2_ENDPOINT,
    region: process.env.B2_REGION,
    credentials: {
        accessKeyId: process.env.B2_KEY_ID,
        secretAccessKey: process.env.B2_KEY_SECRET,
    },
});

async function cleanB2() {
    console.log('🧹 Cleaning B2 bucket...\n');

    try {
        // List all objects
        const listCommand = new ListObjectsV2Command({
            Bucket: process.env.B2_BUCKET,
        });
        const listResult = await client.send(listCommand);

        const files = listResult.Contents || [];
        console.log(`Found ${files.length} file(s) in bucket\n`);

        // Delete each file
        for (const file of files) {
            console.log(`Deleting: ${file.Key}`);
            const deleteCommand = new DeleteObjectCommand({
                Bucket: process.env.B2_BUCKET,
                Key: file.Key,
            });
            await client.send(deleteCommand);
        }

        console.log(`\n✅ Cleaned ${files.length} file(s) from B2!`);
    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

cleanB2();

