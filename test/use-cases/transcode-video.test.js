// @ts-check
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

const TranscodeVideoUseCase = require('../../src/application/use-cases/TranscodeVideoUseCase');

const createTempFile = (fileName, contents = 'stub') => {
    const baseDir = path.join(fs.realpathSync(process.cwd()), 'videos', 'temp');
    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
    }

    const tempDir = fs.mkdtempSync(path.join(baseDir, 'source-test-'));
    const filePath = path.join(tempDir, fileName);
    fs.writeFileSync(filePath, contents);
    return filePath;
};

describe('TranscodeVideoUseCase - source validation', () => {
    test('retries source download when ffprobe cannot read temp file', async () => {
        const firstPath = createTempFile('source_initial.mp4');
        const secondPath = createTempFile('source_redownload.mp4');

        const video = {
            id: 'video-123',
            title: 'Portrait Clip',
            fileName: 'portrait.mp4',
            storageKey: 'storage/portrait.mp4',
            storageUrl: 'https://cdn.example.com/portrait.mp4',
            mimeType: 'video/mp4',
            status: 'pending'
        };

        let updatedVideo;
        const videoRepository = {
            findById: async () => ({ ...video }),
            update: async (payload) => { updatedVideo = { ...payload }; return updatedVideo; }
        };

        const videoQualityRepository = {
            deleteByVideoId: async () => 0,
            save: async (variant) => variant
        };

        const storageRepository = {
            upload: async () => ({ storageUrl: 'https://cdn.example.com/output.mp4' }),
            delete: async () => {},
            getFilePath: undefined
        };

        const metadataCalls = [];
        const videoTranscoder = {
            getVideoMetadata: async (inputPath) => {
                metadataCalls.push(inputPath);
                if (inputPath === firstPath) {
                    throw new Error('Invalid data found when processing input');
                }

                return { width: 720, height: 1280, duration: 3.4, bitrate: 1200000 };
            },
            transcodeToMultipleQualities: async () => []
        };

        const useCase = new TranscodeVideoUseCase(
            videoRepository,
            videoQualityRepository,
            storageRepository,
            videoTranscoder
        );

        const downloadCalls = [];
        useCase.getSourceVideoPath = async (_video, options) => {
            downloadCalls.push(options?.forceUniqueTempFile === true);
            return downloadCalls.length === 1 ? firstPath : secondPath;
        };

        await useCase.execute(video.id);

        assert.deepStrictEqual(downloadCalls, [false, true], 'should redownload with unique temp file when probe fails');
        assert.deepStrictEqual(metadataCalls, [firstPath, secondPath], 'should retry metadata probe on new file');
        assert.strictEqual(updatedVideo.status, 'ready');
        assert.strictEqual(updatedVideo.width, 720);
        assert.strictEqual(updatedVideo.height, 1280);

        fs.rmSync(path.dirname(firstPath), { recursive: true, force: true });
        fs.rmSync(path.dirname(secondPath), { recursive: true, force: true });
    });

    test('follows redirects and only accepts video-like content when downloading sources', async (t) => {
        const server = http.createServer((req, res) => {
            if (req.url === '/redirect') {
                res.statusCode = 302;
                res.setHeader('Location', '/video.mp4');
                res.end();
                return;
            }

            if (req.url === '/video.mp4') {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'video/mp4');
                res.end('video-payload');
                return;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html');
            res.end('<html>denied</html>');
        });

        await new Promise(resolve => server.listen(0, resolve));
        t.after(() => server.close());

        const port = server.address().port;
        const video = {
            id: 'video-redirect',
            title: 'Redirect Clip',
            fileName: 'redirect.mp4',
            storageKey: 'storage/redirect.mp4',
            storageUrl: `http://localhost:${port}/redirect`,
            mimeType: 'video/mp4',
            status: 'pending'
        };

        const useCase = new TranscodeVideoUseCase(
            { findById: async () => ({ ...video }), update: async (v) => v },
            { deleteByVideoId: async () => 0, save: async (variant) => variant },
            { upload: async () => ({ storageUrl: '' }), delete: async () => {}, getFilePath: undefined },
            {
                getVideoMetadata: async () => ({ width: 10, height: 10, duration: 1, bitrate: 100 }),
                transcodeToMultipleQualities: async () => []
            }
        );

        const sourcePath = await useCase.getSourceVideoPath(video);
        const downloaded = fs.readFileSync(sourcePath, 'utf8');
        assert.strictEqual(downloaded, 'video-payload');

        // Non-video content should be rejected and cleaned up
        const htmlVideo = { ...video, id: 'video-html', storageUrl: `http://localhost:${port}/html` };
        await assert.rejects(() => useCase.getSourceVideoPath(htmlVideo), /Unexpected content type/);

        const htmlPath = path.join(process.cwd(), 'videos', 'temp', `source_${htmlVideo.id}.mp4`);
        assert.strictEqual(fs.existsSync(htmlPath), false);

        fs.unlinkSync(sourcePath);
    });
});

