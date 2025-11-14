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
        // In-memory storage for uploaded chunks (not persisted to DB)
        // Map<uploadId, Set<chunkIndex>>
        this.uploadedChunks = new Map();
        // Map<uploadId, Map<chunkIndex, partMetadata>>
        this.chunkMetadata = new Map();
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
            uploadedChunks: [], // Not used anymore, tracked in memory
            metadata,
            status: 'in_progress',
            createdAt: new Date(),
            expiresAt,
        };

        await this.uploadSessionRepository.create(session);

        // Initialize in-memory tracking
        this.uploadedChunks.set(uploadId, new Set());
        this.chunkMetadata.set(uploadId, new Map());

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
        const session = await this.uploadSessionRepository.findById(uploadId);
        if (!session) return null;

        // Merge in-memory uploaded chunks with session data
        const inMemoryChunks = this.uploadedChunks.get(uploadId);
        if (inMemoryChunks) {
            session.uploadedChunks = Array.from(inMemoryChunks).sort((a, b) => a - b);
        } else {
            // If session exists in DB but not in memory, initialize empty tracking
            // This can happen if server was restarted
            session.uploadedChunks = [];
            this.uploadedChunks.set(uploadId, new Set());
            this.chunkMetadata.set(uploadId, new Map());
        }

        return session;
    }

    /**
     * Mark chunk as uploaded (with B2 part metadata)
     * Stores chunk status in memory only, not in database
     */
    async markChunkUploaded(uploadId, chunkIndex, partMetadata = null) {
        // Get or create in-memory tracking for this upload
        let chunksSet = this.uploadedChunks.get(uploadId);
        if (!chunksSet) {
            chunksSet = new Set();
            this.uploadedChunks.set(uploadId, chunksSet);
        }

        // Add chunk index to set (Set automatically handles duplicates)
        chunksSet.add(chunkIndex);

        // Store part metadata if provided
        if (partMetadata) {
            let metadataMap = this.chunkMetadata.get(uploadId);
            if (!metadataMap) {
                metadataMap = new Map();
                this.chunkMetadata.set(uploadId, metadataMap);
            }
            metadataMap.set(chunkIndex, partMetadata);
        }

        // Get session from DB and merge with in-memory data
        const session = await this.uploadSessionRepository.findById(uploadId);
        if (!session) {
            throw new Error('Session not found');
        }

        // Update session metadata in DB if part metadata provided
        if (partMetadata) {
            const metadata = session.metadata || {};
            if (!metadata.b2Parts) {
                metadata.b2Parts = [];
            }
            
            // Check if part already exists
            const partExists = metadata.b2Parts.some(
                p => p.partNumber === partMetadata.partNumber
            );
            
            if (!partExists) {
                metadata.b2Parts.push({
                    etag: partMetadata.etag,
                    partNumber: partMetadata.partNumber
                });
                
                // Update metadata in DB
                await this.uploadSessionRepository.update(uploadId, {
                    metadata: metadata
                });
            }
        }

        // Return session with in-memory chunks merged
        const updatedChunks = Array.from(chunksSet).sort((a, b) => a - b);
        console.log(`✅ Chunk ${chunkIndex} marked as uploaded in memory (${updatedChunks.length}/${session.totalChunks} chunks total)`);

        return {
            ...session,
            uploadedChunks: updatedChunks
        };
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

        // Clean up in-memory tracking
        this.uploadedChunks.delete(uploadId);
        this.chunkMetadata.delete(uploadId);

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

