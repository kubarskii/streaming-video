// @ts-check
const { test, describe } = require('node:test');
const assert = require('node:assert');
const VideoTranscoder = require('../../src/infrastructure/media/VideoTranscoder');
const fs = require('fs');
const path = require('path');

describe('VideoTranscoder', () => {
    const createTranscoder = () => {
        return new VideoTranscoder();
    };

    describe('qualityPresets', () => {
        test('should have all quality presets defined', () => {
            const transcoder = createTranscoder();
            const expectedQualities = ['240p', '360p', '480p', '720p', '1080p', '1440p', '2160p'];
            
            for (const quality of expectedQualities) {
                assert.ok(transcoder.qualityPresets[quality], `Quality ${quality} should be defined`);
                assert.ok(transcoder.qualityPresets[quality].height);
                assert.ok(transcoder.qualityPresets[quality].bitrate);
                assert.ok(transcoder.qualityPresets[quality].audioBitrate);
            }
        });
    });

    describe('determineQualitiesToGenerate', () => {
        test('should generate appropriate qualities for 1080p source', () => {
            const transcoder = createTranscoder();
            const qualities = transcoder.determineQualitiesToGenerate(1920, 1080);
            
            assert.ok(qualities.includes('240p'));
            assert.ok(qualities.includes('360p'));
            assert.ok(qualities.includes('480p'));
            assert.ok(qualities.includes('720p'));
            assert.ok(qualities.includes('1080p'));
            assert.ok(!qualities.includes('1440p'));
            assert.ok(!qualities.includes('2160p'));
        });

        test('should generate appropriate qualities for 720p source', () => {
            const transcoder = createTranscoder();
            const qualities = transcoder.determineQualitiesToGenerate(1280, 720);
            
            assert.ok(qualities.includes('240p'));
            assert.ok(qualities.includes('360p'));
            assert.ok(qualities.includes('480p'));
            assert.ok(qualities.includes('720p'));
            assert.ok(!qualities.includes('1080p'));
        });

        test('should handle vertical videos', () => {
            const transcoder = createTranscoder();
            const qualities = transcoder.determineQualitiesToGenerate(720, 1280);
            
            assert.ok(qualities.length > 0);
            // Should use width as reference dimension for vertical videos
        });

        test('should return empty array for very low resolution', () => {
            const transcoder = createTranscoder();
            const qualities = transcoder.determineQualitiesToGenerate(100, 100);
            
            assert.strictEqual(qualities.length, 0);
        });
    });

    describe('calculateDimensions', () => {
        test('should calculate dimensions preserving aspect ratio', () => {
            const transcoder = createTranscoder();
            const result = transcoder.calculateDimensions(1920, 1080, 720);
            
            assert.strictEqual(result.height, 720);
            assert.strictEqual(result.width, 1280); // 16:9 aspect ratio
        });

        test('should handle vertical videos', () => {
            const transcoder = createTranscoder();
            // For vertical videos, height > width, so we scale by width
            // If target height is 720, we calculate width preserving aspect ratio
            const result = transcoder.calculateDimensions(720, 1280, 720);
            
            // For vertical videos, the method scales based on the target height
            // Aspect ratio: 720/1280 = 0.5625
            // If height is 720, width should be 720 * 0.5625 = 405 (rounded to even: 406)
            assert.strictEqual(result.height, 720);
            assert.ok(result.width > 0);
            assert.strictEqual(result.width % 2, 0); // Must be divisible by 2
        });

        test('should ensure dimensions are divisible by 2', () => {
            const transcoder = createTranscoder();
            const result = transcoder.calculateDimensions(1921, 1081, 720);
            
            assert.strictEqual(result.width % 2, 0);
            assert.strictEqual(result.height % 2, 0);
        });
    });

    describe('estimateBandwidth', () => {
        test('should estimate bandwidth from bitrate string', () => {
            const transcoder = createTranscoder();
            assert.strictEqual(transcoder.estimateBandwidth('2800k'), 2800000);
            assert.strictEqual(transcoder.estimateBandwidth('5m'), 5000000);
            assert.strictEqual(transcoder.estimateBandwidth('1g'), 1000000000);
            assert.strictEqual(transcoder.estimateBandwidth('1000'), 1000);
        });

        test('should return default for invalid bitrate', () => {
            const transcoder = createTranscoder();
            const result = transcoder.estimateBandwidth('invalid');
            assert.strictEqual(result, 1000000); // Default 1Mbps
        });
    });

    describe('generateMasterPlaylist', () => {
        test('should generate master playlist with all variants', async () => {
            const transcoder = createTranscoder();
            const outputDir = path.join(__dirname, 'temp-test');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const variants = [
                { quality: '360p', width: 640, height: 360, bitrate: '800k' },
                { quality: '720p', width: 1280, height: 720, bitrate: '2800k' },
                { quality: '1080p', width: 1920, height: 1080, bitrate: '5000k' }
            ];

            const masterPlaylistPath = path.join(outputDir, 'master.m3u8');
            await transcoder.generateMasterPlaylist(outputDir, variants, masterPlaylistPath);

            assert.ok(fs.existsSync(masterPlaylistPath));

            const content = fs.readFileSync(masterPlaylistPath, 'utf8');
            assert.ok(content.includes('#EXTM3U'));
            assert.ok(content.includes('#EXT-X-VERSION:3'));
            assert.ok(content.includes('360p.m3u8'));
            assert.ok(content.includes('720p.m3u8'));
            assert.ok(content.includes('1080p.m3u8'));
            assert.ok(content.includes('BANDWIDTH='));

            // Cleanup
            if (fs.existsSync(masterPlaylistPath)) {
                fs.unlinkSync(masterPlaylistPath);
            }
            if (fs.existsSync(outputDir)) {
                fs.rmdirSync(outputDir);
            }
        });

        test('should sort variants by resolution', async () => {
            const transcoder = createTranscoder();
            const outputDir = path.join(__dirname, 'temp-test');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const variants = [
                { quality: '1080p', width: 1920, height: 1080, bitrate: '5000k' },
                { quality: '360p', width: 640, height: 360, bitrate: '800k' },
                { quality: '720p', width: 1280, height: 720, bitrate: '2800k' }
            ];

            const masterPlaylistPath = path.join(outputDir, 'master.m3u8');
            await transcoder.generateMasterPlaylist(outputDir, variants, masterPlaylistPath);

            const content = fs.readFileSync(masterPlaylistPath, 'utf8');
            const lines = content.split('\n');
            const playlistLines = lines.filter(line => line.endsWith('.m3u8'));

            // Should be sorted ascending by resolution
            assert.strictEqual(playlistLines[0], '360p.m3u8');
            assert.strictEqual(playlistLines[1], '720p.m3u8');
            assert.strictEqual(playlistLines[2], '1080p.m3u8');

            // Cleanup
            if (fs.existsSync(masterPlaylistPath)) {
                fs.unlinkSync(masterPlaylistPath);
            }
            if (fs.existsSync(outputDir)) {
                fs.rmdirSync(outputDir);
            }
        });
    });
});

