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
        // Define quality presets with target resolutions and bitrates
        this.qualityPresets = {
            '360p': {
                width: 640,
                height: 360,
                bitrate: '800k',
                audioBitrate: '96k'
            },
            '480p': {
                width: 854,
                height: 480,
                bitrate: '1400k',
                audioBitrate: '128k'
            },
            '720p': {
                width: 1280,
                height: 720,
                bitrate: '2800k',
                audioBitrate: '128k'
            },
            '1080p': {
                width: 1920,
                height: 1080,
                bitrate: '5000k',
                audioBitrate: '192k'
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

        // Only generate qualities that are smaller than source (not equal)
        // We save the original separately, so no need to transcode to same quality
        if (sourceHeight > 360) qualities.push('360p');
        if (sourceHeight > 480) qualities.push('480p');
        if (sourceHeight > 720) qualities.push('720p');
        if (sourceHeight > 1080) qualities.push('1080p');

        return qualities;
    }

    /**
     * Transcode video to a specific quality level
     * @param {string} inputPath - Path to source video
     * @param {string} outputPath - Path for output video
     * @param {string} quality - Quality level (e.g., "720p")
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<{width: number, height: number, sizeBytes: number, bitrate: string}>}
     */
    async transcodeToQuality(inputPath, outputPath, quality, onProgress = null) {
        const preset = this.qualityPresets[quality];

        if (!preset) {
            throw new Error(`Unknown quality preset: ${quality}`);
        }

        return new Promise((resolve, reject) => {
            let outputWidth = preset.width;
            let outputHeight = preset.height;

            const command = ffmpeg(inputPath)
                .output(outputPath)
                .videoCodec('libx264')
                .audioCodec('aac')
                .videoBitrate(preset.bitrate)
                .audioBitrate(preset.audioBitrate)
                .size(`${preset.width}x${preset.height}`)
                .autopad()
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
                    width: outputWidth,
                    height: outputHeight,
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
            throw new Error('Source video resolution is too low for transcoding');
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
                    onProgress ? (progress) => onProgress(quality, progress) : null
                );

                results.push({
                    quality,
                    path: outputPath,
                    ...result
                });

                console.log(`✅ ${quality} complete: ${(result.sizeBytes / (1024 * 1024)).toFixed(2)} MB`);
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


