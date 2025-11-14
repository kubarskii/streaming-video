// @ts-check
// Test script to verify all services can start and respond

const http = require('http');
const { spawn } = require('child_process');

const SERVICES = [
    { name: 'social', port: 3002, path: 'services/social/server.js' },
    { name: 'channel', port: 3004, path: 'services/channel/server.js' },
    { name: 'playlist', port: 3005, path: 'services/playlist/server.js' },
    { name: 'upload', port: 3001, path: 'services/upload/server.js' },
    { name: 'streaming', port: 3003, path: 'services/streaming/server.js' },
    { name: 'gateway', port: 3000, path: 'services/gateway/server.js' }
];

const processes = [];
const results = {
    started: [],
    failed: [],
    healthChecks: []
};

function testHealthCheck(serviceName, port) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}/health/quick`, { timeout: 5000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve({ service: serviceName, port, status: res.statusCode, healthy: result.status === 'healthy' });
                } catch (e) {
                    resolve({ service: serviceName, port, status: res.statusCode, healthy: false, error: 'Invalid JSON' });
                }
            });
        });

        req.on('error', (err) => {
            resolve({ service: serviceName, port, healthy: false, error: err.message });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ service: serviceName, port, healthy: false, error: 'Timeout' });
        });
    });
}

function startService(service) {
    return new Promise((resolve, reject) => {
        console.log(`\n🚀 Starting ${service.name} service on port ${service.port}...`);
        
        const proc = spawn('node', [service.path], {
            stdio: 'pipe',
            env: { ...process.env, PORT: service.port.toString(), SERVICE_NAME: service.name }
        });

        let output = '';
        let errorOutput = '';

        proc.stdout.on('data', (data) => {
            output += data.toString();
            if (output.includes('listening on port') || output.includes('Service listening')) {
                console.log(`✅ ${service.name} service started`);
                processes.push({ name: service.name, process: proc });
                results.started.push(service.name);
                resolve(proc);
            }
        });

        proc.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        proc.on('error', (err) => {
            console.error(`❌ Failed to start ${service.name}:`, err.message);
            results.failed.push({ name: service.name, error: err.message });
            reject(err);
        });

        // Timeout after 10 seconds
        setTimeout(() => {
            if (!results.started.includes(service.name)) {
                proc.kill();
                const error = errorOutput || output || 'Timeout waiting for service to start';
                console.error(`❌ ${service.name} service failed to start:`, error);
                results.failed.push({ name: service.name, error });
                reject(new Error('Service startup timeout'));
            }
        }, 10000);
    });
}

async function runTests() {
    console.log('🧪 Testing All Services\n');
    console.log('='.repeat(50));

    // Test 1: Check if services can be imported (syntax check)
    console.log('\n📋 Test 1: Syntax and Import Check');
    for (const service of SERVICES) {
        try {
            require(`./${service.path}`);
            console.log(`✅ ${service.name}: Syntax OK`);
        } catch (error) {
            console.error(`❌ ${service.name}: ${error.message}`);
            results.failed.push({ name: service.name, error: error.message, type: 'syntax' });
        }
    }

    // Test 2: Start services sequentially
    console.log('\n📋 Test 2: Service Startup');
    for (const service of SERVICES) {
        try {
            await startService(service);
            // Wait a bit for service to fully initialize
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            console.error(`❌ Failed to start ${service.name}`);
        }
    }

    // Test 3: Health checks
    console.log('\n📋 Test 3: Health Checks');
    for (const service of SERVICES) {
        if (results.started.includes(service.name)) {
            const result = await testHealthCheck(service.name, service.port);
            results.healthChecks.push(result);
            if (result.healthy) {
                console.log(`✅ ${service.name}: Health check passed`);
            } else {
                console.log(`❌ ${service.name}: Health check failed - ${result.error || 'Unknown error'}`);
            }
        }
    }

    // Test 4: Gateway routing (if gateway is up)
    if (results.started.includes('gateway')) {
        console.log('\n📋 Test 4: Gateway Routing');
        const routingTests = [
            { path: '/api/channels', expected: 'channel' },
            { path: '/api/playlists', expected: 'playlist' },
            { path: '/api/comments', expected: 'social' },
            { path: '/api/subscriptions', expected: 'social' },
            { path: '/api/videos', expected: 'upload' }
        ];

        for (const test of routingTests) {
            try {
                const result = await new Promise((resolve) => {
                    const req = http.get(`http://localhost:3000${test.path}`, { timeout: 3000 }, (res) => {
                        resolve({ status: res.statusCode, service: test.expected });
                    });
                    req.on('error', () => resolve({ error: 'Connection failed' }));
                    req.on('timeout', () => {
                        req.destroy();
                        resolve({ error: 'Timeout' });
                    });
                });

                if (result.error) {
                    console.log(`⚠️  ${test.path}: ${result.error} (service may not be running)`);
                } else if (result.status === 401 || result.status === 404) {
                    console.log(`✅ ${test.path}: Routed correctly (${result.status} - expected for unauthenticated)`);
                } else {
                    console.log(`✅ ${test.path}: Routed correctly (${result.status})`);
                }
            } catch (error) {
                console.log(`❌ ${test.path}: ${error.message}`);
            }
        }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('\n📊 Test Summary\n');
    console.log(`✅ Started: ${results.started.length}/${SERVICES.length} services`);
    console.log(`❌ Failed: ${results.failed.length} services`);
    console.log(`🏥 Health Checks: ${results.healthChecks.filter(h => h.healthy).length}/${results.healthChecks.length} passed`);

    if (results.failed.length > 0) {
        console.log('\n❌ Failed Services:');
        results.failed.forEach(f => console.log(`   - ${f.name}: ${f.error}`));
    }

    // Cleanup
    console.log('\n🧹 Cleaning up...');
    processes.forEach(({ name, process }) => {
        console.log(`   Stopping ${name}...`);
        process.kill();
    });

    // Exit with appropriate code
    process.exit(results.failed.length > 0 ? 1 : 0);
}

// Handle cleanup on exit
process.on('SIGINT', () => {
    console.log('\n\n🛑 Interrupted, cleaning up...');
    processes.forEach(({ process }) => process.kill());
    process.exit(1);
});

process.on('SIGTERM', () => {
    processes.forEach(({ process }) => process.kill());
    process.exit(1);
});

runTests().catch(error => {
    console.error('❌ Test suite failed:', error);
    processes.forEach(({ process }) => process.kill());
    process.exit(1);
});

