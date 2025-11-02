// Shared: Advanced Chunked Upload Manager
// Includes WebWorker hashing, compression, and optimized performance
import api from './client';
import SparkMD5 from 'spark-md5';

class ChunkedUploadManagerAdvanced {
    constructor(options = {}) {
        this.maxConcurrent = options.maxConcurrent || 6;
        this.chunkSize = options.chunkSize || 5 * 1024 * 1024;
        this.retryAttempts = options.retryAttempts || 3;
        this.retryDelay = options.retryDelay || 1000;
        this.useWebWorker = options.useWebWorker !== false; // Default true
        this.useCompression = options.useCompression || false;
        this.startTime = null;
        this.hashWorker = null;
        this.workerReady = false;

        // Initialize Web Worker if supported and enabled
        if (this.useWebWorker && typeof Worker !== 'undefined') {
            this.initHashWorker();
        }
    }

    /**
     * Initialize Web Worker for hash calculation
     */
    initHashWorker() {
        try {
            this.hashWorker = new Worker('/workers/hash-worker.js');

            this.hashWorker.onmessage = (e) => {
                if (e.data.action === 'ready') {
                    this.workerReady = true;
                    console.log('✅ Hash worker initialized');
                }
            };

            this.hashWorker.onerror = (error) => {
                console.error('❌ Hash worker error:', error);
                this.workerReady = false;
                // Fallback to main thread hashing
            };
        } catch (error) {
            console.warn('⚠️  Could not initialize hash worker, using main thread');
            this.hashWorker = null;
            this.workerReady = false;
        }
    }

    /**
     * Calculate hash using Web Worker (non-blocking)
     */
    async calculateHashWithWorker(blob, chunkIndex) {
        if (!this.hashWorker || !this.workerReady) {
            // Fallback to main thread
            return this.calculateHashMainThread(blob);
        }

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('Hash calculation timeout'));
            }, 30000); // 30 second timeout

            const messageHandler = (e) => {
                if (e.data.chunkIndex === chunkIndex && e.data.action === 'hashComplete') {
                    clearTimeout(timeoutId);
                    this.hashWorker.removeEventListener('message', messageHandler);

                    if (e.data.success) {
                        resolve(e.data.hash);
                    } else {
                        reject(new Error(e.data.error));
                    }
                }
            };

            this.hashWorker.addEventListener('message', messageHandler);
            this.hashWorker.postMessage({
                action: 'calculateHash',
                blob,
                chunkIndex
            });
        });
    }

    /**
     * Calculate hash on main thread (fallback)
     */
    async calculateHashMainThread(blob) {
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
     * Calculate hash (automatically uses worker if available)
     */
    async calculateHash(blob, chunkIndex) {
        if (this.useWebWorker && this.hashWorker && this.workerReady) {
            try {
                return await this.calculateHashWithWorker(blob, chunkIndex);
            } catch (error) {
                console.warn('⚠️  Worker hash failed, falling back to main thread:', error.message);
                return await this.calculateHashMainThread(blob);
            }
        }

        return await this.calculateHashMainThread(blob);
    }

    /**
     * Compress chunk before upload (if enabled)
     */
    async compressChunk(blob) {
        if (!this.useCompression) {
            return { blob, compressed: false };
        }

        try {
            // Check if CompressionStream is available
            if (typeof CompressionStream !== 'undefined') {
                const stream = blob.stream();
                const compressedStream = stream.pipeThrough(
                    new CompressionStream('gzip')
                );

                const compressedBlob = await new Response(compressedStream).blob();

                // Only use compression if it actually reduces size
                if (compressedBlob.size < blob.size * 0.9) { // 10% savings minimum
                    console.log(`  🗜️  Compressed chunk: ${blob.size} → ${compressedBlob.size} (${((1 - compressedBlob.size / blob.size) * 100).toFixed(1)}% saved)`);
                    return { blob: compressedBlob, compressed: true };
                }
            }
        } catch (error) {
            console.warn('⚠️  Compression failed:', error.message);
        }

        return { blob, compressed: false };
    }

    /**
     * Upload file with parallel chunking (advanced version)
     */
    async uploadFile(file, metadata = {}, callbacks = {}) {
        const { onProgress, onChunkComplete, onError } = callbacks;

        this.startTime = Date.now();

        try {
            const chunkSize = this.calculateOptimalChunkSize(file.size);
            const totalChunks = Math.ceil(file.size / chunkSize);

            console.log(`📦 Uploading ${(file.size / 1024 / 1024).toFixed(2)}MB in ${totalChunks} chunks of ${(chunkSize / 1024 / 1024).toFixed(2)}MB each`);
            console.log(`⚡ Using advanced features: Worker=${this.useWebWorker && this.workerReady}, Compression=${this.useCompression}`);

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

            const session = await this.initializeSession(file, totalChunks, metadata);
            console.log(`✅ Session initialized: ${session.uploadId}`);

            if (session.resumableChunks && session.resumableChunks.length > 0) {
                console.log(`♻️  Resuming: ${session.resumableChunks.length} chunks already uploaded`);
                session.resumableChunks.forEach(chunkIndex => {
                    if (chunks[chunkIndex]) {
                        chunks[chunkIndex].uploaded = true;
                    }
                });
            }

            let uploadedChunks = session.resumableChunks?.length || 0;
            let uploadedBytes = uploadedChunks * chunkSize;

            const uploadQueue = chunks.filter(chunk => !chunk.uploaded);

            if (uploadQueue.length === 0) {
                console.log('✅ All chunks already uploaded, finalizing...');
            } else {
                console.log(`🚀 Starting parallel upload of ${uploadQueue.length} chunks (${this.maxConcurrent} concurrent)`);

                // Track current upload speed from active chunks
                let currentUploadSpeed = 0;

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
                                speed: this.formatSpeed(currentUploadSpeed),
                                speedBytes: currentUploadSpeed
                            });
                        }

                        if (onChunkComplete) {
                            onChunkComplete(chunk);
                        }
                    },
                    (progressUpdate) => {
                        // Real-time speed update from active chunk uploads (XMLHttpRequest)
                        currentUploadSpeed = progressUpdate.totalSpeed;

                        // Update progress with real-time speed
                        if (onProgress) {
                            const progress = (uploadedBytes / file.size) * 100;
                            onProgress({
                                progress: Math.min(99, Math.round(progress)),
                                uploadedChunks,
                                totalChunks,
                                uploadedBytes,
                                totalBytes: file.size,
                                speed: progressUpdate.totalSpeedFormatted,
                                speedBytes: progressUpdate.totalSpeed,
                                activeChunks: progressUpdate.activeChunks,
                                chunkDetails: progressUpdate.chunkDetails
                            });
                        }
                    }
                );
            }

            console.log('🏁 Finalizing upload...');

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
    async uploadChunksParallel(chunks, uploadId, totalChunks, onChunkComplete, onProgressUpdate) {
        const activeUploads = new Set();
        const results = [];
        let chunkIndex = 0;

        // Track per-chunk progress for accurate speed calculation
        const chunkProgressMap = new Map();

        const onChunkProgress = (progressData) => {
            // Store current chunk progress
            chunkProgressMap.set(progressData.chunkIndex, progressData);

            // Calculate aggregate upload speed from all active chunks
            let totalSpeed = 0;
            chunkProgressMap.forEach((progress) => {
                if (progress.speed > 0) {
                    totalSpeed += progress.speed;
                }
            });

            // Notify parent with aggregated speed
            if (onProgressUpdate) {
                onProgressUpdate({
                    activeChunks: chunkProgressMap.size,
                    totalSpeed,
                    totalSpeedFormatted: this.formatSpeed(totalSpeed),
                    chunkDetails: Array.from(chunkProgressMap.values())
                });
            }
        };

        const uploadNext = async () => {
            if (chunkIndex >= chunks.length) return;

            const chunk = chunks[chunkIndex++];
            const uploadPromise = this.uploadChunkWithRetry(
                chunk,
                uploadId,
                totalChunks,
                onChunkProgress
            )
                .then(result => {
                    results.push(result);
                    // Remove from progress tracking when complete
                    chunkProgressMap.delete(chunk.index);
                    onChunkComplete(chunk);
                    activeUploads.delete(uploadPromise);
                })
                .catch(error => {
                    console.error(`❌ Chunk ${chunk.index} failed permanently:`, error.message);
                    chunkProgressMap.delete(chunk.index);
                    activeUploads.delete(uploadPromise);
                    throw error;
                });

            activeUploads.add(uploadPromise);

            if (activeUploads.size < this.maxConcurrent) {
                uploadNext();
            } else {
                await Promise.race(activeUploads);
                uploadNext();
            }
        };

        const initialBatch = Math.min(this.maxConcurrent, chunks.length);
        for (let i = 0; i < initialBatch; i++) {
            uploadNext();
        }

        await Promise.all(activeUploads);
        return results;
    }

    /**
     * Upload single chunk with retry logic (advanced)
     * Uses XMLHttpRequest for accurate progress tracking
     */
    async uploadChunkWithRetry(chunk, uploadId, totalChunks, onChunkProgress) {
        let lastError;

        for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
            try {
                // Calculate hash (uses worker if available)
                const hash = await this.calculateHash(chunk.blob, chunk.index);

                // Compress chunk if enabled
                const { blob: chunkBlob, compressed } = await this.compressChunk(chunk.blob);

                // Create form data
                const formData = new FormData();
                formData.append('chunk', chunkBlob);
                formData.append('chunkIndex', chunk.index.toString());
                formData.append('chunkHash', hash);
                formData.append('uploadId', uploadId);
                formData.append('totalChunks', totalChunks.toString());
                if (compressed) {
                    formData.append('compressed', 'true');
                }

                // Upload chunk using XMLHttpRequest for accurate progress tracking
                const response = await this.uploadChunkWithXHR(
                    formData,
                    chunk.index,
                    totalChunks,
                    compressed,
                    onChunkProgress
                );

                console.log(`  ✓ Chunk ${chunk.index + 1}/${totalChunks} uploaded${compressed ? ' (compressed)' : ''}`);
                return response;

            } catch (error) {
                lastError = error;
                console.warn(`  ⚠️  Chunk ${chunk.index} attempt ${attempt + 1} failed:`, error.message);

                if (attempt < this.retryAttempts - 1) {
                    const delay = this.retryDelay * Math.pow(2, attempt);
                    console.log(`  ⏳ Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw new Error(`Chunk ${chunk.index} failed after ${this.retryAttempts} attempts: ${lastError.message}`);
    }

    /**
     * Upload chunk using XMLHttpRequest with progress tracking
     * Returns a promise that resolves with the server response
     */
    async uploadChunkWithXHR(formData, chunkIndex, totalChunks, compressed, onChunkProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            let uploadStartTime = Date.now();
            let lastLoadedBytes = 0;
            let lastUpdateTime = uploadStartTime;

            // Track upload progress
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const now = Date.now();
                    const timeDelta = (now - lastUpdateTime) / 1000; // seconds
                    const bytesDelta = event.loaded - lastLoadedBytes;

                    // Calculate instantaneous upload speed for this chunk
                    let chunkSpeed = 0;
                    if (timeDelta > 0 && bytesDelta > 0) {
                        chunkSpeed = bytesDelta / timeDelta; // bytes per second
                    }

                    const chunkProgress = {
                        chunkIndex,
                        loaded: event.loaded,
                        total: event.total,
                        percentage: Math.round((event.loaded / event.total) * 100),
                        speed: chunkSpeed,
                        speedFormatted: this.formatSpeed(chunkSpeed)
                    };

                    if (onChunkProgress) {
                        onChunkProgress(chunkProgress);
                    }

                    lastLoadedBytes = event.loaded;
                    lastUpdateTime = now;
                }
            });

            // Handle successful response
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (parseError) {
                        reject(new Error('Failed to parse server response'));
                    }
                } else {
                    try {
                        const errorResponse = JSON.parse(xhr.responseText);
                        reject(new Error(errorResponse.error || `Upload failed with status ${xhr.status}`));
                    } catch {
                        reject(new Error(`Upload failed with status ${xhr.status}`));
                    }
                }
            });

            // Handle network errors
            xhr.addEventListener('error', () => {
                reject(new Error('Network error during chunk upload'));
            });

            // Handle timeout
            xhr.addEventListener('timeout', () => {
                reject(new Error('Upload timeout'));
            });

            // Handle abort
            xhr.addEventListener('abort', () => {
                reject(new Error('Upload aborted'));
            });

            // Get auth token from localStorage or session
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');

            // Get base URL from axios instance
            const baseURL = api.defaults?.baseURL || '/api';

            // Configure request
            xhr.open('POST', `${baseURL}/upload/chunk`, true);
            xhr.timeout = 120000; // 120 second timeout

            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }

            // Send request
            xhr.send(formData);
        });
    }

    /**
     * Format bytes per second to human-readable speed
     */
    formatSpeed(bytesPerSecond) {
        if (!bytesPerSecond || bytesPerSecond <= 0) {
            return '0 B/s';
        }

        const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
        const k = 1024;
        const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
        const value = (bytesPerSecond / Math.pow(k, i)).toFixed(2);

        return `${value} ${units[i]}`;
    }

    /**
     * Calculate optimal chunk size based on file size
     */
    calculateOptimalChunkSize(fileSize) {
        const fileSizeMB = fileSize / (1024 * 1024);

        if (fileSizeMB < 100) {
            return 5 * 1024 * 1024;
        } else if (fileSizeMB < 500) {
            return 10 * 1024 * 1024;
        } else if (fileSizeMB < 2000) {
            return 15 * 1024 * 1024;
        } else {
            return 20 * 1024 * 1024;
        }
    }

    /**
     * Calculate upload speed with moving average
     */
    calculateSpeed(uploadedBytes) {
        const now = Date.now();
        if (!this.startTime) {
            this.startTime = now;
            this.lastUpdateTime = now;
            this.lastUploadedBytes = 0;
            this.speedSamples = [];
            return '0 MB/s';
        }

        const timeDelta = (now - this.lastUpdateTime) / 1000; // seconds
        const bytesDelta = uploadedBytes - this.lastUploadedBytes;

        if (timeDelta > 0 && bytesDelta > 0) {
            // Calculate instantaneous speed
            const currentSpeed = bytesDelta / timeDelta;

            // Add to samples for moving average (keep last 10 samples)
            this.speedSamples = this.speedSamples || [];
            this.speedSamples.push(currentSpeed);
            if (this.speedSamples.length > 10) {
                this.speedSamples.shift();
            }

            // Calculate moving average
            const avgSpeed = this.speedSamples.reduce((a, b) => a + b, 0) / this.speedSamples.length;
            const mbPerSecond = (avgSpeed / (1024 * 1024)).toFixed(2);

            // Update tracking
            this.lastUpdateTime = now;
            this.lastUploadedBytes = uploadedBytes;

            return `${mbPerSecond} MB/s`;
        }

        // No change, return last known speed
        if (this.speedSamples && this.speedSamples.length > 0) {
            const avgSpeed = this.speedSamples.reduce((a, b) => a + b, 0) / this.speedSamples.length;
            const mbPerSecond = (avgSpeed / (1024 * 1024)).toFixed(2);
            return `${mbPerSecond} MB/s`;
        }

        return '0 MB/s';
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

    /**
     * Cleanup (terminate worker and reset state)
     */
    cleanup() {
        if (this.hashWorker) {
            this.hashWorker.terminate();
            this.hashWorker = null;
            this.workerReady = false;
            console.log('✅ Hash worker terminated');
        }

        // Reset speed tracking
        this.startTime = null;
        this.lastUpdateTime = null;
        this.lastUploadedBytes = 0;
        this.speedSamples = [];
    }
}

// Export singleton instance with advanced features
export const chunkedUploadManagerAdvanced = new ChunkedUploadManagerAdvanced({
    maxConcurrent: 6,
    chunkSize: 5 * 1024 * 1024,
    retryAttempts: 3,
    retryDelay: 1000,
    useWebWorker: true,     // Enable Web Worker for hashing
    useCompression: false   // Disable compression by default (video is already compressed)
});

export default chunkedUploadManagerAdvanced;

