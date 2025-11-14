// @ts-check
// Test script to verify all services are running and healthy

const http = require('http');

const SERVICES = [
    { name: 'social', port: 3002 },
    { name: 'channel', port: 3004 },
    { name: 'playlist', port: 3005 },
    { name: 'upload', port: 3001 },
    { name: 'streaming', port: 3003 },
    { name: 'gateway', port: 3000 }
];

function testHealthCheck(serviceName, port) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}/health/quick`, { timeout: 5000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve({ 
                        service: serviceName, 
                        port, 
                        status: res.statusCode, 
                        healthy: result.status === 'healthy',
                        data: result
                    });
                } catch (e) {
                    resolve({ 
                        service: serviceName, 
                        port, 
                        status: res.statusCode, 
                        healthy: false, 
                        error: 'Invalid JSON',
                        raw: data.substring(0, 100)
                    });
                }
            });
        });

        req.on('error', (err) => {
            resolve({ 
                service: serviceName, 
                port, 
                healthy: false, 
                error: err.message,
                code: err.code
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ 
                service: serviceName, 
                port, 
                healthy: false, 
                error: 'Timeout' 
            });
        });
    });
}

function testRoute(gatewayPort, path, expectedService) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${gatewayPort}${path}`, { timeout: 3000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({ 
                    path,
                    expectedService,
                    status: res.statusCode,
                    routed: true,
                    note: res.statusCode === 401 ? 'Auth required (expected)' : 
                          res.statusCode === 404 ? 'Not found' : 
                          res.statusCode === 503 ? 'Service unavailable' : 'OK'
                });
            });
        });

        req.on('error', (err) => {
            resolve({ 
                path,
                expectedService,
                routed: false,
                error: err.message,
                code: err.code
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ 
                path,
                expectedService,
                routed: false,
                error: 'Timeout'
            });
        });
    });
}

async function runTests() {
    console.log('🧪 Testing All Services\n');
    console.log('='.repeat(60));

    // Test 1: Health Checks
    console.log('\n📋 Test 1: Health Checks\n');
    const healthResults = [];
    for (const service of SERVICES) {
        const result = await testHealthCheck(service.name, service.port);
        healthResults.push(result);
        
        if (result.healthy) {
            console.log(`✅ ${service.name.padEnd(12)} (port ${service.port}): Healthy`);
        } else {
            const errorMsg = result.error || 'Unknown error';
            const codeMsg = result.code ? ` (${result.code})` : '';
            console.log(`❌ ${service.name.padEnd(12)} (port ${service.port}): ${errorMsg}${codeMsg}`);
            if (result.raw) {
                console.log(`   Response: ${result.raw}`);
            }
        }
    }

    // Test 2: Gateway Routing (if gateway is healthy)
    const gatewayHealth = healthResults.find(r => r.service === 'gateway');
    if (gatewayHealth && gatewayHealth.healthy) {
        console.log('\n📋 Test 2: Gateway Routing\n');
        
        const routingTests = [
            { path: '/api/channels', expected: 'channel' },
            { path: '/api/playlists', expected: 'playlist' },
            { path: '/api/comments', expected: 'social' },
            { path: '/api/subscriptions', expected: 'social' },
            { path: '/api/videos/test-id/like', expected: 'social' },
            { path: '/api/videos', expected: 'upload' },
            { path: '/api/upload/init', expected: 'upload' }
        ];

        for (const test of routingTests) {
            const result = await testRoute(3000, test.path, test.expected);
            if (result.routed) {
                const status = result.status === 401 ? '✅' : result.status === 404 ? '⚠️' : '✅';
                console.log(`${status} ${test.path.padEnd(35)} → ${test.expected.padEnd(10)} (${result.status} - ${result.note})`);
            } else {
                console.log(`❌ ${test.path.padEnd(35)} → ${test.expected.padEnd(10)} (${result.error})`);
            }
        }
    } else {
        console.log('\n⚠️  Skipping routing tests - Gateway not healthy');
    }

    // Test 3: Service-specific endpoints
    console.log('\n📋 Test 3: Service-Specific Endpoints\n');
    
    // Test social service endpoints
    const socialHealth = healthResults.find(r => r.service === 'social');
    if (socialHealth && socialHealth.healthy) {
        const socialTests = [
            { path: '/api/comments', method: 'GET' },
            { path: '/api/subscriptions', method: 'GET' }
        ];
        for (const test of socialTests) {
            const result = await testRoute(3002, test.path, 'social');
            console.log(`   ${test.path}: ${result.status || 'N/A'} ${result.note || result.error || ''}`);
        }
    }

    // Test channel service endpoints
    const channelHealth = healthResults.find(r => r.service === 'channel');
    if (channelHealth && channelHealth.healthy) {
        const result = await testRoute(3004, '/api/channels', 'channel');
        console.log(`   /api/channels: ${result.status || 'N/A'} ${result.note || result.error || ''}`);
    }

    // Test playlist service endpoints
    const playlistHealth = healthResults.find(r => r.service === 'playlist');
    if (playlistHealth && playlistHealth.healthy) {
        const result = await testRoute(3005, '/api/playlists', 'playlist');
        console.log(`   /api/playlists: ${result.status || 'N/A'} ${result.note || result.error || ''}`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Test Summary\n');
    
    const healthyCount = healthResults.filter(r => r.healthy).length;
    const unhealthyCount = healthResults.filter(r => !r.healthy).length;
    
    console.log(`✅ Healthy Services: ${healthyCount}/${SERVICES.length}`);
    console.log(`❌ Unhealthy Services: ${unhealthyCount}/${SERVICES.length}`);
    
    if (unhealthyCount > 0) {
        console.log('\n❌ Unhealthy Services:');
        healthResults
            .filter(r => !r.healthy)
            .forEach(r => {
                console.log(`   - ${r.service} (port ${r.port}): ${r.error || 'Unknown error'}`);
            });
    }

    // Exit with appropriate code
    process.exit(unhealthyCount > 0 ? 1 : 0);
}

runTests().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
});

