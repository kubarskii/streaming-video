// Repository Interface: IStorageRepository
// Defines the contract for video file storage (B2, local, etc.)

class IStorageRepository {
    /**
     * Upload a video file
     * @param {string} filePath - Local path to the file
     * @param {string} storageKey - Key/path in storage
     * @param {Object} metadata - File metadata
     * @returns {Promise<{storageUrl: string, cdnUrl?: string}>}
     */
    async upload(filePath, storageKey, metadata = {}) {
        throw new Error('Method not implemented');
    }

    /**
     * Upload from buffer
     * @param {Buffer} buffer - File buffer
     * @param {string} storageKey - Key/path in storage
     * @param {Object} metadata - File metadata
     * @returns {Promise<{storageUrl: string, cdnUrl?: string}>}
     */
    async uploadBuffer(buffer, storageKey, metadata = {}) {
        throw new Error('Method not implemented');
    }

    /**
     * Get a file URL (with optional signed URL for private access)
     * @param {string} storageKey - Key/path in storage
     * @param {Object} options - URL options (expiresIn, etc.)
     * @returns {Promise<string>}
     */
    async getUrl(storageKey, options = {}) {
        throw new Error('Method not implemented');
    }

    /**
     * Delete a file
     * @param {string} storageKey - Key/path in storage
     * @returns {Promise<boolean>}
     */
    async delete(storageKey) {
        throw new Error('Method not implemented');
    }

    /**
     * Check if a file exists
     * @param {string} storageKey - Key/path in storage
     * @returns {Promise<boolean>}
     */
    async exists(storageKey) {
        throw new Error('Method not implemented');
    }

    /**
     * Get file metadata
     * @param {string} storageKey - Key/path in storage
     * @returns {Promise<Object>}
     */
    async getMetadata(storageKey) {
        throw new Error('Method not implemented');
    }
}

module.exports = IStorageRepository;

