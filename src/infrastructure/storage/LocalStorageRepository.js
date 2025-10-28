// Infrastructure: LocalStorageRepository
// Implementation of IStorageRepository for local filesystem

const fs = require('fs');
const path = require('path');
const IStorageRepository = require('../../domain/repositories/IStorageRepository');

class LocalStorageRepository extends IStorageRepository {
    constructor(config) {
        super();
        this.storagePath = config.storagePath || path.join(process.cwd(), 'videos');
        this.baseUrl = config.baseUrl || 'http://localhost:3000/video';

        // Ensure storage directory exists
        if (!fs.existsSync(this.storagePath)) {
            fs.mkdirSync(this.storagePath, { recursive: true });
        }
    }

    async upload(filePath, storageKey, metadata = {}) {
        const destPath = path.join(this.storagePath, storageKey);
        const destDir = path.dirname(destPath);

        // Ensure directory exists
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        // Copy file
        await fs.promises.copyFile(filePath, destPath);

        const storageUrl = `${this.baseUrl}?file=${storageKey}`;

        return { storageUrl, cdnUrl: null };
    }

    async uploadBuffer(buffer, storageKey, metadata = {}) {
        const destPath = path.join(this.storagePath, storageKey);
        const destDir = path.dirname(destPath);

        // Ensure directory exists
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        // Write buffer to file
        await fs.promises.writeFile(destPath, buffer);

        const storageUrl = `${this.baseUrl}?file=${storageKey}`;

        return { storageUrl, cdnUrl: null };
    }

    async getUrl(storageKey, options = {}) {
        return `${this.baseUrl}?file=${storageKey}`;
    }

    async delete(storageKey) {
        try {
            const filePath = path.join(this.storagePath, storageKey);
            if (fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error deleting local file:', error);
            return false;
        }
    }

    async exists(storageKey) {
        const filePath = path.join(this.storagePath, storageKey);
        return fs.existsSync(filePath);
    }

    async getMetadata(storageKey) {
        const filePath = path.join(this.storagePath, storageKey);
        const stats = await fs.promises.stat(filePath);

        return {
            contentLength: stats.size,
            lastModified: stats.mtime,
            created: stats.birthtime,
        };
    }

    getFilePath(storageKey) {
        return path.join(this.storagePath, storageKey);
    }
}

module.exports = LocalStorageRepository;

