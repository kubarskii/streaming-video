# HTTP/2 Setup Guide

Enable HTTP/2 for true multiplexing and faster uploads.

---

## 🚀 Why HTTP/2?

### Benefits for Chunked Upload:

1. **True Multiplexing**: Multiple chunks on single TCP connection
2. **Header Compression**: HPACK reduces overhead
3. **Server Push**: Can push assets proactively
4. **Binary Protocol**: More efficient than HTTP/1.1 text
5. **Prioritization**: Can prioritize critical chunks

**Performance Gain**: Additional 20-30% improvement over HTTP/1.1

---

## 🔧 Frontend Setup (Vite with HTTP/2)

### 1. Generate SSL Certificates for Local Development

```bash
# Install mkcert (one-time setup)
# macOS
brew install mkcert
mkcert -install

# Windows (with Chocolatey)
choco install mkcert
mkcert -install

# Linux
# Download from https://github.com/FiloSottile/mkcert/releases

# Generate certificates
cd frontend
mkcert localhost 127.0.0.1 ::1
# Creates: localhost+2.pem and localhost+2-key.pem
```

### 2. Update Vite Config

```javascript
// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        https: {
            key: fs.readFileSync(path.resolve(__dirname, 'localhost+2-key.pem')),
            cert: fs.readFileSync(path.resolve(__dirname, 'localhost+2.pem')),
        },
        // Enable HTTP/2
        http2: true,
        proxy: {
            '/api': {
                target: 'https://localhost:3000',
                changeOrigin: true,
                secure: false, // Accept self-signed certs in development
            },
            '/video': {
                target: 'https://localhost:3000',
                changeOrigin: true,
                secure: false,
            }
        }
    },
    preview: {
        port: 4173,
        https: {
            key: fs.readFileSync(path.resolve(__dirname, 'localhost+2-key.pem')),
            cert: fs.readFileSync(path.resolve(__dirname, 'localhost+2.pem')),
        },
        http2: true,
    }
});
```

### 3. Update Package.json

```json
{
    "scripts": {
        "dev": "vite --host",
        "dev:http2": "vite --host --https",
        "preview": "vite preview --host --https"
    }
}
```

### 4. Test HTTP/2

```bash
npm run dev:http2

# Open browser to https://localhost:5173
# Check DevTools → Network → Protocol column
# Should show "h2" for HTTP/2
```

---

## 🔧 Backend Setup (Node.js with HTTP/2)

### Option 1: Express with SPDY (Easiest)

```bash
npm install spdy
```

```javascript
// server.js
const express = require('express');
const spdy = require('spdy');
const fs = require('fs');
const path = require('path');

const app = express();

// Your existing Express middleware and routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ... your routes ...

// SSL certificates
const options = {
    key: fs.readFileSync(path.join(__dirname, 'localhost+2-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'localhost+2.pem')),
    // Enable HTTP/2
    spdy: {
        protocols: ['h2', 'http/1.1'],
        plain: false,
    }
};

// Create HTTP/2 server
const server = spdy.createServer(options, app);

server.listen(3000, () => {
    console.log('🚀 Server running on https://localhost:3000');
    console.log('✅ HTTP/2 enabled');
});
```

### Option 2: Native Node.js HTTP/2

```javascript
// server-http2.js
const http2 = require('http2');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

// Your Express middleware and routes
// ... (same as above) ...

// SSL certificates
const options = {
    key: fs.readFileSync(path.join(__dirname, 'localhost+2-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'localhost+2.pem')),
    allowHTTP1: true // Allow fallback to HTTP/1.1
};

// Create HTTP/2 secure server
const server = http2.createSecureServer(options, app);

server.listen(3000, () => {
    console.log('🚀 Server running on https://localhost:3000');
    console.log('✅ HTTP/2 enabled (with HTTP/1.1 fallback)');
});
```

### Option 3: Fastify (Most Performant)

```bash
npm install fastify @fastify/compress @fastify/cors @fastify/multipart
```

```javascript
// server-fastify.js
const fastify = require('fastify');
const fs = require('fs');
const path = require('path');

const server = fastify({
    logger: true,
    https: {
        key: fs.readFileSync(path.join(__dirname, 'localhost+2-key.pem')),
        cert: fs.readFileSync(path.join(__dirname, 'localhost+2.pem'))
    },
    http2: true
});

// Register plugins
server.register(require('@fastify/compress'));
server.register(require('@fastify/cors'));
server.register(require('@fastify/multipart'));

// Your routes
server.post('/api/upload/chunk', async (request, reply) => {
    // Handle chunk upload
    // ...
});

// Start server
server.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
    if (err) {
        server.log.error(err);
        process.exit(1);
    }
    server.log.info(`Server listening on ${address}`);
    console.log('✅ HTTP/2 enabled');
});
```

---

## 🔐 Production Setup

### 1. Get Production SSL Certificates

#### Option A: Let's Encrypt (Free)

```bash
# Install Certbot
sudo apt-get install certbot

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com

# Certificates will be at:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

#### Option B: CloudFlare (Recommended)

1. Use CloudFlare DNS
2. Enable "Full (strict)" SSL/TLS encryption mode
3. CloudFlare automatically handles HTTP/2
4. Download origin certificates from CloudFlare dashboard

### 2. Update Production Server

```javascript
// server.js (production)
const options = {
    key: fs.readFileSync(process.env.SSL_KEY_PATH || '/etc/letsencrypt/live/yourdomain.com/privkey.pem'),
    cert: fs.readFileSync(process.env.SSL_CERT_PATH || '/etc/letsencrypt/live/yourdomain.com/fullchain.pem'),
    spdy: {
        protocols: ['h2', 'http/1.1'],
    }
};

const server = spdy.createServer(options, app);
server.listen(process.env.PORT || 3000);
```

### 3. Environment Variables

```bash
# .env.production
SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
PORT=443
```

---

## 🎯 Optimization Tips

### 1. Enable Server Push (Optional)

```javascript
// Push critical assets
server.on('stream', (stream, headers) => {
    if (headers[':path'] === '/') {
        // Push critical CSS and JS
        stream.pushStream({ ':path': '/assets/critical.css' }, (err, pushStream) => {
            if (!err) {
                pushStream.respondWithFile(
                    path.join(__dirname, 'public/assets/critical.css'),
                    { 'content-type': 'text/css' }
                );
            }
        });
    }
});
```

### 2. Configure Connection Limits

```javascript
const options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem'),
    spdy: {
        protocols: ['h2'],
        maxStreams: 1000, // Max concurrent streams per connection
        maxSessionMemory: 100, // MB
        maxHeaderListPairs: 2000,
    }
};
```

### 3. Enable Compression

```javascript
const compression = require('compression');

app.use(compression({
    threshold: 1024, // Only compress if > 1KB
    level: 6, // Compression level (0-9)
    filter: (req, res) => {
        // Don't compress video chunks (already compressed)
        if (req.url.includes('/upload/chunk')) {
            return false;
        }
        return compression.filter(req, res);
    }
}));
```

---

## 📊 Testing HTTP/2

### 1. Check Protocol in Browser

```javascript
// In browser console
fetch('/api/test')
    .then(response => {
        console.log('Protocol:', response.headers.get('x-http-version'));
    });
```

### 2. Use curl

```bash
# Test HTTP/2
curl -I --http2 https://localhost:3000/api/test

# Should show:
# HTTP/2 200
```

### 3. Use Chrome DevTools

1. Open DevTools → Network tab
2. Right-click column headers
3. Enable "Protocol" column
4. Look for "h2" (HTTP/2) or "http/1.1"

### 4. Online Testing Tools

- https://tools.keycdn.com/http2-test
- https://www.ssllabs.com/ssltest/

---

## 🚨 Common Issues

### Issue: "Protocol mismatch" Error

**Solution**:
- Ensure both frontend and backend use HTTPS
- Check certificate paths are correct
- Verify `allowHTTP1: true` for fallback

### Issue: Vite not using HTTP/2

**Solution**:
```javascript
// Make sure both https AND http2 are set
server: {
    https: { /* certificates */ },
    http2: true, // Must be explicit
}
```

### Issue: Browser shows HTTP/1.1

**Solution**:
- Clear browser cache
- Verify server logs show HTTP/2 enabled
- Check if proxy/load balancer strips HTTP/2
- Some browsers require valid SSL cert

### Issue: Performance not improved

**Solution**:
- Verify "h2" protocol in DevTools
- Check if all requests use same connection (reused)
- Monitor concurrent streams (should be 6+ for chunk upload)
- Test with large file (>100MB) to see benefits

---

## 📈 Expected Performance

### HTTP/1.1 (Current):
- 6 parallel TCP connections
- Each connection has overhead
- Head-of-line blocking
- Text-based headers

**Result**: ~30-35 MB/s upload speed

### HTTP/2 (Optimized):
- Single TCP connection
- True multiplexing (no HOL blocking)
- Binary protocol
- Header compression

**Result**: ~40-45 MB/s upload speed

**Improvement**: 20-30% faster!

---

## 🎯 Production Checklist

- [ ] SSL certificates obtained
- [ ] HTTP/2 enabled on backend
- [ ] HTTPS enforced (redirect HTTP → HTTPS)
- [ ] Frontend uses HTTPS URLs
- [ ] Tested with curl
- [ ] Verified in browser DevTools (Protocol column shows "h2")
- [ ] Performance tested (should see 20-30% improvement)
- [ ] Monitoring set up (track HTTP/2 usage)
- [ ] Fallback to HTTP/1.1 works
- [ ] CloudFlare/CDN configured for HTTP/2

---

## 🆘 Troubleshooting

### Debug Mode

```javascript
// Enable HTTP/2 debug logging
const debug = require('debug');
debug.enable('http2*');

const server = http2.createSecureServer(options, app);
```

### Monitor HTTP/2 Streams

```javascript
server.on('stream', (stream, headers) => {
    console.log('New stream:', {
        id: stream.id,
        path: headers[':path'],
        method: headers[':method']
    });
    
    stream.on('close', () => {
        console.log('Stream closed:', stream.id);
    });
});
```

---

## 📚 Resources

- **HTTP/2 Spec**: https://http2.github.io/
- **Node.js HTTP/2 Docs**: https://nodejs.org/api/http2.html
- **SPDY Module**: https://github.com/spdy-http2/node-spdy
- **Vite HTTPS**: https://vitejs.dev/config/server-options.html#server-https
- **Let's Encrypt**: https://letsencrypt.org/

---

**HTTP/2 provides the final 20-30% performance boost!** 🚀

