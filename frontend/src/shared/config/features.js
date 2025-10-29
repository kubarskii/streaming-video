/**
 * Feature Flags Configuration
 * 
 * Simple constants to enable/disable features across the application.
 * Change these values to toggle features without modifying code.
 */

// Upload Features
export const FEATURES = {
    /**
     * Enable chunked upload for large files
     * 
     * When enabled:
     * - Files are split into chunks (5MB each)
     * - Uploads can be paused/resumed/cancelled
     * - Automatic retry on failure
     * - Better for files > 100MB
     * 
     * When disabled:
     * - Traditional single-request upload
     * - Simpler, but less reliable for large files
     * 
     * @type {boolean}
     */
    CHUNKED_UPLOAD: true,

    /**
     * File size threshold for automatic chunked upload (in bytes)
     * 
     * If CHUNKED_UPLOAD is true, files larger than this will automatically
     * use chunked upload, smaller files will use simple upload.
     * 
     * Set to 0 to always use chunked upload when enabled.
     * 
     * @type {number}
     */
    CHUNKED_UPLOAD_THRESHOLD: 100 * 1024 * 1024, // 100MB

    /**
     * Show upload method in UI for debugging
     * Displays whether "Simple" or "Chunked" upload is being used
     * 
     * @type {boolean}
     */
    SHOW_UPLOAD_METHOD: false,
};

/**
 * Get upload strategy based on file size and feature flags
 * 
 * @param {number} fileSize - Size of file in bytes
 * @returns {'chunked' | 'simple'} Upload strategy to use
 */
export function getUploadStrategy(fileSize) {
    if (!FEATURES.CHUNKED_UPLOAD) {
        return 'simple';
    }

    if (FEATURES.CHUNKED_UPLOAD_THRESHOLD === 0) {
        return 'chunked';
    }

    return fileSize > FEATURES.CHUNKED_UPLOAD_THRESHOLD ? 'chunked' : 'simple';
}

