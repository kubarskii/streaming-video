/**
 * ChunkedUploader Tests
 * Tests for chunked file upload functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChunkedUploader } from '../ChunkedUploader';

// Mock fetch globally
global.fetch = vi.fn();

// Mock crypto.subtle for hash calculation
const mockDigest = vi.fn(() => Promise.resolve(new ArrayBuffer(32)));
Object.defineProperty(global, 'crypto', {
    value: {
        subtle: {
            digest: mockDigest,
        },
    },
    writable: true,
    configurable: true,
});

// Mock Blob.prototype.arrayBuffer for chunk hashing
Blob.prototype.arrayBuffer = vi.fn(function () {
    // Return a mock ArrayBuffer with the same size as the blob
    return Promise.resolve(new ArrayBuffer(this.size || 0));
});

describe('ChunkedUploader', () => {
    let uploader;
    let mockFile;
    let mockProgressCallback;
    let mockChunkCompleteCallback;
    let mockErrorCallback;

    beforeEach(() => {
        // Reset fetch mock
        fetch.mockReset();

        // Create mock callbacks
        mockProgressCallback = vi.fn();
        mockChunkCompleteCallback = vi.fn();
        mockErrorCallback = vi.fn();

        // Create mock file (10MB)
        const mockData = new Array(10 * 1024 * 1024).fill(0);
        mockFile = new File([new Uint8Array(mockData)], 'test-video.mp4', {
            type: 'video/mp4',
        });

        // Mock localStorage
        global.localStorage = {
            getItem: vi.fn(() => 'mock-token'),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        };

        // Create uploader instance
        uploader = new ChunkedUploader({
            chunkSize: 5 * 1024 * 1024, // 5MB
            maxConcurrent: 2,
            maxRetries: 2,
            onProgress: mockProgressCallback,
            onChunkComplete: mockChunkCompleteCallback,
            onError: mockErrorCallback,
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('initialization', () => {
        it('should create uploader with default options', () => {
            const defaultUploader = new ChunkedUploader();
            expect(defaultUploader.chunkSize).toBe(5 * 1024 * 1024);
            expect(defaultUploader.maxConcurrent).toBe(3);
            expect(defaultUploader.maxRetries).toBe(3);
        });

        it('should create uploader with custom options', () => {
            expect(uploader.chunkSize).toBe(5 * 1024 * 1024);
            expect(uploader.maxConcurrent).toBe(2);
            expect(uploader.maxRetries).toBe(2);
        });

        it('should have an AbortController', () => {
            expect(uploader.abortController).toBeInstanceOf(AbortController);
        });
    });

    describe('prepareChunks', () => {
        it('should split file into chunks', async () => {
            const chunks = await uploader.prepareChunks(mockFile);

            // 10MB file with 5MB chunks = 2 chunks
            expect(chunks).toHaveLength(2);
            expect(chunks[0].index).toBe(0);
            expect(chunks[1].index).toBe(1);
        });

        it('should calculate hash for each chunk', async () => {
            const chunks = await uploader.prepareChunks(mockFile);

            chunks.forEach(chunk => {
                expect(chunk.hash).toBeDefined();
                expect(typeof chunk.hash).toBe('string');
            });
        });

        it('should set correct chunk sizes', async () => {
            const chunks = await uploader.prepareChunks(mockFile);

            expect(chunks[0].size).toBe(5 * 1024 * 1024);
            expect(chunks[1].size).toBe(5 * 1024 * 1024);
        });
    });

    describe('upload initialization', () => {
        it('should initialize upload session', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    uploadId: 'test-upload-id',
                    resumableChunks: [],
                    chunkSize: 5242880,
                }),
            });

            const response = await uploader.initializeUpload(mockFile, {
                title: 'Test Video',
                description: 'Test description',
            });

            expect(fetch).toHaveBeenCalledWith('/api/upload/init', expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'Content-Type': 'application/json',
                }),
            }));

            expect(response.uploadId).toBe('test-upload-id');
        });

        it('should handle initialization failure', async () => {
            fetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
            });

            await expect(uploader.initializeUpload(mockFile)).rejects.toThrow(
                'Failed to initialize upload'
            );
        });

        it('should include authentication token', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ uploadId: 'test-id' }),
            });

            await uploader.initializeUpload(mockFile);

            expect(fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer mock-token',
                    }),
                })
            );
        });
    });

    describe('chunk upload', () => {
        let mockChunk;
        let mockMetadata;

        beforeEach(() => {
            mockChunk = {
                index: 0,
                blob: new Blob(['test data']),
                hash: 'test-hash',
            };

            mockMetadata = {
                uploadId: 'test-upload-id',
                totalChunks: 2,
            };
        });

        it('should upload chunk successfully', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    chunkIndex: 0,
                    received: true,
                    hashMatch: true,
                }),
            });

            const result = await uploader.uploadChunk(mockChunk, 'test-upload-id', mockMetadata);

            expect(result.received).toBe(true);
            expect(result.hashMatch).toBe(true);
            expect(mockChunkCompleteCallback).toHaveBeenCalledWith(0, 2);
        });

        it('should retry failed chunk upload', async () => {
            // First attempt fails, second succeeds
            fetch
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ received: true }),
                });

            await uploader.uploadChunk(mockChunk, 'test-upload-id', mockMetadata);

            expect(fetch).toHaveBeenCalledTimes(2);
        });

        it('should fail after max retries', async () => {
            fetch.mockRejectedValue(new Error('Network error'));

            await expect(
                uploader.uploadChunk(mockChunk, 'test-upload-id', mockMetadata)
            ).rejects.toThrow('Network error');

            // Initial attempt + 2 retries = 3 total
            expect(fetch).toHaveBeenCalledTimes(3);
        });

        it('should handle abort signal', async () => {
            uploader.cancel();

            await expect(
                uploader.uploadChunk(mockChunk, 'test-upload-id', mockMetadata)
            ).rejects.toThrow('Upload cancelled');
        });
    });

    describe('finalize upload', () => {
        it('should finalize upload successfully', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    video: {
                        id: 'video-123',
                        title: 'Test Video',
                    },
                }),
            });

            const result = await uploader.finalizeUpload('test-upload-id', {
                fileName: 'test.mp4',
                additionalData: { title: 'Test Video' },
            });

            expect(result.video.id).toBe('video-123');
            expect(fetch).toHaveBeenCalledWith('/api/upload/finalize', expect.any(Object));
        });

        it('should handle finalization failure', async () => {
            fetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
            });

            await expect(
                uploader.finalizeUpload('test-upload-id', { fileName: 'test.mp4' })
            ).rejects.toThrow('Failed to finalize upload');
        });
    });

    describe('pause/resume/cancel', () => {
        it('should pause upload', () => {
            uploader.pause();
            expect(uploader.isPaused).toBe(true);
        });

        it('should resume upload', () => {
            uploader.pause();
            uploader.resume();
            expect(uploader.isPaused).toBe(false);
        });

        it('should cancel upload', () => {
            uploader.cancel();
            expect(uploader.isCancelled).toBe(true);
        });

        it('should abort controller when cancelled', () => {
            const abortSpy = vi.spyOn(uploader.abortController, 'abort');
            uploader.cancel();
            expect(abortSpy).toHaveBeenCalled();
        });
    });

    describe('progress tracking', () => {
        it('should track uploaded chunks', async () => {
            uploader.uploadedChunks.add(0);
            uploader.uploadedChunks.add(1);

            const progress = uploader.getProgress();
            expect(progress.uploadedChunks).toBe(2);
        });

        it('should report progress during upload', async () => {
            fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ received: true }),
            });

            const mockChunk = {
                index: 0,
                blob: new Blob(['test']),
                hash: 'hash',
                size: 100,
            };

            await uploader.uploadChunk(mockChunk, 'id', { totalChunks: 2 });

            expect(mockChunkCompleteCallback).toHaveBeenCalledWith(0, 2);
        });
    });

    describe('full upload flow', () => {
        it('should complete full upload successfully', async () => {
            // Mock init
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    uploadId: 'test-id',
                    resumableChunks: [],
                }),
            });

            // Mock chunk uploads (2 chunks)
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ received: true }),
            });
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ received: true }),
            });

            // Mock finalize
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    video: { id: 'video-123' },
                }),
            });

            const result = await uploader.upload(mockFile, {
                title: 'Test Video',
            });

            expect(result.video.id).toBe('video-123');
            expect(mockProgressCallback).toHaveBeenCalled();
            expect(mockChunkCompleteCallback).toHaveBeenCalledTimes(2);
        });

        it('should handle upload errors', async () => {
            fetch.mockRejectedValue(new Error('Upload failed'));

            await expect(
                uploader.upload(mockFile, { title: 'Test' })
            ).rejects.toThrow();

            expect(mockErrorCallback).toHaveBeenCalled();
        });
    });

    describe('edge cases', () => {
        it('should handle very small files (< chunk size)', async () => {
            const smallFile = new File([new Uint8Array(1024)], 'small.mp4', {
                type: 'video/mp4',
            });

            const chunks = await uploader.prepareChunks(smallFile);
            expect(chunks).toHaveLength(1);
        });

        it('should handle exact chunk size files', async () => {
            const exactFile = new File(
                [new Uint8Array(5 * 1024 * 1024)],
                'exact.mp4',
                { type: 'video/mp4' }
            );

            const chunks = await uploader.prepareChunks(exactFile);
            expect(chunks).toHaveLength(1);
        });

        it('should handle resumable uploads', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    uploadId: 'test-id',
                    resumableChunks: [0], // First chunk already uploaded
                }),
            });

            // Only second chunk upload
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ received: true }),
            });

            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ video: { id: 'video-123' } }),
            });

            await uploader.upload(mockFile);

            // Should only upload 1 new chunk (chunk 1)
            expect(fetch).toHaveBeenCalledTimes(3); // init + 1 chunk + finalize
        });
    });

    describe('error handling', () => {
        it('should handle network abort errors', async () => {
            const abortError = new Error('Aborted');
            abortError.name = 'AbortError';

            fetch.mockRejectedValueOnce(abortError);

            await expect(
                uploader.uploadChunk({ index: 0, blob: new Blob(), hash: 'hash' }, 'id', {
                    totalChunks: 1,
                })
            ).rejects.toThrow('Upload cancelled');
        });

        it('should calculate MD5 hash correctly', async () => {
            const chunk = new Blob(['test data']);
            const hash = await uploader.calculateMD5(chunk);

            expect(hash).toBeDefined();
            expect(typeof hash).toBe('string');
            expect(hash.length).toBeGreaterThan(0);
        });
    });
});

