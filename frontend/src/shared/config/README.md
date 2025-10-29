# Feature Flags Configuration

Simple feature flags to enable/disable features across the application.

## 📁 Files

- `features.js` - Feature flag constants and helpers

## 🎛️ Available Flags

### `FEATURES.CHUNKED_UPLOAD`

**Type:** `boolean`  
**Default:** `true`

Enable/disable chunked upload for large files.

```javascript
// Enable chunked upload (recommended)
CHUNKED_UPLOAD: true

// Disable - use only simple upload
CHUNKED_UPLOAD: false
```

**When enabled:**
- ✅ Files split into 5MB chunks
- ✅ Upload can be paused/resumed/cancelled
- ✅ Automatic retry on failure
- ✅ Better for files > 100MB
- ✅ Survives network interruptions

**When disabled:**
- Traditional single-request upload
- Simpler implementation
- Less reliable for large files

---

### `FEATURES.CHUNKED_UPLOAD_THRESHOLD`

**Type:** `number` (bytes)  
**Default:** `100 * 1024 * 1024` (100MB)

File size threshold for automatic chunked upload.

```javascript
// Files > 100MB use chunked, smaller use simple
CHUNKED_UPLOAD_THRESHOLD: 100 * 1024 * 1024

// Always use chunked (when enabled)
CHUNKED_UPLOAD_THRESHOLD: 0

// Files > 500MB use chunked
CHUNKED_UPLOAD_THRESHOLD: 500 * 1024 * 1024
```

**How it works:**
- If file size > threshold → Chunked upload
- If file size ≤ threshold → Simple upload
- Only applies when `CHUNKED_UPLOAD: true`

---

### `FEATURES.SHOW_UPLOAD_METHOD`

**Type:** `boolean`  
**Default:** `false`

Show upload method in UI for debugging.

```javascript
// Show "Chunked" or "Simple" badge
SHOW_UPLOAD_METHOD: true

// Hide badge (production)
SHOW_UPLOAD_METHOD: false
```

## 🚀 Usage

### In Components

```javascript
import { FEATURES, getUploadStrategy } from '../../shared/config/features';

// Check if chunked upload is enabled
if (FEATURES.CHUNKED_UPLOAD) {
    console.log('Chunked upload is available');
}

// Get upload strategy for a file
const strategy = getUploadStrategy(file.size);
// Returns: 'chunked' or 'simple'
```

### Helper Function

```javascript
/**
 * Get upload strategy based on file size
 * @param {number} fileSize - File size in bytes
 * @returns {'chunked' | 'simple'}
 */
getUploadStrategy(fileSize)
```

**Examples:**
```javascript
// 50MB file with 100MB threshold
getUploadStrategy(50 * 1024 * 1024)  // → 'simple'

// 200MB file with 100MB threshold
getUploadStrategy(200 * 1024 * 1024) // → 'chunked'

// Any file when threshold = 0
getUploadStrategy(1024)              // → 'chunked'
```

## 📋 Common Configurations

### Recommended (Default)
```javascript
CHUNKED_UPLOAD: true,
CHUNKED_UPLOAD_THRESHOLD: 100 * 1024 * 1024,  // 100MB
SHOW_UPLOAD_METHOD: false
```
**Best for:** Most users. Automatic smart upload selection.

---

### Always Chunked
```javascript
CHUNKED_UPLOAD: true,
CHUNKED_UPLOAD_THRESHOLD: 0,  // Always use chunked
SHOW_UPLOAD_METHOD: false
```
**Best for:** All files benefit from resume capability.

---

### Simple Only
```javascript
CHUNKED_UPLOAD: false,
CHUNKED_UPLOAD_THRESHOLD: 100 * 1024 * 1024,  // Ignored
SHOW_UPLOAD_METHOD: false
```
**Best for:** Testing, or if chunked upload backend not ready.

---

### Development/Debug
```javascript
CHUNKED_UPLOAD: true,
CHUNKED_UPLOAD_THRESHOLD: 10 * 1024 * 1024,  // 10MB for testing
SHOW_UPLOAD_METHOD: true  // Show which method is used
```
**Best for:** Development and debugging.

## 🔄 Switching Upload Implementation

### Option 1: Replace Current UploadPage

```bash
# Backup current
mv src/pages/upload/UploadPage.jsx src/pages/upload/UploadPage.simple.jsx

# Use integrated version
mv src/pages/upload/UploadPageIntegrated.jsx src/pages/upload/UploadPage.jsx
```

### Option 2: Manual Integration

Copy the upload logic from `UploadPageIntegrated.jsx` into your existing `UploadPage.jsx`.

Key sections:
1. Import feature flags
2. Import ChunkedUploader
3. Add `handleChunkedUpload()` function
4. Update `handleSubmit()` to choose strategy
5. Add pause/resume controls (optional)

## ⚙️ Advanced Configuration

### Per-User Settings (Future)

To make flags user-configurable:

```javascript
// Store in user preferences
const userPreferences = {
    useChunkedUpload: true,
    chunkSize: 5 * 1024 * 1024
};

// Override flags
export const FEATURES = {
    CHUNKED_UPLOAD: userPreferences.useChunkedUpload ?? true,
    // ...
};
```

### Environment-Based (Future)

```javascript
export const FEATURES = {
    CHUNKED_UPLOAD: process.env.VITE_CHUNKED_UPLOAD === 'true',
    // ...
};
```

## 🧪 Testing Different Configurations

```javascript
// Test simple upload
FEATURES.CHUNKED_UPLOAD = false;
// Upload a 200MB file → Uses simple upload

// Test chunked upload
FEATURES.CHUNKED_UPLOAD = true;
FEATURES.CHUNKED_UPLOAD_THRESHOLD = 0;
// Upload a 10MB file → Uses chunked upload

// Test threshold
FEATURES.CHUNKED_UPLOAD = true;
FEATURES.CHUNKED_UPLOAD_THRESHOLD = 100 * 1024 * 1024;
// Upload 50MB → simple
// Upload 150MB → chunked
```

## 📊 Monitoring

Track which upload method is being used:

```javascript
const strategy = getUploadStrategy(file.size);
console.log('Upload strategy:', strategy);
console.log('File size:', file.size);
console.log('Threshold:', FEATURES.CHUNKED_UPLOAD_THRESHOLD);

// Send to analytics
analytics.track('upload_started', {
    strategy,
    fileSize: file.size,
    chunkedEnabled: FEATURES.CHUNKED_UPLOAD
});
```

## 🎯 Best Practices

1. **Keep simple upload** - Don't remove it, users with small files don't need chunking
2. **Set appropriate threshold** - 100MB is a good default
3. **Hide debug info** - Set `SHOW_UPLOAD_METHOD: false` in production
4. **Test both paths** - Ensure simple and chunked uploads both work
5. **Monitor usage** - Track which method users actually use

## 🐛 Troubleshooting

### Chunked upload not working?

1. Check feature flag:
   ```javascript
   console.log(FEATURES.CHUNKED_UPLOAD); // Should be true
   ```

2. Check file size vs threshold:
   ```javascript
   console.log(file.size > FEATURES.CHUNKED_UPLOAD_THRESHOLD);
   ```

3. Check backend routes are registered

### Simple upload not working?

1. Verify `videosAPI.uploadVideo()` still exists
2. Check server handles non-chunked uploads
3. Ensure file size within limits

## 📝 Migration Checklist

When enabling chunked upload:

- [ ] Set `CHUNKED_UPLOAD: true`
- [ ] Set appropriate `CHUNKED_UPLOAD_THRESHOLD`
- [ ] Backend routes registered (see UPLOAD_QUICK_START.md)
- [ ] Database migration run (`npx prisma migrate`)
- [ ] Test small file (< threshold) → simple upload
- [ ] Test large file (> threshold) → chunked upload
- [ ] Test pause/resume functionality
- [ ] Test cancel functionality
- [ ] Set `SHOW_UPLOAD_METHOD: false` for production

## 🆘 Support

See detailed implementation guides:
- `UPLOAD_QUICK_START.md` - Backend setup
- `LARGE_FILE_UPLOAD_GUIDE.md` - Technical details
- `IMPLEMENTATION_SUMMARY.md` - Architecture

