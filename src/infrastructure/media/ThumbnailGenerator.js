// Infrastructure: Thumbnail Generator

const path = require('path');
const fs = require('fs');

class ThumbnailGenerator {
    /**
     * Generate thumbnail from video file
     * @param {string} videoPath - Path to video file
     * @param {string} outputPath - Path where thumbnail should be saved
     * @param {object} options - Options for thumbnail generation
     * @param {string} options.timemarks - Time in video to capture (e.g., '00:00:03' or '10%')
     * @param {string} options.size - Thumbnail size (e.g., '320x240' or '?x240')
     * @returns {Promise<string>} Path to generated thumbnail
     */
    async generateFromVideo(videoPath, outputPath, options = {}) {
        // Auto-generation disabled - requires proper ffmpeg/ffprobe setup
        // Use processUploadedThumbnail() to handle user-uploaded thumbnails instead
        throw new Error('Auto-generation from video is not supported. Please upload a custom thumbnail.');
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

}

module.exports = ThumbnailGenerator;

