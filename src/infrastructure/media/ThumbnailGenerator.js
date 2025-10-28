// Infrastructure: Thumbnail Generator

const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ThumbnailGenerator {
    /**
     * Generate thumbnail from video file
     * @param {string} videoPath - Path to video file
     * @param {string} outputPath - Path where thumbnail should be saved
     * @param {object} options - Options for thumbnail generation
     * @param {string} options.timestamp - Time in video to capture (e.g., '00:00:03')
     * @param {string} options.size - Thumbnail size (e.g., '640x360')
     * @returns {Promise<string>} Path to generated thumbnail
     */
    async generateFromVideo(videoPath, outputPath, options = {}) {
        const {
            timestamp = '00:00:02',  // Capture at 2 seconds (more stable than 1 sec)
            size = '640x360',
        } = options;

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Force JPG extension for output
        const jpgOutputPath = outputPath.replace(/\.[^.]+$/, '.jpg');

        try {
            // Check if ffmpeg is available
            try {
                await execAsync('ffmpeg -version');
            } catch (ffmpegCheckError) {
                console.warn('FFmpeg not found in PATH');
                throw new Error('FFmpeg is not installed or not in PATH');
            }

            // Extract frame from video using ffmpeg
            // -ss: seek to timestamp
            // -i: input file
            // -vframes 1: extract only 1 frame
            // -vf scale: resize the frame
            // -q:v 2: high quality JPEG (scale 2-31, lower is better)
            // -y: overwrite output file
            const command = `ffmpeg -ss ${timestamp} -i "${videoPath}" -vframes 1 -vf "scale=${size}:force_original_aspect_ratio=decrease,pad=${size}:(ow-iw)/2:(oh-ih)/2" -q:v 2 -y "${jpgOutputPath}"`;

            console.log('🎬 Extracting thumbnail from video using ffmpeg...');
            const { stdout, stderr } = await execAsync(command, {
                timeout: 30000,  // 30 second timeout
                maxBuffer: 10 * 1024 * 1024  // 10MB buffer
            });

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

                // Create a simple SVG placeholder (SVG works in all browsers)
                const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#grad)"/>
  <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="24" fill="white" 
        text-anchor="middle" dominant-baseline="middle">Video</text>
  <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="20" fill="white" 
        text-anchor="middle" dominant-baseline="middle">Thumbnail</text>
  <path d="M ${width / 2 - 30} ${height / 2 + 20} L ${width / 2 + 30} ${height / 2 + 40} L ${width / 2 - 30} ${height / 2 + 60} Z" 
        fill="white" opacity="0.8"/>
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

