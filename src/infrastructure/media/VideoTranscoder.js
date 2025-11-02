// @ts-check
// Infrastructure: VideoTranscoder
// Service for transcoding videos into different quality levels

const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const path = require('path');
const fs = require('fs');

// Set ffmpeg and ffprobe paths
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

class VideoTranscoder {
    constructor() {
        // Define quality presets with target heights and bitrates
        // Width will be calculated based on source aspect ratio
        this.qualityPresets = {
            '240p': {
                height: 240,
                bitrate: '400k',
                audioBitrate: '64k'
            },
            '360p': {
                height: 360,
                bitrate: '800k',
                audioBitrate: '96k'
            },
            '480p': {
                height: 480,
                bitrate: '1400k',
                audioBitrate: '128k'
            },
            '720p': {
                height: 720,
                bitrate: '2800k',
                audioBitrate: '128k'
            },
            '1080p': {
                height: 1080,
                bitrate: '5000k',
                audioBitrate: '192k'
            },
            '1440p': {
                height: 1440,
                bitrate: '8000k',
                audioBitrate: '192k'
            },
            '2160p': {
                height: 2160,
                bitrate: '14000k',
                audioBitrate: '256k'
            }
        };
    }

    /**
     * Get video metadata using ffprobe
     * @param {string} inputPath - Path to video file
     * @returns {Promise<{width: number, height: number, duration: number, bitrate: number}>}
     */
    async getVideoMetadata(inputPath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(inputPath, (err, metadata) => {
                if (err) {
                    return reject(err);
                }

                const videoStream = metadata.streams.find(s => s.codec_type === 'video');
                if (!videoStream) {
                    return reject(new Error('No video stream found'));
                }

                resolve({
                    width: videoStream.width,
                    height: videoStream.height,
                    duration: metadata.format.duration,
                    bitrate: metadata.format.bit_rate ? parseInt(metadata.format.bit_rate) : null
                });
            });
        });
    }

    /**
     * Determine which qualities to generate based on source video resolution
     * @param {number} sourceHeight - Source video height
     * @returns {string[]} Array of quality levels to generate
     */
    determineQualitiesToGenerate(sourceHeight) {
        const qualities = [];

        for (const [quality, preset] of Object.entries(this.qualityPresets)) {
            if (sourceHeight >= preset.height) {
                qualities.push(quality);
            }
        }

        return qualities;
    }

    /**
     * Calculate output dimensions while preserving aspect ratio
     * @param {number} sourceWidth - Source video width
     * @param {number} sourceHeight - Source video height
     * @param {number} targetHeight - Target height for output
     * @returns {{width: number, height: number}} Output dimensions
     */
    calculateDimensions(sourceWidth, sourceHeight, targetHeight) {
        const aspectRatio = sourceWidth / sourceHeight;
        const outputHeight = targetHeight;
        const outputWidth = Math.round(outputHeight * aspectRatio);

        // Ensure dimensions are divisible by 2 (required for H.264)
        return {
            width: outputWidth % 2 === 0 ? outputWidth : outputWidth + 1,
            height: outputHeight % 2 === 0 ? outputHeight : outputHeight + 1
        };
    }

    /**
     * Transcode video to a specific quality level
     * @param {string} inputPath - Path to source video
     * @param {string} outputPath - Path for output video
     * @param {string} quality - Quality level (e.g., "720p")
     * @param {number} sourceWidth - Source video width
     * @param {number} sourceHeight - Source video height
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<{width: number, height: number, sizeBytes: number, bitrate: string}>}
     */
    async transcodeToQuality(inputPath, outputPath, quality, sourceWidth, sourceHeight, onProgress = null) {
        const preset = this.qualityPresets[quality];

        if (!preset) {
            throw new Error(`Unknown quality preset: ${quality}`);
        }

        // Calculate output dimensions preserving aspect ratio
        const dimensions = this.calculateDimensions(sourceWidth, sourceHeight, preset.height);

        return new Promise((resolve, reject) => {
            const command = ffmpeg(inputPath)
                .output(outputPath)
                .videoCodec('libx264')
                .audioCodec('aac')
                .videoBitrate(preset.bitrate)
                .audioBitrate(preset.audioBitrate)
                // Use scale filter to preserve aspect ratio (width=-2 ensures divisible by 2)
                .videoFilters([
                    `scale=-2:${preset.height}`
                ])
                .format('mp4')
                .outputOptions([
                    '-preset fast',
                    '-movflags +faststart', // Enable fast start for web playback
                    '-profile:v main',
                    '-crf 23' // Constant Rate Factor for quality
                ]);

            if (onProgress) {
                command.on('progress', (progress) => {
                    onProgress({
                        percent: progress.percent || 0,
                        currentTime: progress.timemark,
                        targetSize: progress.targetSize,
                        currentKbps: progress.currentKbps
                    });
                });
            }

            command.on('end', () => {
                // Get output file size
                const stats = fs.statSync(outputPath);
                resolve({
                    width: dimensions.width,
                    height: dimensions.height,
                    sizeBytes: stats.size,
                    bitrate: preset.bitrate
                });
            });

            command.on('error', (err) => {
                reject(new Error(`Transcoding failed: ${err.message}`));
            });

            command.run();
        });
    }

    /**
     * Transcode video to all appropriate quality levels
     * @param {string} inputPath - Path to source video
     * @param {string} outputDir - Directory for output videos
     * @param {string} baseFileName - Base name for output files (without extension)
     * @param {Function} onProgress - Progress callback (quality, progress)
     * @returns {Promise<Array<{quality: string, path: string, width: number, height: number, sizeBytes: number, bitrate: string}>>}
     */
    async transcodeToMultipleQualities(inputPath, outputDir, baseFileName, onProgress = null) {
        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Get source video metadata
        const metadata = await this.getVideoMetadata(inputPath);
        console.log(`Source video: ${metadata.width}x${metadata.height}`);

        // Determine which qualities to generate
        const qualitiesToGenerate = this.determineQualitiesToGenerate(metadata.height);
        console.log(`Generating qualities: ${qualitiesToGenerate.join(', ')}`);

        if (qualitiesToGenerate.length === 0) {
            console.log('⚠️  Source video resolution is too low for transcoding. Will use original only.');
            return []; // Return empty array, original will still be saved
        }

        // Transcode to each quality
        const results = [];

        for (const quality of qualitiesToGenerate) {
            const outputPath = path.join(outputDir, `${baseFileName}_${quality}.mp4`);

            console.log(`Transcoding to ${quality}...`);

            try {
                const result = await this.transcodeToQuality(
                    inputPath,
                    outputPath,
                    quality,
                    metadata.width,
                    metadata.height,
                    onProgress ? (progress) => onProgress(quality, progress) : null
                );

                results.push({
                    quality,
                    path: outputPath,
                    ...result
                });

                console.log(`✅ ${quality} complete: ${(result.sizeBytes / (1024 * 1024)).toFixed(2)} MB (${result.width}x${result.height})`);
            } catch (error) {
                console.error(`❌ Failed to transcode to ${quality}:`, error.message);
                // Continue with other qualities even if one fails
            }
        }

        return results;
    }

    /**
     * Extract a thumbnail from a specific quality version
     * @param {string} videoPath - Path to video file
     * @param {string} outputPath - Path for thumbnail output
     * @param {Object} options - Thumbnail options
     * @returns {Promise<string>} Path to generated thumbnail
     */
    async extractThumbnail(videoPath, outputPath, options = {}) {
        const { timestamp = '00:00:01', size = '640x360' } = options;

        return new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .screenshots({
                    timestamps: [timestamp],
                    filename: path.basename(outputPath),
                    folder: path.dirname(outputPath),
                    size: size
                })
                .on('end', () => resolve(outputPath))
                .on('error', (err) => reject(err));
        });
    }
}

module.exports = VideoTranscoder;


