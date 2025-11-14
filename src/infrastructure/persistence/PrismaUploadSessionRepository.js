// @ts-check
// Infrastructure: PrismaUploadSessionRepository
// Production-ready upload session repository using Prisma

class PrismaUploadSessionRepository {
    /**
     * @param {import('@prisma/client').PrismaClient} prismaClient
     */
    constructor(prismaClient) {
        this.prisma = prismaClient;
    }

    /**
     * Create a new upload session
     * @param {Object} session - Session data
     * @returns {Promise<Object>} Created session
     */
    async create(session) {
        const record = await this.prisma.uploadSession.create({
            data: {
                id: session.id,
                userId: session.userId,
                fileName: session.fileName,
                fileSize: session.fileSize,
                mimeType: session.mimeType,
                totalChunks: session.totalChunks,
                uploadedChunks: JSON.stringify(session.uploadedChunks || []),
                metadata: session.metadata ? JSON.stringify(session.metadata) : null,
                status: session.status || 'in_progress',
                expiresAt: new Date(session.expiresAt),
            }
        });

        return this.mapToSession(record);
    }

    /**
     * Find session by ID
     * @param {string} id - Session ID
     * @returns {Promise<Object|null>} Session or null
     */
    async findById(id) {
        const record = await this.prisma.uploadSession.findUnique({
            where: { id }
        });

        if (!record) return null;
        return this.mapToSession(record);
    }

    /**
     * Find all sessions for a user
     * @param {string} userId - User ID
     * @returns {Promise<Object[]>} Array of sessions
     */
    async findByUser(userId) {
        const records = await this.prisma.uploadSession.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });

        return records.map(record => this.mapToSession(record));
    }

    /**
     * Find expired sessions
     * @returns {Promise<Object[]>} Array of expired sessions
     */
    async findExpired() {
        const now = new Date();
        const records = await this.prisma.uploadSession.findMany({
            where: {
                expiresAt: {
                    lt: now
                }
            }
        });

        return records.map(record => this.mapToSession(record));
    }

    /**
     * Update session
     * @param {string} id - Session ID
     * @param {Object} data - Update data
     * @returns {Promise<Object>} Updated session
     */
    async update(id, data) {
        const updateData = {};

        if (data.status !== undefined) {
            updateData.status = data.status;
        }

        if (data.uploadedChunks !== undefined) {
            updateData.uploadedChunks = JSON.stringify(data.uploadedChunks);
        }

        if (data.metadata !== undefined) {
            updateData.metadata = data.metadata ? JSON.stringify(data.metadata) : null;
        }

        const record = await this.prisma.uploadSession.update({
            where: { id },
            data: updateData
        });

        return this.mapToSession(record);
    }

    /**
     * Delete session
     * @param {string} id - Session ID
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id) {
        try {
            await this.prisma.uploadSession.delete({
                where: { id }
            });
            return true;
        } catch (error) {
            if (error.code === 'P2025') {
                // Record not found
                return false;
            }
            throw error;
        }
    }

    /**
     * Atomically add a chunk to uploadedChunks array
     * Uses Prisma transaction to prevent race conditions
     * @param {string} id - Session ID
     * @param {number} chunkIndex - Chunk index
     * @param {Object|null} partMetadata - Optional B2 part metadata
     * @returns {Promise<Object>} Updated session
     */
    async addUploadedChunk(id, chunkIndex, partMetadata = null) {
        // Use native SQL for atomic JSON array update to avoid transaction conflicts
        // This uses PostgreSQL's jsonb_set function to atomically add an element to the array
        // only if it doesn't already exist, preventing race conditions
        
        const maxRetries = 5;
        let lastError = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                // First, check if chunk already exists
                const record = await this.prisma.uploadSession.findUnique({
                    where: { id }
                });

                if (!record) {
                    throw new Error('Session not found');
                }

                const session = this.mapToSession(record);

                if (session.uploadedChunks.includes(chunkIndex)) {
                    console.log(`📝 Chunk ${chunkIndex} already exists in session ${id}, updating metadata if needed`);
                    // Chunk already exists, just update metadata if needed
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
                            // Use SQL to atomically add to metadata.b2Parts array
                            // metadata is stored as TEXT containing JSON, so we need to cast it
                            await this.prisma.$executeRaw`
                                UPDATE "UploadSession"
                                SET "metadata" = jsonb_set(
                                    COALESCE(
                                        CASE 
                                            WHEN "metadata" IS NULL OR "metadata" = '' 
                                            THEN '{}'::jsonb
                                            ELSE "metadata"::jsonb
                                        END,
                                        '{}'::jsonb
                                    ),
                                    '{b2Parts}',
                                    COALESCE(
                                        CASE 
                                            WHEN "metadata" IS NULL OR "metadata" = '' 
                                            THEN '{}'::jsonb->'b2Parts'
                                            ELSE "metadata"::jsonb->'b2Parts'
                                        END,
                                        '[]'::jsonb
                                    ) || jsonb_build_array(
                                        jsonb_build_object(
                                            'etag', ${partMetadata.etag}::text,
                                            'partNumber', ${partMetadata.partNumber}::int
                                        )
                                    )
                                )::text
                                WHERE id = ${id}::text
                            `;
                        }
                    }
                    return session;
                }

                // Use native SQL to atomically add chunk to array
                // This uses PostgreSQL's jsonb_set to add the chunk index to the array
                // only if it doesn't already exist, preventing race conditions
                if (attempt > 0) {
                    console.log(`💾 Retrying save chunk ${chunkIndex} to session ${id} (attempt ${attempt + 1}/${maxRetries})`);
                } else {
                    console.log(`💾 Saving chunk ${chunkIndex} to session ${id} using atomic SQL update`);
                }

                // Atomically add chunk index to uploadedChunks array using SQL
                // This ensures that even with parallel requests, each chunk is added exactly once
                // uploadedChunks is stored as TEXT containing JSON, so we need to cast it
                await this.prisma.$executeRaw`
                    UPDATE "UploadSession"
                    SET "uploadedChunks" = (
                        SELECT jsonb_agg(DISTINCT value ORDER BY value)
                        FROM jsonb_array_elements(
                            COALESCE(
                                CASE 
                                    WHEN "uploadedChunks" IS NULL OR "uploadedChunks" = '' 
                                    THEN '[]'::jsonb
                                    ELSE "uploadedChunks"::jsonb
                                END,
                                '[]'::jsonb
                            ) || jsonb_build_array(${chunkIndex}::int)
                        )
                    )::text
                    WHERE id = ${id}::text
                `;

                // Update metadata if part metadata provided
                // metadata is stored as TEXT containing JSON, so we need to cast it
                if (partMetadata) {
                    await this.prisma.$executeRaw`
                        UPDATE "UploadSession"
                        SET "metadata" = jsonb_set(
                            COALESCE(
                                CASE 
                                    WHEN "metadata" IS NULL OR "metadata" = '' 
                                    THEN '{}'::jsonb
                                    ELSE "metadata"::jsonb
                                END,
                                '{}'::jsonb
                            ),
                            '{b2Parts}',
                            COALESCE(
                                CASE 
                                    WHEN "metadata" IS NULL OR "metadata" = '' 
                                    THEN '[]'::jsonb
                                    ELSE COALESCE("metadata"::jsonb->'b2Parts', '[]'::jsonb)
                                END,
                                '[]'::jsonb
                            ) || jsonb_build_array(
                                jsonb_build_object(
                                    'etag', ${partMetadata.etag}::text,
                                    'partNumber', ${partMetadata.partNumber}::int
                                )
                            )
                        )::text
                        WHERE id = ${id}::text
                    `;
                }

                // Fetch updated session to return
                const updated = await this.prisma.uploadSession.findUnique({
                    where: { id }
                });

                if (!updated) {
                    throw new Error('Session not found after update');
                }

                const updatedSession = this.mapToSession(updated);
                console.log(`✅ Chunk ${chunkIndex} saved successfully (${updatedSession.uploadedChunks.length}/${session.totalChunks} chunks total)`);

                return updatedSession;
            } catch (error) {
                lastError = error;
                
                // Check if it's a database conflict error
                const isConflictError = error.code === 'P2034' || // Transaction conflict
                                      error.code === 'P2014' || // Required relation
                                      error.message.includes('transaction') ||
                                      error.message.includes('deadlock') ||
                                      error.message.includes('concurrent') ||
                                      error.message.includes('could not serialize');

                if (isConflictError && attempt < maxRetries - 1) {
                    // Exponential backoff with jitter
                    const delay = Math.min(50 * Math.pow(2, attempt), 500);
                    const jitter = Math.random() * 50;
                    const totalDelay = delay + jitter;
                    
                    console.warn(`⚠️  Database conflict for chunk ${chunkIndex} (attempt ${attempt + 1}/${maxRetries}), retrying in ${Math.round(totalDelay)}ms...`);
                    await new Promise(resolve => setTimeout(resolve, totalDelay));
                    continue;
                }

                // If not a conflict error or last attempt, throw
                throw error;
            }
        }

        // If all retries failed, throw last error
        throw lastError || new Error(`Failed to save chunk ${chunkIndex} after ${maxRetries} attempts`);
    }

    /**
     * Get statistics about upload sessions
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        const [total, inProgress, completed, failed, cancelled] = await Promise.all([
            this.prisma.uploadSession.count(),
            this.prisma.uploadSession.count({ where: { status: 'in_progress' } }),
            this.prisma.uploadSession.count({ where: { status: 'completed' } }),
            this.prisma.uploadSession.count({ where: { status: 'failed' } }),
            this.prisma.uploadSession.count({ where: { status: 'cancelled' } })
        ]);

        return {
            total,
            inProgress,
            completed,
            failed,
            cancelled
        };
    }

    /**
     * Map Prisma record to session object
     * @param {Object} record - Prisma record
     * @returns {Object} Session object
     */
    mapToSession(record) {
        return {
            id: record.id,
            userId: record.userId,
            fileName: record.fileName,
            fileSize: record.fileSize,
            mimeType: record.mimeType,
            totalChunks: record.totalChunks,
            uploadedChunks: JSON.parse(record.uploadedChunks || '[]'),
            metadata: record.metadata ? JSON.parse(record.metadata) : {},
            status: record.status,
            createdAt: record.createdAt,
            expiresAt: record.expiresAt
        };
    }
}

module.exports = PrismaUploadSessionRepository;

