// Web Worker for Hash Calculation
// Offloads MD5 hashing to a separate thread to prevent UI blocking

// Import SparkMD5 (needs to be loaded differently in worker context)
self.importScripts('https://cdn.jsdelivr.net/npm/spark-md5@3.0.2/spark-md5.min.js');

self.onmessage = async function(e) {
    const { blob, chunkIndex, action } = e.data;
    
    try {
        if (action === 'calculateHash') {
            // Calculate hash for a chunk
            const arrayBuffer = await blob.arrayBuffer();
            const spark = new self.SparkMD5.ArrayBuffer();
            spark.append(arrayBuffer);
            const hash = spark.end();
            
            self.postMessage({
                action: 'hashComplete',
                hash,
                chunkIndex,
                success: true
            });
        } else if (action === 'calculateFileHash') {
            // Calculate hash for entire file (for small files)
            const arrayBuffer = await blob.arrayBuffer();
            const spark = new self.SparkMD5.ArrayBuffer();
            spark.append(arrayBuffer);
            const hash = spark.end();
            
            self.postMessage({
                action: 'fileHashComplete',
                hash,
                success: true
            });
        }
    } catch (error) {
        self.postMessage({
            action: 'error',
            error: error.message,
            chunkIndex,
            success: false
        });
    }
};

// Handle worker initialization
self.postMessage({ action: 'ready' });

