# B2 CORS Configuration for iOS Video Seeking

## The Problem
iOS Safari requires HEAD requests to determine video file size before enabling seeking. When using `STREAM_MODE=redirect`, the browser talks directly to B2, so B2 must allow HEAD requests via CORS.

## Solution 1: Configure B2 CORS (Recommended for Production)

### Using B2 Web Interface:
1. Go to https://secure.backblaze.com/
2. Navigate to **Buckets** → Select your bucket
3. Click **Bucket Settings**
4. Scroll to **CORS Rules**
5. Add this CORS configuration:

```json
[
    {
        "corsRuleName": "allowVideoStreaming",
        "allowedOrigins": [
            "https://your-domain.com",
            "https://www.your-domain.com"
        ],
        "allowedOperations": [
            "s3_get",
            "s3_head"
        ],
        "allowedHeaders": [
            "range",
            "content-type",
            "authorization"
        ],
        "exposeHeaders": [
            "content-range",
            "accept-ranges",
            "content-length",
            "content-type",
            "etag"
        ],
        "maxAgeSeconds": 3600
    }
]
```

### Using B2 CLI:
```bash
# Install B2 CLI
pip install b2

# Authorize
b2 authorize-account <keyId> <applicationKey>

# Create CORS rules file (cors.json):
cat > cors.json << 'EOF'
[
    {
        "corsRuleName": "allowVideoStreaming",
        "allowedOrigins": ["*"],
        "allowedOperations": ["s3_get", "s3_head"],
        "allowedHeaders": ["*"],
        "exposeHeaders": ["content-range", "accept-ranges", "content-length", "etag"],
        "maxAgeSeconds": 3600
    }
]
EOF

# Apply CORS rules
b2 update-bucket --corsRules "$(cat cors.json)" <bucketName> allPublic
```

### Important Notes:
- Replace `"https://your-domain.com"` with your actual domain(s)
- For testing, you can use `"*"` for `allowedOrigins` (not recommended for production)
- `s3_head` is critical for iOS video seeking
- `exposeHeaders` must include `accept-ranges` and `content-length`

## Solution 2: Use Proxy Mode (Quick Fix)

If you can't configure B2 CORS, switch to proxy mode in Railway:

1. Go to Railway Dashboard → Your Project → Variables
2. Add: `STREAM_MODE=proxy`
3. Redeploy

**Trade-offs:**
- ✅ iOS seeking works immediately
- ✅ No B2 CORS configuration needed
- ❌ Uses your server bandwidth (not CDN)
- ❌ Potentially higher costs at scale

## Testing iOS Seeking

After configuring CORS:

1. Open your site on iPhone/iPad Safari
2. Play a video
3. Try dragging the seek bar - it should work!

### Debug Commands:

Test HEAD request to your video:
```bash
# Replace with your actual video URL
curl -I "https://your-cdn.com/videos/video.mp4"

# Should return:
# HTTP/1.1 200 OK
# Accept-Ranges: bytes
# Content-Length: 12345678
# Access-Control-Allow-Methods: GET, HEAD
# Access-Control-Expose-Headers: accept-ranges, content-length
```

## Current Configuration

Your `.env` should have:
```bash
# B2 Configuration
B2_KEY_ID=your_key_id
B2_KEY_SECRET=your_key_secret
B2_BUCKET=your-bucket-name
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004

# CDN (if using Cloudflare/CDN)
CDN_BASE_URL=https://your-cdn.com

# Stream Mode
STREAM_MODE=redirect  # Use 'proxy' if CORS not configured
```

## Verification

After CORS is configured, check the response headers:
```javascript
// In browser console on your site
fetch('/video?file=your-video.mp4', { method: 'HEAD' })
  .then(r => {
    console.log('Accept-Ranges:', r.headers.get('accept-ranges'));
    console.log('Content-Length:', r.headers.get('content-length'));
  });
```

Should output:
```
Accept-Ranges: bytes
Content-Length: 12345678
```

