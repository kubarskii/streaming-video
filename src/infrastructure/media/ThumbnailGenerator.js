// @ts-check
// Infrastructure: Thumbnail Generator

const path = require('path');
const fs = require('fs');
const { execFile, exec } = require('child_process');
const { promisify } = require('util');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);
const ffmpegPath = ffmpegInstaller.path;
const ffprobePath = ffprobeInstaller.path;

class ThumbnailGenerator {
    /**
     * Format seconds to timestamp string (HH:MM:SS.mmm)
     * @param {number} seconds - Time in seconds
     * @returns {string} Formatted timestamp
     */
    formatTimestamp(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
    }

    /**
     * Get video duration in seconds using ffprobe
     * @param {string} videoPath - Path to video file
     * @returns {Promise<number>} Duration in seconds
     */
    async getVideoDuration(videoPath) {
        try {
            const { stdout } = await execFileAsync(ffprobePath, [
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                videoPath
            ]);

            const duration = parseFloat(stdout.trim());
            console.log(`   Video duration: ${duration.toFixed(2)} seconds`);
            return duration;
        } catch (error) {
            console.warn('⚠️  Could not detect video duration:', error.message);
            return null;
        }
    }

    /**
     * Generate thumbnail from video file
     * @param {string} videoPath - Path to video file
     * @param {string} outputPath - Path where thumbnail should be saved
     * @param {Object} [options] - Options for thumbnail generation
     * @param {string} [options.timestamp] - Time in video to capture (optional, will auto-detect middle if not provided)
     * @param {string} [options.size] - Thumbnail size (e.g., '640x360')
     * @returns {Promise<string>} Path to generated thumbnail
     */
    async generateFromVideo(videoPath, outputPath, options = {}) {
        const {
            timestamp = null,  // Will be auto-calculated from video duration
            size = '640x360',
        } = options;

        console.log('🎬 generateFromVideo called with:');
        console.log('   videoPath:', videoPath);
        console.log('   outputPath:', outputPath);
        console.log('   size:', size);
        console.log('   Video file exists:', fs.existsSync(videoPath));

        if (!fs.existsSync(videoPath)) {
            throw new Error(`Video file not found: ${videoPath}`);
        }

        const stats = fs.statSync(videoPath);
        console.log('   Video file size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');

        // Get video duration and calculate middle timestamp if not provided
        let extractTimestamp = timestamp;
        if (!extractTimestamp) {
            const duration = await this.getVideoDuration(videoPath);
            if (duration && duration > 0) {
                // Extract from the middle of the video (50% through)
                const middleTime = duration / 2;
                extractTimestamp = this.formatTimestamp(middleTime);
                console.log(`   Using middle timestamp: ${extractTimestamp} (${middleTime.toFixed(2)}s)`);
            } else {
                // Fallback to 1 second if duration detection fails
                extractTimestamp = '00:00:01';
                console.log('   Using fallback timestamp: 00:00:01');
            }
        } else {
            console.log('   Using provided timestamp:', extractTimestamp);
        }

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            console.log('   Creating output directory:', outputDir);
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Force JPG extension for output
        const jpgOutputPath = outputPath.replace(/\.[^.]+$/, '.jpg');
        console.log('   JPG output path:', jpgOutputPath);

        try {
            // Check if ffmpeg is available
            try {
                await execFileAsync(ffmpegPath, ['-version']);
            } catch (ffmpegCheckError) {
                console.warn(`FFmpeg binary unavailable or not executable at path: ${ffmpegPath}`);
                throw new Error('FFmpeg is not installed or not accessible');
            }

            // Extract frame from video using ffmpeg
            // -ss: seek to timestamp
            // -i: input file
            // -vframes 1: extract only 1 frame
            // -vf scale: resize the frame
            // -q:v 2: high quality JPEG (scale 2-31, lower is better)
            // -y: overwrite output file
            console.log('🎬 Extracting thumbnail from video using ffmpeg...');
            console.log('   FFmpeg path:', ffmpegPath);

            // Parse size for simpler scale filter
            const [width, height] = size.split('x').map(Number);

            // Use simple scale filter without padding to avoid shell escaping issues
            // The scale filter with -1 maintains aspect ratio automatically
            const ffmpegArgs = [
                '-ss', extractTimestamp,
                '-i', videoPath,
                '-vframes', '1',
                '-vf', `scale=${width}:-1`,  // -1 maintains aspect ratio, much simpler!
                '-q:v', '2',
                '-y',
                jpgOutputPath,
            ];

            console.log('   FFmpeg args:', JSON.stringify(ffmpegArgs, null, 2));

            try {
                const { stdout, stderr } = await execFileAsync(ffmpegPath, ffmpegArgs, {
                    timeout: 30000,  // 30 second timeout
                    maxBuffer: 10 * 1024 * 1024  // 10MB buffer
                });
                if (stderr) {
                    console.log('FFmpeg stderr:', stderr);
                }
            } catch (execFileError) {
                // Log detailed error information
                console.error('❌ execFile failed with error:', execFileError.message);
                console.error('   Error code:', execFileError.code);

                // Check if it's a "video too short" or "timestamp beyond duration" error
                const errorOutput = (execFileError.stderr || execFileError.stdout || '').toString();
                if (errorOutput.includes('Invalid argument') || errorOutput.includes('start time') ||
                    errorOutput.includes('past duration')) {
                    console.warn('⚠️  Timestamp issue detected, trying with first frame (0.1s)...');
                    // Retry with first frame
                    ffmpegArgs[1] = '00:00:00.1';

                    try {
                        const { stdout, stderr } = await execFileAsync(ffmpegPath, ffmpegArgs, {
                            timeout: 30000,
                            maxBuffer: 10 * 1024 * 1024
                        });
                        if (stderr) {
                            console.log('FFmpeg stderr (retry):', stderr);
                        }
                        // Success with earlier timestamp, continue to verification
                    } catch (retryError) {
                        console.error('❌ Retry also failed:', retryError.message);
                        throw retryError;
                    }
                } else {
                    // Not a timing issue, re-throw the error
                    throw execFileError;
                }
            }

            // Verify the file was created and has content
            if (!fs.existsSync(jpgOutputPath)) {
                throw new Error('Thumbnail file was not created by ffmpeg');
            }

            const stats = fs.statSync(jpgOutputPath);
            if (stats.size === 0) {
                fs.unlinkSync(jpgOutputPath);
                throw new Error('Thumbnail file is empty');
            }

            console.log(`✅ Thumbnail extracted successfully (${(stats.size / 1024).toFixed(2)} KB)`);
            return jpgOutputPath;

        } catch (error) {
            console.error('❌ Failed to extract thumbnail from video:', error.message);

            // If JPG file was created but is invalid, delete it
            if (fs.existsSync(jpgOutputPath)) {
                try {
                    fs.unlinkSync(jpgOutputPath);
                } catch (unlinkError) {
                    console.error('Failed to delete invalid thumbnail:', unlinkError.message);
                }
            }

            // Create a PNG placeholder as fallback (better than SVG for thumbnails)
            console.log('⚠️  Creating placeholder thumbnail as fallback...');
            return await this.generatePlaceholderImage(jpgOutputPath, size);
        }
    }

    /**
     * Validate and process user-uploaded thumbnail
     * @param {string} imagePath - Path to uploaded image
     * @param {string} outputPath - Path where processed thumbnail should be saved
     * @param {object} options - Options for processing
     * @returns {Promise<string>} Path to processed thumbnail
     */
    async processUploadedThumbnail(imagePath, outputPath, options = {}) {
        const {
            size = '640x360',
        } = options;

        // For simplicity, just copy the uploaded thumbnail
        // In production, you might want to resize it with sharp or jimp instead of ffmpeg
        return new Promise((resolve, reject) => {
            const outputDir = path.dirname(outputPath);

            // Ensure output directory exists
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // Simply copy the file
            fs.copyFile(imagePath, outputPath, (err) => {
                if (err) {
                    console.error('Error copying thumbnail:', err);
                    reject(new Error(`Failed to copy thumbnail: ${err.message}`));
                } else {
                    resolve(outputPath);
                }
            });
        });
    }

    /**
     * Generate a placeholder thumbnail when ffmpeg is not available
     * Creates a simple colored rectangle as a fallback
     * @param {string} outputPath - Path where placeholder should be saved
     * @param {string} size - Size of the thumbnail (e.g., '640x360')
     * @returns {Promise<string>} Path to generated placeholder
     */
    async generatePlaceholderImage(outputPath, size = '640x360') {
        return new Promise((resolve, reject) => {
            try {
                const [width, height] = size.split('x').map(Number);

                // Create a modern, professional SVG placeholder
                const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1e293b;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="accent-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#bg-gradient)"/>
  
  <!-- Grid pattern for depth -->
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
  </pattern>
  <rect width="${width}" height="${height}" fill="url(#grid)"/>
  
  <!-- Center circle background -->
  <circle cx="${width / 2}" cy="${height / 2}" r="80" fill="rgba(59, 130, 246, 0.2)" />
  <circle cx="${width / 2}" cy="${height / 2}" r="70" fill="rgba(59, 130, 246, 0.15)" />
  
  <!-- Play button icon -->
  <circle cx="${width / 2}" cy="${height / 2}" r="60" fill="url(#accent-gradient)" opacity="0.9"/>
  <polygon points="${width / 2 - 20},${height / 2 - 25} ${width / 2 - 20},${height / 2 + 25} ${width / 2 + 25},${height / 2}" 
           fill="white" opacity="0.95"/>
  
  <!-- Video camera icon in corner -->
  <g transform="translate(${width - 60}, 20)">
    <rect x="0" y="8" width="30" height="20" rx="3" fill="rgba(255,255,255,0.3)"/>
    <polygon points="30,12 40,8 40,24 30,20" fill="rgba(255,255,255,0.3)"/>
    <circle cx="8" cy="14" r="3" fill="rgba(255,255,255,0.5)"/>
  </g>
  
  <!-- Text at bottom -->
  <text x="${width / 2}" y="${height - 40}" 
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif" 
        font-size="16" 
        font-weight="500"
        fill="rgba(255,255,255,0.7)" 
        text-anchor="middle">
    No Preview Available
  </text>
</svg>`;

                // Ensure output directory exists
                const outputDir = path.dirname(outputPath);
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                // Save as SVG (works everywhere, no additional dependencies)
                const svgPath = outputPath.replace(/\.[^.]+$/, '.svg');

                fs.writeFileSync(svgPath, svg);
                console.log('✅ SVG placeholder thumbnail created');
                resolve(svgPath);
            } catch (error) {
                reject(new Error(`Failed to create placeholder: ${error.message}`));
            }
        });
    }

}

module.exports = ThumbnailGenerator;

