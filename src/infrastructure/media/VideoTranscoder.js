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
            ffmpeg.ffprobe(inputPath, [
                '-v', 'error',
                '-analyzeduration', '50000000', // 50s in microseconds
                '-probesize', '100M'
            ], (err, metadata) => {
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
     * Rewrite an MP4/MOV file with a fresh moov atom for better compatibility (e.g., some Samsung recordings)
     * @param {string} inputPath - Path to the potentially problematic source file
     * @returns {Promise<string>} Path to the rewritten file
     */
    async rewriteMp4Container(inputPath) {
        const parsed = path.parse(inputPath);
        const outputPath = path.join(parsed.dir, `${parsed.name}_rewrap${parsed.ext || '.mp4'}`);

        return new Promise((resolve, reject) => {
            const command = ffmpeg(inputPath)
                .outputOptions([
                    '-c copy',
                    '-map 0',
                    '-movflags +faststart',
                    '-ignore_unknown'
                ])
                .on('end', () => {
                    try {
                        const stats = fs.statSync(outputPath);
                        if (stats.size === 0) {
                            throw new Error('Rewrapped file is empty');
                        }
                        resolve(outputPath);
                    } catch (statError) {
                        reject(statError);
                    }
                })
                .on('error', (err) => {
                    reject(new Error(`Failed to rewrite MP4 container: ${err.message}`));
                });

            command.save(outputPath);
        });
    }

    /**
     * Determine which qualities to generate based on source video resolution
     * @param {number} sourceWidth - Source video width
     * @param {number} sourceHeight - Source video height
     * @returns {string[]} Array of quality levels to generate
     */
    determineQualitiesToGenerate(sourceWidth, sourceHeight) {
        const qualities = [];

        // For vertical videos, use width as the reference dimension
        // For landscape videos, use height as the reference dimension
        const isVertical = sourceHeight > sourceWidth;
        const referenceDimension = isVertical ? sourceWidth : sourceHeight;

        for (const [quality, preset] of Object.entries(this.qualityPresets)) {
            if (referenceDimension >= preset.height) {
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

        // Detect if video is vertical (portrait) or horizontal (landscape)
        const isVertical = sourceHeight > sourceWidth;

        // For vertical videos, scale by width; for landscape videos, scale by height
        const scaleFilter = isVertical
            ? `scale=${preset.height}:-2`  // Set width, calculate height
            : `scale=-2:${preset.height}`; // Set height, calculate width

        return new Promise((resolve, reject) => {
            const command = ffmpeg(inputPath)
                .output(outputPath)
                .videoCodec('libx264')
                .audioCodec('aac')
                .videoBitrate(preset.bitrate)
                .audioBitrate(preset.audioBitrate)
                // Use scale filter to preserve aspect ratio (-2 ensures divisible by 2)
                .videoFilters([
                    scaleFilter
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
     * Generate HLS stream for a video quality
     * @param {string} inputPath - Path to source video
     * @param {string} outputDir - Directory for HLS output
     * @param {string} quality - Quality level (e.g., "720p")
     * @param {number} sourceWidth - Source video width
     * @param {number} sourceHeight - Source video height
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<{quality: string, playlistPath: string, width: number, height: number}>}
     */
    async generateHLSStream(inputPath, outputDir, quality, sourceWidth, sourceHeight, onProgress = null) {
        const preset = this.qualityPresets[quality];
        if (!preset) {
            throw new Error(`Unknown quality preset: ${quality}`);
        }

        const dimensions = this.calculateDimensions(sourceWidth, sourceHeight, preset.height);
        const isVertical = sourceHeight > sourceWidth;
        const scaleFilter = isVertical
            ? `scale=${preset.height}:-2`
            : `scale=-2:${preset.height}`;

        // HLS output paths
        const playlistPath = path.join(outputDir, `${quality}.m3u8`);
        const segmentPattern = path.join(outputDir, `${quality}_%03d.ts`);

        return new Promise((resolve, reject) => {
            const command = ffmpeg(inputPath)
                .output(playlistPath)
                .videoCodec('libx264')
                .audioCodec('aac')
                .videoBitrate(preset.bitrate)
                .audioBitrate(preset.audioBitrate)
                .videoFilters([scaleFilter])
                .format('hls')
                .outputOptions([
                    '-hls_time 10', // 10 second segments
                    '-hls_list_size 0', // Keep all segments in playlist
                    '-hls_segment_filename', segmentPattern,
                    '-preset fast',
                    '-profile:v main',
                    '-crf 23',
                    '-start_number 0'
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
                resolve({
                    quality,
                    playlistPath,
                    width: dimensions.width,
                    height: dimensions.height
                });
            });

            command.on('error', (err) => {
                reject(new Error(`HLS generation failed: ${err.message}`));
            });

            command.run();
        });
    }

    /**
     * Generate master HLS playlist with all quality variants
     * @param {string} outputDir - Directory containing quality playlists
     * @param {Array<{quality: string, width: number, height: number, bitrate: string}>} variants - Quality variants
     * @param {string} masterPlaylistPath - Path for master playlist
     * @returns {Promise<string>} Path to master playlist
     */
    async generateMasterPlaylist(outputDir, variants, masterPlaylistPath) {
        let playlistContent = '#EXTM3U\n#EXT-X-VERSION:3\n\n';

        // Sort variants by resolution (ascending)
        const sortedVariants = [...variants].sort((a, b) => {
            const heightA = this.qualityPresets[a.quality]?.height || 0;
            const heightB = this.qualityPresets[b.quality]?.height || 0;
            return heightA - heightB;
        });

        for (const variant of sortedVariants) {
            const preset = this.qualityPresets[variant.quality];
            const bandwidth = this.estimateBandwidth(preset.bitrate);
            const playlistUrl = `${variant.quality}.m3u8`;

            playlistContent += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${variant.width}x${variant.height}\n`;
            playlistContent += `${playlistUrl}\n\n`;
        }

        fs.writeFileSync(masterPlaylistPath, playlistContent, 'utf8');
        return masterPlaylistPath;
    }

    /**
     * Estimate bandwidth from bitrate string (e.g., "2800k" -> 2800000)
     * @param {string} bitrate - Bitrate string
     * @returns {number} Bandwidth in bits per second
     */
    estimateBandwidth(bitrate) {
        const match = bitrate.match(/^(\d+)([kmg]?)$/i);
        if (!match) return 1000000; // Default 1Mbps

        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();

        switch (unit) {
            case 'g': return value * 1000000000;
            case 'm': return value * 1000000;
            case 'k': return value * 1000;
            default: return value;
        }
    }

    /**
     * Transcode video to all appropriate quality levels
     * @param {string} inputPath - Path to source video
     * @param {string} outputDir - Directory for output videos
     * @param {string} baseFileName - Base name for output files (without extension)
     * @param {Function} onProgress - Progress callback (quality, progress)
     * @param {boolean} generateHLS - Whether to generate HLS streams in addition to MP4
     * @returns {Promise<Array<{quality: string, path: string, width: number, height: number, sizeBytes: number, bitrate: string}>>}
     */
    async transcodeToMultipleQualities(inputPath, outputDir, baseFileName, onProgress = null, generateHLS = false) {
        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Get source video metadata
        const metadata = await this.getVideoMetadata(inputPath);
        const isVertical = metadata.height > metadata.width;
        console.log(`Source video: ${metadata.width}x${metadata.height}${isVertical ? ' (vertical)' : ' (landscape)'}`);

        // Determine which qualities to generate
        const qualitiesToGenerate = this.determineQualitiesToGenerate(metadata.width, metadata.height);
        console.log(`Generating qualities: ${qualitiesToGenerate.join(', ')}`);

        if (qualitiesToGenerate.length === 0) {
            console.log('⚠️  Source video resolution is too low for transcoding. Will use original only.');
            return []; // Return empty array, original will still be saved
        }

        // Transcode to each quality
        const results = [];
        const hlsVariants = [];

        for (const quality of qualitiesToGenerate) {
            const outputPath = path.join(outputDir, `${baseFileName}_${quality}.mp4`);
            const preset = this.qualityPresets[quality];

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

                // Generate HLS stream if requested
                if (generateHLS) {
                    try {
                        const hlsResult = await this.generateHLSStream(
                            inputPath,
                            outputDir,
                            quality,
                            metadata.width,
                            metadata.height,
                            onProgress ? (progress) => onProgress(quality, progress) : null
                        );
                        hlsVariants.push({
                            quality: hlsResult.quality,
                            width: hlsResult.width,
                            height: hlsResult.height,
                            bitrate: preset.bitrate,
                            playlistPath: hlsResult.playlistPath
                        });
                        console.log(`✅ HLS ${quality} playlist generated: ${hlsResult.playlistPath}`);
                    } catch (hlsError) {
                        console.error(`⚠️  Failed to generate HLS for ${quality}:`, hlsError.message);
                        // Continue with other qualities
                    }
                }
            } catch (error) {
                console.error(`❌ Failed to transcode to ${quality}:`, error.message);
                // Continue with other qualities even if one fails
            }
        }

        // Generate master playlist if HLS was requested
        if (generateHLS && hlsVariants.length > 0) {
            try {
                const masterPlaylistPath = path.join(outputDir, 'master.m3u8');
                await this.generateMasterPlaylist(outputDir, hlsVariants, masterPlaylistPath);
                results.push({
                    quality: 'hls',
                    path: masterPlaylistPath,
                    width: metadata.width,
                    height: metadata.height,
                    sizeBytes: 0, // Playlist file is small
                    bitrate: 'adaptive',
                    isHLS: true
                });
                console.log(`✅ Master HLS playlist generated: ${masterPlaylistPath}`);
            } catch (masterError) {
                console.error('⚠️  Failed to generate master playlist:', masterError.message);
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

    /**
     * Convert a video file to WebM format using VP9 video and Vorbis audio codecs
     * @param {string} inputPath - Source video path
     * @param {string} outputPath - Output WebM path
     * @param {{crf?: number, audioBitrate?: string}} [options]
     * @returns {Promise<string>} Resolves with output path when conversion completes
     */
    async convertToWebm(inputPath, outputPath, options = {}) {
        const {
            crf = 32,
            audioBitrate = '128k'
        } = options;

        return new Promise((resolve, reject) => {
            const command = ffmpeg(inputPath)
                // Use inputOptions to tell FFmpeg what to read BEFORE processing
                .inputOptions([
                    '-err_detect ignore_err'  // Ignore stream errors
                ])
                .outputOptions([
                    // Map ONLY the streams we want - must come before codec options
                    '-map 0:v:0',           // Map only first video stream
                    '-map 0:a:0?',          // Map first audio stream if exists (? = optional)
                    '-c:v libvpx-vp9',      // VP9 video codec
                    '-b:v 0',               // Variable bitrate for video
                    `-crf ${crf}`,          // Quality (lower = better)
                    '-pix_fmt yuv420p',     // Pixel format for compatibility
                    '-row-mt 1',            // Multi-threaded encoding
                    '-tile-columns 1',      // Tiling for parallel encoding
                    '-frame-parallel 1',    // Frame-level parallelism
                    '-auto-alt-ref 1',      // Alternative reference frames
                    '-lag-in-frames 25',    // Lookahead frames
                    '-c:a libvorbis',       // Vorbis audio codec
                    `-b:a ${audioBitrate}`, // Audio bitrate
                    '-deadline good',       // Encoding speed/quality tradeoff
                    '-map_metadata -1',     // Strip all metadata
                    '-max_muxing_queue_size 1024' // Increase muxing queue for large files
                ])
                .format('webm')
                .on('end', () => resolve(outputPath))
                .on('error', (err) => {
                    reject(new Error(`WebM conversion failed: ${err.message}`));
                });

            command.save(outputPath);
        });
    }

    /**
     * Convert a video file to MP4 format using H.264 video and AAC audio codecs
     * @param {string} inputPath - Source video path
     * @param {string} outputPath - Output MP4 path
     * @param {{videoCodec?: string, audioCodec?: string, crf?: number, preset?: string, audioBitrate?: string}} [options]
     * @returns {Promise<string>} Resolves with output path when conversion completes
     */
    async convertToMp4(inputPath, outputPath, options = {}) {
        const {
            videoCodec = 'libx264',
            audioCodec = 'aac',
            crf = 23,
            preset = 'medium',
            audioBitrate = '128k'
        } = options;

        return new Promise((resolve, reject) => {
            const command = ffmpeg(inputPath)
                // Use inputOptions to tell FFmpeg what to read BEFORE processing
                .inputOptions([
                    '-err_detect ignore_err'  // Ignore stream errors
                ])
                .outputOptions([
                    // Map ONLY the streams we want - must come before codec options
                    '-map 0:v:0',           // Map only first video stream
                    '-map 0:a:0?',          // Map first audio stream if exists (? = optional)
                    `-c:v ${videoCodec}`,   // H.264 video codec
                    `-preset ${preset}`,    // Encoding speed vs compression (ultrafast, fast, medium, slow, veryslow)
                    `-crf ${crf}`,          // Quality (lower = better, 18-28 is good range)
                    '-pix_fmt yuv420p',     // Pixel format for compatibility
                    `-c:a ${audioCodec}`,   // AAC audio codec
                    `-b:a ${audioBitrate}`, // Audio bitrate
                    '-movflags +faststart', // Enable fast start for web playback
                    '-map_metadata -1',     // Strip all metadata
                    '-max_muxing_queue_size 1024' // Increase muxing queue for large files
                ])
                .format('mp4')
                .on('end', () => resolve(outputPath))
                .on('error', (err) => {
                    reject(new Error(`MP4 conversion failed: ${err.message}`));
                });

            command.save(outputPath);
        });
    }
}

module.exports = VideoTranscoder;


