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
        return this.sessions.get(id) || null;
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

        const updated = { ...session, ...data };
        this.sessions.set(id, updated);
        return updated;
    }

    async delete(id) {
        return this.sessions.delete(id);
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

