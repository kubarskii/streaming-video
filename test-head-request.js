// Test HEAD request support for iOS Safari video seeking
const http = require('http');

// Test HEAD request
const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/video?file=test.mp4', // Replace with actual video file
    method: 'HEAD',
};

console.log('Testing HEAD request support for iOS Safari...');
console.log(`URL: http://${options.hostname}:${options.port}${options.path}`);

const req = http.request(options, (res) => {
    console.log('\n✅ HEAD Request Response:');
    console.log(`Status: ${res.statusCode}`);
    console.log('Headers:');
    console.log(`  Content-Type: ${res.headers['content-type']}`);
    console.log(`  Content-Length: ${res.headers['content-length']}`);
    console.log(`  Accept-Ranges: ${res.headers['accept-ranges']}`);
    console.log(`  Access-Control-Allow-Methods: ${res.headers['access-control-allow-methods']}`);

    if (res.statusCode === 200 && res.headers['accept-ranges'] === 'bytes' && res.headers['content-length']) {
        console.log('\n✅ iOS Safari video seeking should work!');
    } else {
        console.log('\n❌ Missing required headers for iOS Safari seeking');
    }
});

req.on('error', (e) => {
    console.error(`❌ Error: ${e.message}`);
    console.log('\nMake sure:');
    console.log('1. Server is running (npm start)');
    console.log('2. You have at least one video uploaded');
    console.log('3. Replace test.mp4 with actual video filename');
});

req.end();

