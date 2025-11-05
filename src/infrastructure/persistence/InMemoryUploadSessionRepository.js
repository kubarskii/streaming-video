// @ts-check
// Infrastructure: InMemoryUploadSessionRepository
// Temporary in-memory storage for upload sessions
// TODO: Replace with PrismaUploadSessionRepository for production

class InMemoryUploadSessionRepository {
    constructor() {
        this.sessions = new Map();
    }

    async create(session) {
        this.sessions.set(session.id, {
            ...session,
            createdAt: new Date(session.createdAt),
            expiresAt: new Date(session.expiresAt),
        });
        return session;
    }

    async findById(id) {
        const session = this.sessions.get(id);
        if (!session) return null;
        
        // Return a deep copy to prevent reference issues
        return {
            ...session,
            uploadedChunks: [...session.uploadedChunks],
            metadata: session.metadata ? JSON.parse(JSON.stringify(session.metadata)) : {}
        };
    }

    async findByUser(userId) {
        return Array.from(this.sessions.values()).filter((s) => s.userId === userId);
    }

    async findExpired() {
        const now = new Date();
        return Array.from(this.sessions.values()).filter((s) => s.expiresAt < now);
    }

    async update(id, data) {
        const session = this.sessions.get(id);
        if (!session) {
            throw new Error('Session not found');
        }

        // Deep merge to handle nested objects and arrays properly
        const updated = {
            ...session,
            ...data,
            // Ensure uploadedChunks is a new array copy if provided
            uploadedChunks: data.uploadedChunks ? [...data.uploadedChunks] : session.uploadedChunks,
            // Deep copy metadata if provided
            metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : session.metadata
        };
        
        this.sessions.set(id, updated);
        
        // Return a deep copy
        return {
            ...updated,
            uploadedChunks: [...updated.uploadedChunks],
            metadata: updated.metadata ? JSON.parse(JSON.stringify(updated.metadata)) : {}
        };
    }

    async delete(id) {
        return this.sessions.delete(id);
    }

    /**
     * Atomically add a chunk to uploadedChunks array
     * This prevents race conditions when multiple chunks upload in parallel
     */
    async addUploadedChunk(id, chunkIndex, partMetadata = null) {
        const session = this.sessions.get(id);
        if (!session) {
            throw new Error('Session not found');
        }

        // Atomic check and add
        if (!session.uploadedChunks.includes(chunkIndex)) {
            session.uploadedChunks.push(chunkIndex);
            session.uploadedChunks.sort((a, b) => a - b);
        }

        // Add B2 part metadata if provided
        if (partMetadata) {
            if (!session.metadata.b2Parts) {
                session.metadata.b2Parts = [];
            }

            session.metadata.b2Parts.push({
                etag: partMetadata.etag,
                partNumber: partMetadata.partNumber
            });
        }

        // Return a deep copy
        return {
            ...session,
            uploadedChunks: [...session.uploadedChunks],
            metadata: session.metadata ? JSON.parse(JSON.stringify(session.metadata)) : {}
        };
    }

    async getStatistics() {
        const sessions = Array.from(this.sessions.values());
        return {
            total: sessions.length,
            inProgress: sessions.filter((s) => s.status === 'in_progress').length,
            completed: sessions.filter((s) => s.status === 'completed').length,
            failed: sessions.filter((s) => s.status === 'failed').length,
            cancelled: sessions.filter((s) => s.status === 'cancelled').length,
        };
    }

    // Utility method for testing
    clear() {
        this.sessions.clear();
    }
}

module.exports = InMemoryUploadSessionRepository;

