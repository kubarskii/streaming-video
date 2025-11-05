// @ts-check
// Application: ChunkUploadService
// Manages chunked upload sessions and chunk assembly

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { v4: uuidv4 } = require('uuid');

const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);
const rmdir = promisify(fs.rmdir);

class ChunkUploadService {
    constructor(uploadSessionRepository) {
        this.uploadSessionRepository = uploadSessionRepository;
    }

    /**
     * Create new upload session
     */
    async createSession({ userId, fileName, fileSize, mimeType, totalChunks, metadata }) {
        const uploadId = uuidv4();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        const session = {
            id: uploadId,
            userId,
            fileName,
            fileSize,
            mimeType,
            totalChunks,
            uploadedChunks: [],
            metadata,
            status: 'in_progress',
            createdAt: new Date(),
            expiresAt,
        };

        await this.uploadSessionRepository.create(session);

        return session;
    }

    /**
     * Find incomplete session for resuming
     */
    async findIncompleteSession(userId, fileName, fileSize) {
        const sessions = await this.uploadSessionRepository.findByUser(userId);

        return sessions.find(
            (s) =>
                s.fileName === fileName &&
                s.fileSize === fileSize &&
                s.status === 'in_progress' &&
                s.expiresAt > new Date()
        );
    }

    /**
     * Get upload session by ID
     */
    async getSession(uploadId) {
        return this.uploadSessionRepository.findById(uploadId);
    }

    /**
     * Mark chunk as uploaded (with B2 part metadata)
     */
    async markChunkUploaded(uploadId, chunkIndex, partMetadata = null) {
        // Use atomic repository method to prevent race conditions
        const updatedSession = await this.uploadSessionRepository.addUploadedChunk(
            uploadId,
            chunkIndex,
            partMetadata
        );

        // Sanity check: prevent unbounded metadata growth
        if (updatedSession.metadata) {
            const metadataSize = JSON.stringify(updatedSession.metadata).length;
            if (metadataSize > 1024 * 1024) { // 1MB limit
                console.warn(`⚠️  Session ${uploadId} metadata exceeds 1MB (${metadataSize} bytes)`);
            }
        }

        return updatedSession;
    }

    /**
     * Merge all chunks into final file
     */
    async mergeChunks(uploadId, fileName) {
        const session = await this.getSession(uploadId);
        if (!session) {
            throw new Error('Upload session not found');
        }

        const chunkDir = path.join(process.cwd(), 'videos', 'temp', 'chunks', uploadId);
        const outputDir = path.join(process.cwd(), 'videos', 'temp');
        const outputPath = path.join(outputDir, `merged_${uploadId}_${fileName}`);

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Create write stream for output file
        const writeStream = fs.createWriteStream(outputPath);

        return new Promise((resolve, reject) => {
            let currentChunk = 0;

            const writeNextChunk = async () => {
                if (currentChunk >= session.totalChunks) {
                    writeStream.end();
                    return;
                }

                const chunkPath = path.join(
                    chunkDir,
                    `chunk_${currentChunk.toString().padStart(6, '0')}`
                );

                if (!fs.existsSync(chunkPath)) {
                    writeStream.destroy();
                    return reject(new Error(`Missing chunk ${currentChunk}`));
                }

                const readStream = fs.createReadStream(chunkPath);

                readStream.on('data', (chunk) => {
                    if (!writeStream.write(chunk)) {
                        readStream.pause();
                        writeStream.once('drain', () => readStream.resume());
                    }
                });

                readStream.on('end', () => {
                    currentChunk++;
                    writeNextChunk();
                });

                readStream.on('error', (err) => {
                    writeStream.destroy();
                    reject(err);
                });
            };

            writeStream.on('finish', () => {
                console.log(`✅ Merged ${session.totalChunks} chunks into ${outputPath}`);
                resolve(outputPath);
            });

            writeStream.on('error', (err) => {
                reject(err);
            });

            writeNextChunk();
        });
    }

    /**
     * Clean up session and chunk files
     */
    async cleanupSession(uploadId) {
        const chunkDir = path.join(process.cwd(), 'videos', 'temp', 'chunks', uploadId);

        // Delete chunk directory
        if (fs.existsSync(chunkDir)) {
            const files = await readdir(chunkDir);
            for (const file of files) {
                await unlink(path.join(chunkDir, file));
            }
            await rmdir(chunkDir);
            console.log(`🗑️  Cleaned up chunks for upload ${uploadId}`);
        }

        // Delete session from database
        await this.uploadSessionRepository.delete(uploadId);
    }

    /**
     * Cancel upload session
     */
    async cancelSession(uploadId) {
        await this.uploadSessionRepository.update(uploadId, {
            status: 'cancelled',
        });
    }

    /**
     * Clean up expired sessions (run periodically)
     */
    async cleanupExpiredSessions() {
        const expiredSessions = await this.uploadSessionRepository.findExpired();
        console.log(`🧹 Cleaning up ${expiredSessions.length} expired upload sessions`);

        for (const session of expiredSessions) {
            try {
                await this.cleanupSession(session.id);
            } catch (error) {
                console.error(`Failed to cleanup session ${session.id}:`, error);
            }
        }

        return expiredSessions.length;
    }

    /**
     * Get user's active upload sessions
     */
    async getUserSessions(userId) {
        return this.uploadSessionRepository.findByUser(userId);
    }

    /**
     * Get upload statistics
     */
    async getStatistics() {
        return this.uploadSessionRepository.getStatistics();
    }
}

module.exports = ChunkUploadService;

