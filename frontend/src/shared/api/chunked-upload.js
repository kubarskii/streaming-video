// Shared: Chunked Upload Manager
// High-performance parallel chunked upload with retry and resume
import api from './client';
import SparkMD5 from 'spark-md5';

class ChunkedUploadManager {
    constructor(options = {}) {
        this.maxConcurrent = options.maxConcurrent || 6; // Upload 6 chunks simultaneously
        this.chunkSize = options.chunkSize || 5 * 1024 * 1024; // 5MB default
        this.retryAttempts = options.retryAttempts || 3;
        this.retryDelay = options.retryDelay || 1000;
        this.startTime = null;
    }

    /**
     * Upload file with parallel chunking
     * @param {File} file - File to upload
     * @param {Object} metadata - Title, description, etc
     * @param {Object} callbacks - Progress callbacks
     */
    async uploadFile(file, metadata = {}, callbacks = {}) {
        const { onProgress, onChunkComplete, onError } = callbacks;

        this.startTime = Date.now();

        try {
            // Calculate optimal chunk size
            const chunkSize = this.calculateOptimalChunkSize(file.size);
            const totalChunks = Math.ceil(file.size / chunkSize);

            console.log(`📦 Uploading ${(file.size / 1024 / 1024).toFixed(2)}MB in ${totalChunks} chunks of ${(chunkSize / 1024 / 1024).toFixed(2)}MB each`);

            // Create chunks array
            const chunks = [];
            for (let i = 0; i < totalChunks; i++) {
                const start = i * chunkSize;
                const end = Math.min(start + chunkSize, file.size);
                chunks.push({
                    index: i,
                    start,
                    end,
                    blob: file.slice(start, end),
                    uploaded: false,
                    retries: 0
                });
            }

            // Initialize upload session
            const session = await this.initializeSession(file, totalChunks, metadata);
            console.log(`✅ Session initialized: ${session.uploadId}`);

            // Mark already uploaded chunks (for resume)
            if (session.resumableChunks && session.resumableChunks.length > 0) {
                console.log(`♻️  Resuming: ${session.resumableChunks.length} chunks already uploaded`);
                session.resumableChunks.forEach(chunkIndex => {
                    if (chunks[chunkIndex]) {
                        chunks[chunkIndex].uploaded = true;
                    }
                });
            }

            // Track progress
            let uploadedChunks = session.resumableChunks?.length || 0;
            let uploadedBytes = uploadedChunks * chunkSize;

            // Upload chunks with concurrency control
            const uploadQueue = chunks.filter(chunk => !chunk.uploaded);

            if (uploadQueue.length === 0) {
                console.log('✅ All chunks already uploaded, finalizing...');
            } else {
                console.log(`🚀 Starting parallel upload of ${uploadQueue.length} chunks (${this.maxConcurrent} concurrent)`);

                await this.uploadChunksParallel(
                    uploadQueue,
                    session.uploadId,
                    totalChunks,
                    (chunk) => {
                        uploadedChunks++;
                        uploadedBytes += chunk.end - chunk.start;
                        const progress = (uploadedBytes / file.size) * 100;

                        if (onProgress) {
                            onProgress({
                                progress: Math.min(99, Math.round(progress)),
                                uploadedChunks,
                                totalChunks,
                                uploadedBytes,
                                totalBytes: file.size,
                                speed: this.calculateSpeed(uploadedBytes)
                            });
                        }

                        if (onChunkComplete) {
                            onChunkComplete(chunk);
                        }
                    }
                );
            }

            console.log('🏁 Finalizing upload...');

            // Finalize upload
            const finalResult = await this.finalizeUpload(session.uploadId, file.name, metadata);

            if (onProgress) {
                onProgress({
                    progress: 100,
                    uploadedChunks: totalChunks,
                    totalChunks,
                    uploadedBytes: file.size,
                    totalBytes: file.size,
                    speed: this.calculateSpeed(file.size)
                });
            }

            const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);
            const avgSpeed = ((file.size / 1024 / 1024) / duration).toFixed(2);
            console.log(`✅ Upload complete in ${duration}s (${avgSpeed} MB/s average)`);

            return finalResult;

        } catch (error) {
            console.error('❌ Upload failed:', error);
            if (onError) {
                onError(error);
            }
            throw error;
        }
    }

    /**
     * Upload chunks in parallel with concurrency control
     */
    async uploadChunksParallel(chunks, uploadId, totalChunks, onChunkComplete) {
        const activeUploads = new Set();
        const results = [];
        let chunkIndex = 0;

        const uploadNext = async () => {
            if (chunkIndex >= chunks.length) return;

            const chunk = chunks[chunkIndex++];
            const uploadPromise = this.uploadChunkWithRetry(chunk, uploadId, totalChunks)
                .then(result => {
                    results.push(result);
                    onChunkComplete(chunk);
                    activeUploads.delete(uploadPromise);
                })
                .catch(error => {
                    console.error(`❌ Chunk ${chunk.index} failed permanently:`, error.message);
                    activeUploads.delete(uploadPromise);
                    throw error;
                });

            activeUploads.add(uploadPromise);

            // If we haven't reached max concurrent, start next upload immediately
            if (activeUploads.size < this.maxConcurrent) {
                uploadNext();
            } else {
                // Wait for any upload to complete before starting next
                await Promise.race(activeUploads);
                uploadNext();
            }
        };

        // Start initial batch of uploads
        const initialBatch = Math.min(this.maxConcurrent, chunks.length);
        for (let i = 0; i < initialBatch; i++) {
            uploadNext();
        }

        // Wait for all uploads to complete
        await Promise.all(activeUploads);
        return results;
    }

    /**
     * Upload single chunk with retry logic
     */
    async uploadChunkWithRetry(chunk, uploadId, totalChunks) {
        let lastError;

        for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
            try {
                // Calculate chunk hash
                const hash = await this.calculateHash(chunk.blob);

                // Create form data
                const formData = new FormData();
                formData.append('chunk', chunk.blob);
                formData.append('chunkIndex', chunk.index.toString());
                formData.append('chunkHash', hash);
                formData.append('uploadId', uploadId);
                formData.append('totalChunks', totalChunks.toString());

                // Upload chunk
                const response = await api.post('/upload/chunk', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    timeout: 120000 // 120 second timeout per chunk
                });

                console.log(`  ✓ Chunk ${chunk.index + 1}/${totalChunks} uploaded`);
                return response.data;

            } catch (error) {
                lastError = error;
                console.warn(`  ⚠️  Chunk ${chunk.index} attempt ${attempt + 1} failed:`, error.message);

                if (attempt < this.retryAttempts - 1) {
                    // Exponential backoff
                    const delay = this.retryDelay * Math.pow(2, attempt);
                    console.log(`  ⏳ Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw new Error(`Chunk ${chunk.index} failed after ${this.retryAttempts} attempts: ${lastError.message}`);
    }

    /**
     * Calculate MD5 hash of chunk
     */
    async calculateHash(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const spark = new SparkMD5.ArrayBuffer();
                spark.append(e.target.result);
                resolve(spark.end());
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(blob);
        });
    }

    /**
     * Initialize upload session
     */
    async initializeSession(file, totalChunks, metadata) {
        const response = await api.post('/upload/init', {
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            totalChunks,
            title: metadata.title,
            description: metadata.description
        });

        return response.data;
    }

    /**
     * Finalize upload
     */
    async finalizeUpload(uploadId, fileName, metadata) {
        const response = await api.post('/upload/finalize', {
            uploadId,
            fileName,
            title: metadata.title,
            description: metadata.description
        });

        return response.data;
    }

    /**
     * Calculate upload speed
     */
    calculateSpeed(uploadedBytes) {
        const now = Date.now();
        if (!this.startTime) {
            this.startTime = now;
            return '0 MB/s';
        }

        const elapsedSeconds = (now - this.startTime) / 1000;
        if (elapsedSeconds === 0) return '0 MB/s';

        const bytesPerSecond = uploadedBytes / elapsedSeconds;
        const mbPerSecond = (bytesPerSecond / (1024 * 1024)).toFixed(2);

        return `${mbPerSecond} MB/s`;
    }

    /**
     * Calculate optimal chunk size based on file size
     */
    calculateOptimalChunkSize(fileSize) {
        const fileSizeMB = fileSize / (1024 * 1024);

        if (fileSizeMB < 100) {
            // Small files: 5MB chunks
            return 5 * 1024 * 1024;
        } else if (fileSizeMB < 500) {
            // Medium files: 10MB chunks
            return 10 * 1024 * 1024;
        } else if (fileSizeMB < 2000) {
            // Large files: 15MB chunks
            return 15 * 1024 * 1024;
        } else {
            // Very large files: 20MB chunks
            return 20 * 1024 * 1024;
        }
    }

    /**
     * Cancel upload session
     */
    async cancelUpload(uploadId) {
        try {
            await api.delete(`/upload/${uploadId}`);
            console.log('Upload cancelled successfully');
        } catch (error) {
            console.error('Failed to cancel upload:', error);
            throw error;
        }
    }

    /**
     * Get upload status
     */
    async getUploadStatus(uploadId) {
        try {
            const response = await api.get(`/upload/status/${uploadId}`);
            return response.data;
        } catch (error) {
            console.error('Failed to get upload status:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const chunkedUploadManager = new ChunkedUploadManager({
    maxConcurrent: 6, // Upload 6 chunks simultaneously
    chunkSize: 5 * 1024 * 1024, // 5MB default (will be adaptive)
    retryAttempts: 3,
    retryDelay: 1000
});

export default chunkedUploadManager;

