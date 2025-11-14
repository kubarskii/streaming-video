// Shared: Advanced Chunked Upload Manager
// Includes WebWorker hashing and optimized parallel upload performance
import api from './client';

/**
 * Simple Observable implementation for upload progress tracking
 */
class Observable {
    constructor() {
        this.subscribers = new Set();
    }

    /**
     * Subscribe to observable events
     * @param {Function} callback - Callback function to receive events
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
        this.subscribers.add(callback);
        return () => {
            this.subscribers.delete(callback);
        };
    }

    /**
     * Emit an event to all subscribers
     * @param {*} data - Data to emit
     */
    emit(data) {
        this.subscribers.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('Error in observable subscriber:', error);
            }
        });
    }

    /**
     * Get current subscriber count
     */
    get subscriberCount() {
        return this.subscribers.size;
    }
}

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

        // Pause/resume state
        this.isPaused = false;
        this.abortController = null;
        this.currentUploadState = null;

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
        try {
            if (this.useWebWorker && this.hashWorker && this.workerReady) {
                try {
                    return await this.calculateHashWithWorker(blob, chunkIndex);
                } catch (error) {
                    console.warn(`⚠️  Worker hash failed for chunk ${chunkIndex}, falling back to main thread:`, error.message);
                    return await this.calculateHashMainThread(blob);
                }
            }

            return await this.calculateHashMainThread(blob);
        } catch (error) {
            console.error(`❌ Hash calculation failed for chunk ${chunkIndex}:`, error);
            throw error;
        }
    }


    /**
     * Pause the current upload
     */
    pause() {
        if (!this.isPaused && this.abortController) {
            console.log('⏸️  Pausing upload...');
            this.isPaused = true;
            this.abortController.abort();

            // Save state to localStorage for persistence
            this.saveStateToStorage();
        }
    }

    /**
     * Save upload state to localStorage
     */
    saveStateToStorage() {
        if (!this.currentUploadState) return;

        const { file, metadata, session } = this.currentUploadState;

        // Store minimal state (can't store File object, only metadata)
        const stateToSave = {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            metadata: metadata,
            uploadId: session.uploadId,
            timestamp: Date.now()
        };

        localStorage.setItem('pausedUpload', JSON.stringify(stateToSave));
        console.log('💾 Upload state saved to localStorage');
    }

    /**
     * Load upload state from localStorage
     */
    static loadStateFromStorage() {
        try {
            const saved = localStorage.getItem('pausedUpload');
            if (!saved) return null;

            const state = JSON.parse(saved);

            // Check if state is recent (within 24 hours)
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours
            if (Date.now() - state.timestamp > maxAge) {
                localStorage.removeItem('pausedUpload');
                return null;
            }

            return state;
        } catch (error) {
            console.error('Failed to load upload state:', error);
            return null;
        }
    }

    /**
     * Clear saved upload state
     */
    static clearSavedState() {
        localStorage.removeItem('pausedUpload');
        console.log('🗑️  Saved upload state cleared');
    }

    /**
     * Resume a paused upload
     */
    async resume() {
        if (this.isPaused && this.currentUploadState) {
            console.log('▶️  Resuming upload...');
            this.isPaused = false;

            // Restart the upload with saved state
            return this.continueUpload(this.currentUploadState);
        }
    }

    /**
     * Upload file with parallel chunking (advanced version)
     * Uses Observable pattern for precise progress tracking
     * @param {File} file - File to upload
     * @param {Object} metadata - File metadata (title, description, etc.)
     * @param {Object} callbacks - Callback functions (onProgress, onChunkComplete, onError)
     * @returns {Promise} Promise that resolves with upload result
     */
    async uploadFile(file, metadata = {}, callbacks = {}) {
        const { onProgress, onChunkComplete, onError } = callbacks;

        // Create main upload observable for external subscription
        const uploadObservable = new Observable();

        this.startTime = Date.now();
        this.isPaused = false;
        this.abortController = new AbortController();

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

            // Store upload state for pause/resume
            this.currentUploadState = {
                file,
                metadata,
                callbacks,
                chunks,
                session,
                chunkSize,
                totalChunks,
                observable: uploadObservable // Expose observable for external subscription
            };

            let uploadedChunks = session.resumableChunks?.length || 0;
            let uploadedBytes = uploadedChunks * chunkSize;

            const uploadQueue = chunks.filter(chunk => !chunk.uploaded);

            if (uploadQueue.length === 0) {
                console.log('✅ All chunks already uploaded, finalizing...');
            } else {
                console.log(`🚀 Starting parallel upload of ${uploadQueue.length} chunks (${this.maxConcurrent} concurrent)`);

                // Get Observable and Promise from uploadChunksParallel
                const { observable, promise } = this.uploadChunksParallel(
                    uploadQueue,
                    session.uploadId,
                    totalChunks,
                    (chunk) => {
                        if (onChunkComplete) {
                            onChunkComplete(chunk);
                        }
                    },
                    this.abortController.signal
                );

                // Subscribe to aggregated progress events
                const unsubscribe = observable.subscribe((event) => {
                    if (event.type === 'upload-progress') {
                        // Calculate total progress including already uploaded chunks
                        const totalUploadedChunks = event.uploadedChunks + uploadedChunks;
                        const totalUploadedBytes = event.uploadedBytes + uploadedBytes;
                        const totalProgress = (totalUploadedBytes / file.size) * 100;

                        // Emit to main upload observable
                        uploadObservable.emit({
                            type: 'upload-progress',
                            progress: totalProgress, // Precise percentage
                            uploadedChunks: totalUploadedChunks,
                            totalChunks,
                            uploadedBytes: totalUploadedBytes,
                            totalBytes: file.size,
                            speed: event.speedFormatted,
                            speedBytes: event.speed,
                            activeChunks: event.activeChunks,
                            chunkDetails: event.chunkDetails,
                            timestamp: event.timestamp
                        });

                        // Update with precise progress from Observable
                        if (onProgress) {
                            onProgress({
                                progress: totalProgress, // Precise percentage (not rounded)
                                uploadedChunks: totalUploadedChunks,
                                totalChunks,
                                uploadedBytes: totalUploadedBytes,
                                totalBytes: file.size,
                                speed: event.speedFormatted,
                                speedBytes: event.speed,
                                activeChunks: event.activeChunks,
                                chunkDetails: event.chunkDetails
                            });
                        }
                    } else if (event.type === 'upload-complete') {
                        // All chunks uploaded
                        uploadObservable.emit({
                            type: 'upload-complete',
                            progress: 100,
                            uploadedChunks: totalChunks,
                            totalChunks,
                            uploadedBytes: file.size,
                            totalBytes: file.size,
                            speed: event.speedFormatted || '0 MB/s',
                            speedBytes: event.speed || 0,
                            activeChunks: 0,
                            timestamp: event.timestamp
                        });

                        if (onProgress) {
                            onProgress({
                                progress: 100,
                                uploadedChunks: totalChunks,
                                totalChunks,
                                uploadedBytes: file.size,
                                totalBytes: file.size,
                                speed: event.speedFormatted || '0 MB/s',
                                speedBytes: event.speed || 0,
                                activeChunks: 0
                            });
                        }
                    }
                });

                // Wait for all chunks to upload
                await promise;

                // Unsubscribe from observable
                unsubscribe();
            }

            // Check if paused before finalizing
            if (this.isPaused) {
                console.log('⏸️  Upload paused');
                return { paused: true, uploadId: session.uploadId };
            }

            // All chunks uploaded successfully on client side
            // Proceed directly to finalization - backend will verify all chunks are present
            console.log('🏁 All chunks uploaded, finalizing upload...');

            const finalResult = await this.finalizeUpload(session.uploadId, file.name, metadata);

            // Clear state on success
            this.currentUploadState = null;
            ChunkedUploadManagerAdvanced.clearSavedState();

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
            console.log('📦 Final result:', finalResult);

            return finalResult;

        } catch (error) {
            // Don't treat pause as an error
            if (error.name === 'AbortError' && this.isPaused) {
                console.log('⏸️  Upload paused');
                return { paused: true, uploadId: this.currentUploadState?.session?.uploadId };
            }

            console.error('❌ Upload failed:', error);
            console.error('❌ Error details:', {
                message: error.message,
                name: error.name,
                stack: error.stack,
                failedChunks: error.failedChunks,
                missingChunks: error.missingChunks,
                response: error.response?.data
            });

            if (onError) {
                onError(error);
            }
            throw error;
        }
    }

    /**
     * Continue a paused or incomplete upload
     */
    async continueUpload(savedState) {
        const { file, metadata, callbacks } = savedState;

        // Reinitialize abort controller
        this.abortController = new AbortController();
        this.isPaused = false;

        // Call uploadFile which will automatically resume from where it left off
        return this.uploadFile(file, metadata, callbacks);
    }

    /**
     * Upload chunks in parallel with semaphore-based concurrency control
     * Returns an Observable that emits aggregated progress events
     * @param {Array} chunks - Array of chunk objects
     * @param {string} uploadId - Upload session ID
     * @param {number} totalChunks - Total number of chunks
     * @param {Function} onChunkComplete - Callback when chunk completes
     * @param {AbortSignal} abortSignal - Abort signal for cancellation
     * @returns {Object} Object with { observable: Observable, promise: Promise<Array> }
     */
    uploadChunksParallel(chunks, uploadId, totalChunks, onChunkComplete, abortSignal) {
        // Create aggregated observable for all chunks
        const aggregatedObservable = new Observable();

        // Create semaphore to limit concurrent uploads
        const semaphore = new Semaphore(this.maxConcurrent);

        // Track per-chunk progress for accurate speed calculation
        const chunkProgressMap = new Map();
        const chunkSizes = new Map(); // Track chunk sizes for precise progress
        const results = new Array(chunks.length); // Store results in order
        const errors = new Map(); // Track errors by chunk index

        let completedCount = 0;
        let aborted = false;
        let totalBytes = 0;
        let uploadedBytes = 0;

        // Calculate total bytes from chunks
        chunks.forEach(chunk => {
            const chunkSize = chunk.end - chunk.start;
            chunkSizes.set(chunk.index, chunkSize);
            totalBytes += chunkSize;
        });

        // Listen for abort signal
        if (abortSignal) {
            abortSignal.addEventListener('abort', () => {
                aborted = true;
            });
        }

        // Track completed chunks separately
        const completedChunksSet = new Set();

        // Subscribe to individual chunk observables and aggregate progress
        const updateAggregatedProgress = () => {
            // Calculate aggregate upload speed from all active chunks
            let totalSpeed = 0;
            let activeChunkCount = 0;

            chunkProgressMap.forEach((progress) => {
                if (progress.speed > 0) {
                    totalSpeed += progress.speed;
                    activeChunkCount++;
                }
            });

            // Calculate precise uploaded bytes from chunk progress
            // Start with completed chunks (fully uploaded)
            let calculatedUploadedBytes = 0;
            completedChunksSet.forEach((chunkIndex) => {
                calculatedUploadedBytes += chunkSizes.get(chunkIndex) || 0;
            });

            // Add progress from active chunks
            chunkProgressMap.forEach((progress, chunkIndex) => {
                const chunkSize = chunkSizes.get(chunkIndex) || 0;
                const chunkProgress = progress.percentage / 100;
                calculatedUploadedBytes += chunkSize * chunkProgress;
            });

            uploadedBytes = calculatedUploadedBytes;

            // Calculate precise overall progress percentage
            const progressPercentage = totalBytes > 0 ? (uploadedBytes / totalBytes) * 100 : 0;

            // Emit aggregated progress event
            aggregatedObservable.emit({
                type: 'upload-progress',
                progress: progressPercentage, // Precise percentage (can be > 0 and < 100)
                uploadedBytes,
                totalBytes,
                uploadedChunks: completedCount,
                totalChunks: chunks.length,
                activeChunks: activeChunkCount,
                speed: totalSpeed, // bytes per second
                speedFormatted: this.formatSpeed(totalSpeed),
                chunkDetails: Array.from(chunkProgressMap.values()),
                timestamp: Date.now()
            });
        };

        // Upload a single chunk with semaphore control
        const uploadChunkWithSemaphore = async (chunk) => {
            // Check if aborted before starting
            if (aborted) {
                return { success: false, chunk, aborted: true };
            }

            // Acquire semaphore slot (blocks if max concurrent reached)
            await semaphore.acquire();

            // Check again after acquiring (abort may have happened while waiting)
            if (aborted) {
                semaphore.release();
                return { success: false, chunk, aborted: true };
            }

            try {
                // Create observable for this chunk's progress
                const chunkObservable = new Observable();

                // Subscribe to chunk observable to aggregate progress
                chunkObservable.subscribe((event) => {
                    if (event.type === 'chunk-progress') {
                        chunkProgressMap.set(event.chunkIndex, event);
                        updateAggregatedProgress();
                    } else if (event.type === 'chunk-complete') {
                        // Chunk completed, mark as fully uploaded
                        completedChunksSet.add(event.chunkIndex);
                        completedCount++;
                        chunkProgressMap.delete(event.chunkIndex);
                        updateAggregatedProgress();
                    }
                });

                const result = await this.uploadChunkWithRetry(
                    chunk,
                    uploadId,
                    totalChunks,
                    chunkObservable,
                    abortSignal
                );

                // Store result at correct index
                results[chunk.index] = result;

                // Clean up progress tracking
                chunkProgressMap.delete(chunk.index);

                // Notify completion
                if (onChunkComplete) {
                    onChunkComplete(chunk);
                }

                return { success: true, chunk, result };

            } catch (error) {
                // Check if it was an abort
                if (error.name === 'AbortError' || aborted) {
                    return { success: false, chunk, aborted: true };
                }

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

        // Create promise that resolves when all uploads complete
        const uploadPromise = Promise.all(uploadPromises).then((uploadResults) => {
            console.log(`  ✅ Completed ${completedCount}/${chunks.length} chunks`);

            // Check if aborted
            if (aborted) {
                console.log('⏸️  Upload aborted');
                const abortError = new Error('Upload paused by user');
                abortError.name = 'AbortError';
                throw abortError;
            }

            // Check if any chunks failed using uploadResults
            const failedResults = uploadResults.filter(r => !r || !r.success);
            if (failedResults.length > 0) {
                const failedIndices = failedResults
                    .map(r => r?.chunk?.index)
                    .filter(idx => idx !== undefined)
                    .sort((a, b) => a - b);
                const failedIndicesStr = failedIndices.join(', ');
                const error = new Error(`Failed to upload ${failedResults.length} chunk(s) at indices: [${failedIndicesStr}]. Please retry the upload.`);
                error.failedChunks = failedIndices;
                error.failedCount = failedResults.length;
                console.error('❌ Chunk upload errors:', {
                    failedCount: failedResults.length,
                    failedIndices,
                    errors: failedResults.map(r => ({
                        chunkIndex: r?.chunk?.index,
                        message: r?.error?.message || 'Unknown error',
                        aborted: r?.aborted
                    }))
                });
                throw error;
            }

            // Verify all chunks succeeded
            const successCount = uploadResults.filter(r => r && r.success).length;
            if (successCount !== chunks.length) {
                const failedCount = chunks.length - successCount;
                const error = new Error(`Only ${successCount}/${chunks.length} chunks uploaded successfully. ${failedCount} chunk(s) failed.`);
                error.successCount = successCount;
                error.totalCount = chunks.length;
                error.failedCount = failedCount;
                console.error('❌ Success count mismatch:', {
                    successCount,
                    totalChunks: chunks.length,
                    uploadResults: uploadResults.map(r => ({
                        success: r?.success,
                        chunkIndex: r?.chunk?.index,
                        hasResult: !!r?.result
                    }))
                });
                throw error;
            }

            // Emit completion event
            aggregatedObservable.emit({
                type: 'upload-complete',
                uploadedChunks: chunks.length,
                totalChunks: chunks.length,
                uploadedBytes: totalBytes,
                totalBytes,
                progress: 100,
                timestamp: Date.now()
            });

            console.log(`  ✅ All ${chunks.length} chunks uploaded successfully`);
            return results;
        });

        return { observable: aggregatedObservable, promise: uploadPromise };
    }

    /**
     * Upload chunk with exponential backoff retry
     * Uses XMLHttpRequest for accurate progress tracking
     * @param {Object} chunk - Chunk object
     * @param {string} uploadId - Upload session ID
     * @param {number} totalChunks - Total number of chunks
     * @param {Observable} progressObservable - Observable to emit progress events to
     * @param {AbortSignal} abortSignal - Abort signal for cancellation
     * @returns {Promise} Promise that resolves with server response
     */
    async uploadChunkWithRetry(chunk, uploadId, totalChunks, progressObservable, abortSignal) {
        let lastError;

        console.log(`🔄 Starting upload for chunk ${chunk.index}/${totalChunks - 1}`, {
            chunkSize: chunk.blob.size,
            uploadId,
            totalChunks
        });

        for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
            // Check if aborted
            if (abortSignal && abortSignal.aborted) {
                const abortError = new Error('Upload paused by user');
                abortError.name = 'AbortError';
                throw abortError;
            }

            try {
                console.log(`  🔐 Calculating hash for chunk ${chunk.index} (attempt ${attempt + 1}/${this.retryAttempts})...`);
                // Calculate hash of chunk
                const hash = await this.calculateHash(chunk.blob, chunk.index);
                console.log(`  ✅ Hash calculated for chunk ${chunk.index}: ${hash.substring(0, 16)}...`);

                // Create form data
                const formData = new FormData();
                formData.append('chunk', chunk.blob);
                formData.append('chunkIndex', chunk.index.toString());
                formData.append('chunkHash', hash);
                formData.append('uploadId', uploadId);
                formData.append('totalChunks', totalChunks.toString());

                // Upload chunk using XMLHttpRequest with Observable
                const { observable, promise } = this.uploadChunkWithXHR(
                    formData,
                    chunk.index,
                    totalChunks,
                    abortSignal
                );

                // Subscribe to chunk progress and forward to aggregated observable
                if (progressObservable) {
                    observable.subscribe((event) => {
                        progressObservable.emit(event);
                    });
                }

                const response = await promise;

                if (attempt > 0) {
                    console.log(`  ✓ Chunk ${chunk.index + 1}/${totalChunks} uploaded (after ${attempt + 1} attempts)`);
                } else {
                    console.log(`  ✓ Chunk ${chunk.index + 1}/${totalChunks} uploaded`);
                }
                return response;

            } catch (error) {
                lastError = error;
                const attemptNum = attempt + 1;

                console.error(`  ❌ Chunk ${chunk.index} attempt ${attemptNum}/${this.retryAttempts} failed:`, {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                });

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
                    console.error(`  ❌ Chunk ${chunk.index} failed after all ${this.retryAttempts} attempts`);
                }
            }
        }

        const finalError = new Error(`Chunk ${chunk.index} failed after ${this.retryAttempts} attempts: ${lastError?.message || 'Unknown error'}`);
        finalError.originalError = lastError;
        throw finalError;
    }

    /**
     * Upload chunk using XMLHttpRequest with progress tracking
     * Returns an Observable that emits progress events and resolves with the server response
     * @param {FormData} formData - Form data containing chunk
     * @param {number} chunkIndex - Chunk index
     * @param {number} totalChunks - Total number of chunks
     * @param {AbortSignal} abortSignal - Abort signal for cancellation
     * @returns {Object} Object with { observable: Observable, promise: Promise }
     */
    uploadChunkWithXHR(formData, chunkIndex, totalChunks, abortSignal) {
        const observable = new Observable();
        let uploadStartTime = Date.now();
        let lastLoadedBytes = 0;
        let lastUpdateTime = uploadStartTime;
        let lastProgressEmit = 0;
        const PROGRESS_THROTTLE = 50; // Emit progress max every 50ms (20 times/sec) for precise tracking

        // Speed smoothing with moving average
        const speedSamples = [];
        const MAX_SPEED_SAMPLES = 5;

        const promise = new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            // Listen for abort signal
            if (abortSignal) {
                abortSignal.addEventListener('abort', () => {
                    xhr.abort();
                });
            }

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
                        type: 'chunk-progress',
                        chunkIndex,
                        loaded: event.loaded,
                        total: event.total,
                        percentage: (event.loaded / event.total) * 100, // Precise percentage
                        speed: avgSpeed, // bytes per second
                        speedFormatted: this.formatSpeed(avgSpeed),
                        elapsed: (now - uploadStartTime) / 1000, // seconds
                        timestamp: now
                    };

                    // Emit progress event through observable
                    observable.emit(chunkProgress);

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
                        console.log(`✅ Chunk ${chunkIndex} uploaded successfully:`, response);

                        // Emit completion event
                        observable.emit({
                            type: 'chunk-complete',
                            chunkIndex,
                            response,
                            timestamp: Date.now()
                        });

                        resolve(response);
                    } catch (parseError) {
                        console.error(`❌ Failed to parse response for chunk ${chunkIndex}:`, xhr.responseText);
                        const error = new Error('Failed to parse server response');
                        observable.emit({
                            type: 'chunk-error',
                            chunkIndex,
                            error,
                            timestamp: Date.now()
                        });
                        reject(error);
                    }
                } else {
                    try {
                        const errorResponse = JSON.parse(xhr.responseText);
                        console.error(`❌ Chunk ${chunkIndex} upload failed (${xhr.status}):`, errorResponse);
                        const error = new Error(errorResponse.error || `Upload failed with status ${xhr.status}`);
                        observable.emit({
                            type: 'chunk-error',
                            chunkIndex,
                            error,
                            status: xhr.status,
                            timestamp: Date.now()
                        });
                        reject(error);
                    } catch {
                        console.error(`❌ Chunk ${chunkIndex} upload failed (${xhr.status}):`, xhr.responseText);
                        const error = new Error(`Upload failed with status ${xhr.status}`);
                        observable.emit({
                            type: 'chunk-error',
                            chunkIndex,
                            error,
                            status: xhr.status,
                            timestamp: Date.now()
                        });
                        reject(error);
                    }
                }
            });

            // Handle network errors
            xhr.addEventListener('error', (event) => {
                console.error(`❌ Network error for chunk ${chunkIndex}:`, event);
                const error = new Error('Network error during chunk upload');
                observable.emit({
                    type: 'chunk-error',
                    chunkIndex,
                    error,
                    timestamp: Date.now()
                });
                reject(error);
            });

            // Handle timeout
            xhr.addEventListener('timeout', () => {
                console.error(`❌ Timeout for chunk ${chunkIndex}`);
                const error = new Error('Upload timeout');
                observable.emit({
                    type: 'chunk-error',
                    chunkIndex,
                    error,
                    timestamp: Date.now()
                });
                reject(error);
            });

            // Handle abort
            xhr.addEventListener('abort', () => {
                const abortError = new Error('Upload paused by user');
                abortError.name = 'AbortError';
                observable.emit({
                    type: 'chunk-abort',
                    chunkIndex,
                    timestamp: Date.now()
                });
                reject(abortError);
            });

            // Get auth token from localStorage or session
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');

            // Get base URL - use same logic as api client
            let baseURL = api.defaults?.baseURL;
            if (!baseURL || baseURL === '/api') {
                // In dev mode, use full URL; in prod, use relative path
                if (import.meta.env.DEV) {
                    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
                    baseURL = `${backendUrl}/api`;
                } else {
                    baseURL = '/api';
                }
            }
            const uploadUrl = `${baseURL}/upload/chunk`;

            console.log(`📤 Uploading chunk ${chunkIndex}:`, {
                url: uploadUrl,
                hasToken: !!token,
                formDataSize: formData.get('chunk').size
            });

            // Configure request
            xhr.open('POST', uploadUrl, true);
            xhr.timeout = 120000; // 120 second timeout

            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }

            // Send request
            xhr.send(formData);
        });

        return { observable, promise };
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
        // Normalize MIME type - handle cases where browser doesn't recognize AVI
        let mimeType = file.type;
        if (!mimeType || mimeType === 'application/octet-stream') {
            const extension = file.name.toLowerCase().split('.').pop();
            const mimeTypeMap = {
                'avi': 'video/x-msvideo',
                'mp4': 'video/mp4',
                'webm': 'video/webm',
                'mov': 'video/quicktime',
                'mkv': 'video/x-matroska',
                'mpeg': 'video/mpeg',
                'mpg': 'video/mpeg',
                'ogg': 'video/ogg'
            };
            if (mimeTypeMap[extension]) {
                mimeType = mimeTypeMap[extension];
                console.log(`📝 Detected MIME type from extension: ${mimeType} for .${extension}`);
            }
        }

        const response = await api.post('/upload/init', {
            fileName: file.name,
            fileSize: file.size,
            mimeType: mimeType,
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
        console.log('🏁 Starting finalize upload:', { uploadId, fileName });
        try {
            const response = await api.post('/upload/finalize', {
                uploadId,
                fileName,
                title: metadata.title,
                description: metadata.description
            });

            console.log('✅ Finalize upload response:', response.data);
            return response.data;
        } catch (error) {
            // Enhanced error logging for debugging
            console.error('❌ Finalize upload error:', {
                uploadId,
                fileName,
                status: error.response?.status,
                statusText: error.response?.statusText,
                errorData: error.response?.data,
                message: error.message,
                stack: error.stack
            });

            // Throw a more descriptive error
            const errorMessage = error.response?.data?.error || error.message || 'Finalization failed';
            const errorDetails = error.response?.data;

            if (errorDetails && (errorDetails.uploaded !== undefined || errorDetails.total !== undefined)) {
                const detailedError = new Error(`${errorMessage} (${errorDetails.uploaded}/${errorDetails.total} chunks uploaded)`);
                detailedError.missingChunks = errorDetails.missing;
                detailedError.missingChunkIndices = errorDetails.missingChunkIndices;
                throw detailedError;
            }

            throw new Error(errorMessage);
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

// Export Observable class for external use if needed
export { Observable };

// Export singleton instance with advanced features
export const chunkedUploadManagerAdvanced = new ChunkedUploadManagerAdvanced({
    maxConcurrent: 6,
    chunkSize: 5 * 1024 * 1024,
    retryAttempts: 3,
    retryDelay: 1000,
    useWebWorker: true     // Enable Web Worker for hashing
});

export default chunkedUploadManagerAdvanced;

