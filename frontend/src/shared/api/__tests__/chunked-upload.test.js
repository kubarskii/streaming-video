// Tests for Chunked Upload Manager
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chunkedUploadManager } from '../chunked-upload';
import api from '../client';

// Mock the API client
vi.mock('../client', () => ({
    default: {
        post: vi.fn(),
        get: vi.fn(),
        delete: vi.fn()
    }
}));

// Mock SparkMD5
vi.mock('spark-md5', () => ({
    default: {
        ArrayBuffer: class {
            append() { }
            end() {
                return 'mock-hash-123';
            }
        }
    }
}));

// Mock FileReader for browser environment
class MockFileReader {
    constructor() {
        this.onload = null;
        this.onerror = null;
        this.onloadend = null;
        this.result = null;
    }

    readAsArrayBuffer(blob) {
        // Simulate async read
        setTimeout(() => {
            this.result = new ArrayBuffer(blob.size || 0);
            if (this.onload) {
                this.onload({ target: this });
            }
            if (this.onloadend) {
                this.onloadend({ target: this });
            }
        }, 0);
    }

    readAsDataURL(blob) {
        setTimeout(() => {
            this.result = 'data:application/octet-stream;base64,';
            if (this.onload) {
                this.onload({ target: this });
            }
            if (this.onloadend) {
                this.onloadend({ target: this });
            }
        }, 0);
    }
}

global.FileReader = MockFileReader;

describe('ChunkedUploadManager', () => {
    let mockFile;

    beforeEach(() => {
        // Create a mock file (10MB)
        const fileSize = 10 * 1024 * 1024;
        const blob = new Blob([new ArrayBuffer(fileSize)], { type: 'video/mp4' });
        mockFile = new File([blob], 'test-video.mp4', { type: 'video/mp4' });

        // Reset mocks
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('initializeSession', () => {
        it('should initialize upload session with correct parameters', async () => {
            const mockResponse = {
                data: {
                    uploadId: 'test-upload-id',
                    resumableChunks: [],
                    chunkSize: 5 * 1024 * 1024,
                    expiresAt: new Date().toISOString()
                }
            };

            api.post.mockResolvedValueOnce(mockResponse);

            const metadata = {
                title: 'Test Video',
                description: 'Test Description'
            };

            const session = await chunkedUploadManager.initializeSession(
                mockFile,
                2, // 2 chunks for 10MB file with 5MB chunks
                metadata
            );

            expect(api.post).toHaveBeenCalledWith('/upload/init', {
                fileName: 'test-video.mp4',
                fileSize: mockFile.size,
                mimeType: 'video/mp4',
                totalChunks: 2,
                title: 'Test Video',
                description: 'Test Description'
            });

            expect(session.uploadId).toBe('test-upload-id');
        });

        it('should handle initialization errors', async () => {
            api.post.mockRejectedValueOnce(new Error('Network error'));

            await expect(
                chunkedUploadManager.initializeSession(mockFile, 2, {})
            ).rejects.toThrow('Network error');
        });
    });

    describe('calculateOptimalChunkSize', () => {
        it('should return 5MB for small files', () => {
            const fileSize = 50 * 1024 * 1024; // 50MB
            const chunkSize = chunkedUploadManager.calculateOptimalChunkSize(fileSize);
            expect(chunkSize).toBe(5 * 1024 * 1024);
        });

        it('should return 10MB for medium files', () => {
            const fileSize = 200 * 1024 * 1024; // 200MB
            const chunkSize = chunkedUploadManager.calculateOptimalChunkSize(fileSize);
            expect(chunkSize).toBe(10 * 1024 * 1024);
        });

        it('should return 15MB for large files', () => {
            const fileSize = 800 * 1024 * 1024; // 800MB
            const chunkSize = chunkedUploadManager.calculateOptimalChunkSize(fileSize);
            expect(chunkSize).toBe(15 * 1024 * 1024);
        });

        it('should return 20MB for very large files', () => {
            const fileSize = 3 * 1024 * 1024 * 1024; // 3GB
            const chunkSize = chunkedUploadManager.calculateOptimalChunkSize(fileSize);
            expect(chunkSize).toBe(20 * 1024 * 1024);
        });
    });

    describe('calculateSpeed', () => {
        it('should calculate upload speed correctly', () => {
            // Reset start time
            chunkedUploadManager.startTime = Date.now() - 10000; // 10 seconds ago

            const uploadedBytes = 50 * 1024 * 1024; // 50MB uploaded
            const speed = chunkedUploadManager.calculateSpeed(uploadedBytes);

            // Speed should be around 5 MB/s (50MB / 10s)
            expect(speed).toContain('MB/s');
            expect(parseFloat(speed)).toBeGreaterThan(0);
        });

        it('should return 0 MB/s if no time elapsed', () => {
            chunkedUploadManager.startTime = null;
            const speed = chunkedUploadManager.calculateSpeed(0);
            expect(speed).toBe('0 MB/s');
        });
    });

    describe('uploadChunkWithRetry', () => {
        beforeEach(() => {
            // Mock calculateHash method to avoid FileReader complexity in tests
            vi.spyOn(chunkedUploadManager, 'calculateHash').mockResolvedValue('mock-hash-123');
        });

        it('should upload chunk successfully on first attempt', async () => {
            const mockChunk = {
                index: 0,
                start: 0,
                end: 5 * 1024 * 1024,
                blob: new Blob([new ArrayBuffer(5 * 1024 * 1024)])
            };

            api.post.mockResolvedValueOnce({
                data: {
                    chunkIndex: 0,
                    received: true,
                    hashMatch: true
                }
            });

            const result = await chunkedUploadManager.uploadChunkWithRetry(
                mockChunk,
                'test-upload-id',
                2
            );

            expect(result.chunkIndex).toBe(0);
            expect(result.received).toBe(true);
            expect(api.post).toHaveBeenCalledTimes(1);
        });

        it('should retry on failure and succeed', async () => {
            const mockChunk = {
                index: 0,
                start: 0,
                end: 5 * 1024 * 1024,
                blob: new Blob([new ArrayBuffer(5 * 1024 * 1024)])
            };

            // Fail first attempt, succeed on second
            api.post
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({
                    data: {
                        chunkIndex: 0,
                        received: true
                    }
                });

            const result = await chunkedUploadManager.uploadChunkWithRetry(
                mockChunk,
                'test-upload-id',
                2
            );

            expect(result.chunkIndex).toBe(0);
            expect(api.post).toHaveBeenCalledTimes(2);
        });

        it('should throw error after max retries', async () => {
            const mockChunk = {
                index: 0,
                start: 0,
                end: 5 * 1024 * 1024,
                blob: new Blob([new ArrayBuffer(5 * 1024 * 1024)])
            };

            // Fail all attempts
            api.post.mockRejectedValue(new Error('Network error'));

            await expect(
                chunkedUploadManager.uploadChunkWithRetry(
                    mockChunk,
                    'test-upload-id',
                    2
                )
            ).rejects.toThrow(/failed after \d+ attempts/);

            expect(api.post).toHaveBeenCalledTimes(3); // 3 retry attempts
        });
    });

    describe('finalizeUpload', () => {
        it('should finalize upload successfully', async () => {
            const mockResponse = {
                data: {
                    message: 'Video uploaded successfully',
                    video: {
                        id: 'video-123',
                        title: 'Test Video'
                    }
                }
            };

            api.post.mockResolvedValueOnce(mockResponse);

            const result = await chunkedUploadManager.finalizeUpload(
                'test-upload-id',
                'test-video.mp4',
                { title: 'Test Video' }
            );

            expect(api.post).toHaveBeenCalledWith('/upload/finalize', {
                uploadId: 'test-upload-id',
                fileName: 'test-video.mp4',
                title: 'Test Video'
            });

            expect(result.video.id).toBe('video-123');
        });
    });

    describe('cancelUpload', () => {
        it('should cancel upload successfully', async () => {
            api.delete.mockResolvedValueOnce({ data: { message: 'Cancelled' } });

            await chunkedUploadManager.cancelUpload('test-upload-id');

            expect(api.delete).toHaveBeenCalledWith('/upload/test-upload-id');
        });
    });

    describe('getUploadStatus', () => {
        it('should get upload status successfully', async () => {
            const mockStatus = {
                data: {
                    uploadId: 'test-upload-id',
                    uploadedChunks: 5,
                    totalChunks: 10,
                    progress: 50
                }
            };

            api.get.mockResolvedValueOnce(mockStatus);

            const status = await chunkedUploadManager.getUploadStatus('test-upload-id');

            expect(api.get).toHaveBeenCalledWith('/upload/status/test-upload-id');
            expect(status.progress).toBe(50);
        });
    });
});

