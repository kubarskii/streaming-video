// @ts-check
// Validate code structure and imports for all services

const fs = require('fs');
const path = require('path');

const SERVICES = [
    { name: 'social', file: 'services/social/server.js', router: 'services/social/router.js' },
    { name: 'channel', file: 'services/channel/server.js', router: 'services/channel/router.js' },
    { name: 'playlist', file: 'services/playlist/server.js', router: 'services/playlist/router.js' },
    { name: 'upload', file: 'services/upload/server.js', router: 'services/upload/router.js' },
    { name: 'streaming', file: 'services/streaming/server.js', router: 'services/streaming/router.js' },
    { name: 'gateway', file: 'services/gateway/server.js' }
];

const results = {
    passed: [],
    failed: []
};

function validateService(service) {
    const errors = [];
    
    // Check if files exist
    if (!fs.existsSync(service.file)) {
        errors.push(`Main file not found: ${service.file}`);
    }
    
    if (service.router && !fs.existsSync(service.router)) {
        errors.push(`Router file not found: ${service.router}`);
    }
    
    // Try to require the file (syntax check)
    if (fs.existsSync(service.file)) {
        try {
            // Clear require cache to test fresh
            delete require.cache[require.resolve(path.resolve(service.file))];
            require(path.resolve(service.file));
        } catch (error) {
            errors.push(`Syntax/Import error: ${error.message}`);
        }
    }
    
    // Check router if it exists
    if (service.router && fs.existsSync(service.router)) {
        try {
            delete require.cache[require.resolve(path.resolve(service.router))];
            require(path.resolve(service.router));
        } catch (error) {
            errors.push(`Router error: ${error.message}`);
        }
    }
    
    return errors;
}

function checkGatewayRouting() {
    const errors = [];
    const gatewayFile = 'services/gateway/server.js';
    
    if (!fs.existsSync(gatewayFile)) {
        return ['Gateway file not found'];
    }
    
    try {
        const content = fs.readFileSync(gatewayFile, 'utf8');
        
        // Check for proxy middleware creation
        const requiredProxies = ['socialProxy', 'channelProxy', 'playlistProxy'];
        for (const proxy of requiredProxies) {
            if (!content.includes(proxy)) {
                errors.push(`Missing proxy: ${proxy}`);
            }
        }
        
        // Check for routing to new services
        const requiredRoutes = [
            { path: '/api/channels', service: 'channel' },
            { path: '/api/playlists', service: 'playlist' },
            { path: '/api/comments', service: 'social' },
            { path: '/api/subscriptions', service: 'social' }
        ];
        
        for (const route of requiredRoutes) {
            if (!content.includes(`channelProxy`) && route.service === 'channel') {
                errors.push(`Missing routing for ${route.path} to ${route.service}`);
            }
            if (!content.includes(`playlistProxy`) && route.service === 'playlist') {
                errors.push(`Missing routing for ${route.path} to ${route.service}`);
            }
            if (!content.includes(`socialProxy`) && route.service === 'social') {
                errors.push(`Missing routing for ${route.path} to ${route.service}`);
            }
        }
    } catch (error) {
        errors.push(`Error reading gateway: ${error.message}`);
    }
    
    return errors;
}

function checkUploadServiceCleanup() {
    const errors = [];
    const uploadFile = 'services/upload/server.js';
    const uploadRouter = 'services/upload/router.js';
    
    // Check that upload service doesn't have social/channel/playlist controllers
    if (fs.existsSync(uploadFile)) {
        const content = fs.readFileSync(uploadFile, 'utf8');
        const removedImports = [
            'PlaylistService',
            'ChannelController',
            'PlaylistController',
            'VideoLikeController',
            'SubscriptionController',
            'CommentController'
        ];
        
        for (const importName of removedImports) {
            if (content.includes(`require.*${importName}`) || content.includes(importName)) {
                // Check if it's actually used or just a comment
                const lines = content.split('\n');
                const hasActiveUse = lines.some(line => {
                    const trimmed = line.trim();
                    return trimmed.includes(importName) && 
                           !trimmed.startsWith('//') && 
                           !trimmed.startsWith('*');
                });
                if (hasActiveUse) {
                    errors.push(`Upload service still imports/uses: ${importName}`);
                }
            }
        }
    }
    
    // Check router doesn't have those routes
    if (fs.existsSync(uploadRouter)) {
        const routerContent = fs.readFileSync(uploadRouter, 'utf8');
        const removedRoutes = [
            '/api/channels',
            '/api/playlists',
            '/api/comments',
            '/api/subscriptions',
            '/api/videos/.*/like'
        ];
        
        for (const route of removedRoutes) {
            // Check if route is still in router (but allow comments)
            const routePattern = new RegExp(`(pathname.*${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${route})`, 'i');
            if (routePattern.test(routerContent)) {
                const lines = routerContent.split('\n');
                const hasActiveRoute = lines.some((line, idx) => {
                    const trimmed = line.trim();
                    if (routePattern.test(trimmed)) {
                        // Check if previous line is a comment
                        const prevLine = idx > 0 ? lines[idx - 1].trim() : '';
                        return !prevLine.startsWith('//') && !trimmed.startsWith('//');
                    }
                    return false;
                });
                if (hasActiveRoute) {
                    errors.push(`Upload router still has route: ${route}`);
                }
            }
        }
    }
    
    return errors;
}

console.log('🔍 Validating Service Code Structure\n');
console.log('='.repeat(60));

// Validate each service
console.log('\n📋 Test 1: Service File Validation\n');
for (const service of SERVICES) {
    const errors = validateService(service);
    if (errors.length === 0) {
        console.log(`✅ ${service.name.padEnd(12)}: Files exist and syntax is valid`);
        results.passed.push(service.name);
    } else {
        console.log(`❌ ${service.name.padEnd(12)}: ${errors.join(', ')}`);
        results.failed.push({ name: service.name, errors });
    }
}

// Check gateway routing
console.log('\n📋 Test 2: Gateway Routing Configuration\n');
const gatewayErrors = checkGatewayRouting();
if (gatewayErrors.length === 0) {
    console.log('✅ Gateway routing configured correctly');
    results.passed.push('gateway-routing');
} else {
    console.log(`❌ Gateway routing issues: ${gatewayErrors.join(', ')}`);
    results.failed.push({ name: 'gateway-routing', errors: gatewayErrors });
}

// Check upload service cleanup
console.log('\n📋 Test 3: Upload Service Cleanup\n');
const uploadErrors = checkUploadServiceCleanup();
if (uploadErrors.length === 0) {
    console.log('✅ Upload service properly cleaned up');
    results.passed.push('upload-cleanup');
} else {
    console.log(`❌ Upload service cleanup issues: ${uploadErrors.join(', ')}`);
    results.failed.push({ name: 'upload-cleanup', errors: uploadErrors });
}

// Check DatabaseConfig
console.log('\n📋 Test 4: Database Configuration\n');
try {
    const dbConfig = require('../src/infrastructure/config/DatabaseConfig');
    const content = fs.readFileSync('src/infrastructure/config/DatabaseConfig.js', 'utf8');
    const requiredServices = ['social', 'channel', 'playlist'];
    const missing = requiredServices.filter(s => !content.includes(s));
    
    if (missing.length === 0) {
        console.log('✅ DatabaseConfig includes all new services');
        results.passed.push('db-config');
    } else {
        console.log(`❌ DatabaseConfig missing services: ${missing.join(', ')}`);
        results.failed.push({ name: 'db-config', errors: [`Missing: ${missing.join(', ')}`] });
    }
} catch (error) {
    console.log(`❌ DatabaseConfig error: ${error.message}`);
    results.failed.push({ name: 'db-config', errors: [error.message] });
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('\n📊 Validation Summary\n');
console.log(`✅ Passed: ${results.passed.length}`);
console.log(`❌ Failed: ${results.failed.length}`);

if (results.failed.length > 0) {
    console.log('\n❌ Failed Validations:');
    results.failed.forEach(f => {
        console.log(`   - ${f.name}: ${f.errors.join(', ')}`);
    });
    process.exit(1);
} else {
    console.log('\n✅ All validations passed!');
    process.exit(0);
}

