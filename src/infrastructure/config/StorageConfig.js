// @ts-check
// Infrastructure: StorageConfig
// Factory for creating storage repository based on configuration

const B2StorageRepository = require('../storage/B2StorageRepository');
const LocalStorageRepository = require('../storage/LocalStorageRepository');

class StorageConfig {
    static createStorageRepository() {
        const mode = process.env.STORAGE_MODE || 'local';

        if (mode === 'b2') {
            return new B2StorageRepository({
                endpoint: process.env.B2_ENDPOINT,
                region: process.env.B2_REGION || 'us-west-004',
                keyId: process.env.B2_KEY_ID,
                keySecret: process.env.B2_KEY_SECRET,
                bucket: process.env.B2_BUCKET,
                cdnBaseUrl: process.env.CDN_BASE_URL || null,
            });
        }

        // Default to local storage
        return new LocalStorageRepository({
            storagePath: process.env.LOCAL_STORAGE_PATH,
            baseUrl: process.env.LOCAL_STORAGE_URL,
        });
    }
}

module.exports = StorageConfig;

