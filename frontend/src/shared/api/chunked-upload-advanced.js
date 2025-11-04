// Shared: Advanced Chunked Upload Manager
// Includes WebWorker hashing and optimized parallel upload performance
import api from './client';

/**
 * Semaphore for controlling concurrent operations
 */
class Semaphore {
    constructor(max) {
        this.max = max;
        this.current = 0;
        this.queue = [];
    }

    async acquire() {
        if (this.current < this.max) {
            this.current++;
            return Promise.resolve();
        }

        return new Promise(resolve => {
            this.queue.push(resolve);
        });
    }

    release() {
        this.current--;
        if (this.queue.length > 0 && this.current < this.max) {
            this.current++;
            const resolve = this.queue.shift();
            resolve();
        }
    }

    get available() {
        return this.max - this.current;
    }

    get waiting() {
        return this.queue.length;
    }
}

class ChunkedUploadManagerAdvanced {
    constructor(options = {}) {
        this.maxConcurrent = options.maxConcurrent || 6;
        this.chunkSize = options.chunkSize || 5 * 1024 * 1024;
        this.retryAttempts = options.retryAttempts || 3;
        this.retryDelayBase = options.retryDelay || 1000;
        this.retryDelayMax = options.retryDelayMax || 30000; // Max 30s delay
        this.useWebWorker = options.useWebWorker !== false; // Default true
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
            let timeoutId;
            let messageHandler;

            const cleanup = () => {
                if (timeoutId) clearTimeout(timeoutId);
                if (messageHandler && this.hashWorker) {
                    this.hashWorker.removeEventListener('message', messageHandler);
                }
            };

            timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error('Hash calculation timeout'));
            }, 30000); // 30 second timeout

            messageHandler = (e) => {
                if (e.data.chunkIndex === chunkIndex && e.data.action === 'hashComplete') {
                    cleanup();

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
     * Uses SHA-256 to match server-side validation
     */
    async calculateHashMainThread(blob) {
        const arrayBuffer = await blob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
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
     * Upload file with parallel chunking (advanced version)
     */
    async uploadFile(file, metadata = {}, callbacks = {}) {
        const { onProgress, onChunkComplete, onError } = callbacks;

        this.startTime = Date.now();

        try {
            const chunkSize = this.calculateOptimalChunkSize(file.size);
            const totalChunks = Math.ceil(file.size / chunkSize);

            console.log(`📦 Uploading ${(file.size / 1024 / 1024).toFixed(2)}MB in ${totalChunks} chunks of ${(chunkSize / 1024 / 1024).toFixed(2)}MB each`);
            console.log(`⚡ Using Web Worker for hashing: ${this.useWebWorker && this.workerReady}`);

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
     * Upload chunks in parallel with semaphore-based concurrency control
     */
    async uploadChunksParallel(chunks, uploadId, totalChunks, onChunkComplete, onProgressUpdate) {
        // Create semaphore to limit concurrent uploads
        const semaphore = new Semaphore(this.maxConcurrent);
        
        // Track per-chunk progress for accurate speed calculation
        const chunkProgressMap = new Map();
        const results = new Array(chunks.length); // Store results in order
        const errors = new Map(); // Track errors by chunk index
        
        let completedCount = 0;

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
                    activeChunks: semaphore.max - semaphore.available,
                    totalSpeed,
                    totalSpeedFormatted: this.formatSpeed(totalSpeed),
                    chunkDetails: Array.from(chunkProgressMap.values())
                });
            }
        };

        // Upload a single chunk with semaphore control
        const uploadChunkWithSemaphore = async (chunk) => {
            // Acquire semaphore slot (blocks if max concurrent reached)
            await semaphore.acquire();
            
            try {
                const result = await this.uploadChunkWithRetry(
                    chunk,
                    uploadId,
                    totalChunks,
                    onChunkProgress
                );
                
                // Store result at correct index
                results[chunk.index] = result;
                
                // Clean up progress tracking
                chunkProgressMap.delete(chunk.index);
                
                // Notify completion
                if (onChunkComplete) {
                    onChunkComplete(chunk);
                }
                
                completedCount++;
                return { success: true, chunk, result };
                
            } catch (error) {
                console.error(`❌ Chunk ${chunk.index} failed after all retries:`, error.message);
                errors.set(chunk.index, error);
                chunkProgressMap.delete(chunk.index);
                completedCount++;
                return { success: false, chunk, error };
                
            } finally {
                // Always release semaphore slot
                semaphore.release();
            }
        };

        console.log(`  🔄 Starting upload with max ${this.maxConcurrent} concurrent connections`);
        
        // Start all uploads (semaphore controls concurrency)
        const uploadPromises = chunks.map(chunk => uploadChunkWithSemaphore(chunk));
        
        // Wait for all uploads to complete
        await Promise.all(uploadPromises);

        console.log(`  ✅ Completed ${completedCount}/${chunks.length} chunks`);

        // Check if any chunks failed
        if (errors.size > 0) {
            const failedIndices = Array.from(errors.keys()).sort((a, b) => a - b).join(', ');
            throw new Error(`Failed to upload ${errors.size} chunk(s) at indices: [${failedIndices}]. Please retry the upload.`);
        }

        return results;
    }

    /**
     * Upload chunk with exponential backoff retry
     * Uses XMLHttpRequest for accurate progress tracking
     */
    async uploadChunkWithRetry(chunk, uploadId, totalChunks, onChunkProgress) {
        let lastError;

        for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
            try {
                // Calculate hash of chunk
                const hash = await this.calculateHash(chunk.blob, chunk.index);

                // Create form data
                const formData = new FormData();
                formData.append('chunk', chunk.blob);
                formData.append('chunkIndex', chunk.index.toString());
                formData.append('chunkHash', hash);
                formData.append('uploadId', uploadId);
                formData.append('totalChunks', totalChunks.toString());

                // Upload chunk using XMLHttpRequest for accurate progress tracking
                const response = await this.uploadChunkWithXHR(
                    formData,
                    chunk.index,
                    totalChunks,
                    onChunkProgress
                );

                if (attempt > 0) {
                    console.log(`  ✓ Chunk ${chunk.index + 1}/${totalChunks} uploaded (after ${attempt + 1} attempts)`);
                } else {
                    console.log(`  ✓ Chunk ${chunk.index + 1}/${totalChunks} uploaded`);
                }
                return response;

            } catch (error) {
                lastError = error;
                const attemptNum = attempt + 1;
                
                if (attempt < this.retryAttempts - 1) {
                    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
                    const delay = Math.min(
                        this.retryDelayBase * Math.pow(2, attempt),
                        this.retryDelayMax
                    );
                    
                    // Add jitter (±20%) to prevent thundering herd
                    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
                    const finalDelay = Math.round(delay + jitter);
                    
                    console.warn(`  ⚠️  Chunk ${chunk.index} attempt ${attemptNum}/${this.retryAttempts} failed: ${error.message}`);
                    console.log(`  ⏳ Retrying in ${(finalDelay / 1000).toFixed(1)}s...`);
                    
                    await new Promise(resolve => setTimeout(resolve, finalDelay));
                } else {
                    console.error(`  ❌ Chunk ${chunk.index} attempt ${attemptNum}/${this.retryAttempts} failed: ${error.message}`);
                }
            }
        }

        throw new Error(`Chunk ${chunk.index} failed after ${this.retryAttempts} attempts: ${lastError?.message || 'Unknown error'}`);
    }

    /**
     * Upload chunk using XMLHttpRequest with progress tracking
     * Returns a promise that resolves with the server response
     */
    async uploadChunkWithXHR(formData, chunkIndex, totalChunks, onChunkProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            let uploadStartTime = Date.now();
            let lastLoadedBytes = 0;
            let lastUpdateTime = uploadStartTime;
            let lastProgressEmit = 0;
            const PROGRESS_THROTTLE = 100; // Emit progress max every 100ms (10 times/sec)
            
            // Speed smoothing with moving average
            const speedSamples = [];
            const MAX_SPEED_SAMPLES = 5;

            // Track upload progress
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const now = Date.now();
                    
                    // Throttle progress updates to avoid overwhelming the UI
                    if (now - lastProgressEmit < PROGRESS_THROTTLE) {
                        return;
                    }
                    
                    const timeDelta = (now - lastUpdateTime) / 1000; // seconds
                    const bytesDelta = event.loaded - lastLoadedBytes;

                    // Calculate instantaneous upload speed for this chunk
                    let chunkSpeed = 0;
                    if (timeDelta > 0 && bytesDelta > 0) {
                        chunkSpeed = bytesDelta / timeDelta; // bytes per second
                        
                        // Add to samples for moving average (smoother display)
                        speedSamples.push(chunkSpeed);
                        if (speedSamples.length > MAX_SPEED_SAMPLES) {
                            speedSamples.shift();
                        }
                    }
                    
                    // Use moving average for smoother speed display
                    const avgSpeed = speedSamples.length > 0
                        ? speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length
                        : 0;

                    const chunkProgress = {
                        chunkIndex,
                        loaded: event.loaded,
                        total: event.total,
                        percentage: Math.round((event.loaded / event.total) * 100),
                        speed: avgSpeed, // Use smoothed speed
                        speedFormatted: this.formatSpeed(avgSpeed)
                    };

                    if (onChunkProgress) {
                        onChunkProgress(chunkProgress);
                    }

                    lastLoadedBytes = event.loaded;
                    lastUpdateTime = now;
                    lastProgressEmit = now;
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
    useWebWorker: true     // Enable Web Worker for hashing
});

export default chunkedUploadManagerAdvanced;

