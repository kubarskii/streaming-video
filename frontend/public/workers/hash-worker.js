// Web Worker for Hash Calculation
// Offloads SHA-256 hashing to a separate thread to prevent UI blocking
// Uses Web Crypto API (available in workers)

self.onmessage = async function(e) {
    const { blob, chunkIndex, action } = e.data;
    
    try {
        if (action === 'calculateHash') {
            // Calculate SHA-256 hash for a chunk (matches server-side)
            const arrayBuffer = await blob.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            self.postMessage({
                action: 'hashComplete',
                hash,
                chunkIndex,
                success: true
            });
        } else if (action === 'calculateFileHash') {
            // Calculate SHA-256 hash for entire file
            const arrayBuffer = await blob.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
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

