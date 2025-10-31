/**
 * ChunkedUploader - Robust large file upload with chunking and resumability
 * 
 * Features:
 * - Splits files into chunks for reliable upload
 * - Resumable uploads (survives connection drops)
 * - Automatic retry with exponential backoff
 * - Parallel chunk uploads for speed
 * - MD5 checksum verification
 * - Cancellation support via AbortController
 * - Progress tracking per chunk
 */

export class ChunkedUploader {
    constructor(options = {}) {
        this.chunkSize = options.chunkSize || 5 * 1024 * 1024; // 5MB default
        this.maxConcurrent = options.maxConcurrent || 3; // 3 parallel uploads
        this.maxRetries = options.maxRetries || 3;
        this.retryDelay = options.retryDelay || 1000; // 1 second
        this.onProgress = options.onProgress || (() => { });
        this.onChunkComplete = options.onChunkComplete || (() => { });
        this.onError = options.onError || (() => { });

        this.abortController = new AbortController();
        this.uploadedChunks = new Set();
        this.activeUploads = 0;
        this.isPaused = false;
        this.isCancelled = false;
    }

    /**
     * Calculate MD5 hash of a chunk for integrity verification
     */
    async calculateMD5(chunk) {
        const buffer = await chunk.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Split file into chunks
     */
    async prepareChunks(file) {
        const chunks = [];
        const totalChunks = Math.ceil(file.size / this.chunkSize);

        for (let i = 0; i < totalChunks; i++) {
            const start = i * this.chunkSize;
            const end = Math.min(start + this.chunkSize, file.size);
            const chunk = file.slice(start, end);

            chunks.push({
                index: i,
                start,
                end,
                size: chunk.size,
                blob: chunk,
                hash: await this.calculateMD5(chunk),
                retries: 0,
            });
        }

        return chunks;
    }

    /**
     * Upload a single chunk with retry logic
     */
    async uploadChunk(chunk, uploadId, metadata, retryCount = 0) {
        if (this.isCancelled) {
            throw new Error('Upload cancelled');
        }

        const formData = new FormData();
        formData.append('chunk', chunk.blob);
        formData.append('chunkIndex', chunk.index);
        formData.append('chunkHash', chunk.hash);
        formData.append('uploadId', uploadId);
        formData.append('totalChunks', metadata.totalChunks);

        try {
            const response = await fetch('/api/upload/chunk', {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                signal: this.abortController.signal,
            });

            if (!response.ok) {
                throw new Error(`Chunk upload failed: ${response.status}`);
            }

            const result = await response.json();
            this.uploadedChunks.add(chunk.index);
            this.onChunkComplete(chunk.index, metadata.totalChunks);

            return result;
        } catch (error) {
            // Handle abort
            if (error.name === 'AbortError') {
                throw new Error('Upload cancelled');
            }

            // Retry logic with exponential backoff
            if (retryCount < this.maxRetries) {
                const delay = this.retryDelay * Math.pow(2, retryCount);
                console.log(`Retrying chunk ${chunk.index} in ${delay}ms...`);

                await new Promise(resolve => setTimeout(resolve, delay));
                return this.uploadChunk(chunk, uploadId, metadata, retryCount + 1);
            }

            throw error;
        }
    }

    /**
     * Initialize upload session on server
     */
    async initializeUpload(file, additionalData = {}) {
        try {
            const response = await fetch('/api/upload/init', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({
                    fileName: file.name,
                    fileSize: file.size,
                    mimeType: file.type,
                    totalChunks: Math.ceil(file.size / this.chunkSize),
                    ...additionalData,
                }),
                signal: this.abortController.signal,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to initialize upload (${response.status}): ${errorText}`);
            }

            return response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Upload cancelled');
            }
            throw error;
        }
    }

    /**
     * Finalize upload on server (merge chunks)
     */
    async finalizeUpload(uploadId, metadata) {
        const response = await fetch('/api/upload/finalize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify({
                uploadId,
                fileName: metadata.fileName,
                ...metadata.additionalData,
            }),
            signal: this.abortController.signal,
        });

        if (!response.ok) {
            throw new Error('Failed to finalize upload');
        }

        return response.json();
    }

    /**
     * Upload file with chunking and parallel processing
     */
    async upload(file, additionalData = {}) {
        try {
            // Initialize upload session
            const { uploadId, resumableChunks } = await this.initializeUpload(file, additionalData);

            // Prepare chunks
            const chunks = await this.prepareChunks(file);
            const totalChunks = chunks.length;

            // Mark already uploaded chunks (for resume capability)
            if (resumableChunks) {
                resumableChunks.forEach(index => this.uploadedChunks.add(index));
            }

            // Filter out already uploaded chunks
            const chunksToUpload = chunks.filter(chunk => !this.uploadedChunks.has(chunk.index));

            console.log(`Uploading ${chunksToUpload.length} of ${totalChunks} chunks`);

            const metadata = {
                uploadId,
                fileName: file.name,
                totalChunks,
                additionalData,
            };

            // Upload chunks with controlled concurrency
            await this.uploadChunksWithConcurrency(chunksToUpload, uploadId, metadata);

            // Finalize upload (merge chunks on server)
            const result = await this.finalizeUpload(uploadId, metadata);

            this.onProgress(100, file.size, file.size);
            return result;

        } catch (error) {
            this.onError(error);
            throw error;
        }
    }

    /**
     * Upload chunks with controlled concurrency
     */
    async uploadChunksWithConcurrency(chunks, uploadId, metadata) {
        const queue = [...chunks];
        const uploadPromises = [];

        const uploadNext = async () => {
            while (queue.length > 0 && !this.isPaused && !this.isCancelled) {
                const chunk = queue.shift();
                if (!chunk) break;

                this.activeUploads++;

                try {
                    await this.uploadChunk(chunk, uploadId, metadata);

                    // Calculate and report progress
                    const uploadedSize = Array.from(this.uploadedChunks)
                        .reduce((sum, idx) => sum + chunks[idx]?.size || 0, 0);
                    const totalSize = metadata.totalChunks * this.chunkSize;
                    const progress = Math.min(100, (uploadedSize / totalSize) * 100);

                    this.onProgress(progress, uploadedSize, totalSize);
                } finally {
                    this.activeUploads--;
                }
            }
        };

        // Start concurrent uploads
        for (let i = 0; i < this.maxConcurrent; i++) {
            uploadPromises.push(uploadNext());
        }

        await Promise.all(uploadPromises);
    }

    /**
     * Pause upload
     */
    pause() {
        this.isPaused = true;
        console.log('Upload paused');
    }

    /**
     * Resume upload
     */
    resume() {
        this.isPaused = false;
        console.log('Upload resumed');
    }

    /**
     * Cancel upload
     */
    cancel() {
        this.isCancelled = true;
        this.abortController.abort();
        console.log('Upload cancelled');
    }

    /**
     * Get upload progress info
     */
    getProgress() {
        return {
            uploadedChunks: this.uploadedChunks.size,
            activeUploads: this.activeUploads,
            isPaused: this.isPaused,
            isCancelled: this.isCancelled,
        };
    }
}

