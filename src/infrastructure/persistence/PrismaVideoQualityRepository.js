// @ts-check
// Infrastructure: PrismaVideoQualityRepository
// Prisma implementation of IVideoQualityRepository

const { PrismaClient } = require('@prisma/client');
const IVideoQualityRepository = require('../../domain/repositories/IVideoQualityRepository');

class PrismaVideoQualityRepository extends IVideoQualityRepository {
    constructor(prisma = null) {
        super();
        this.prisma = prisma || new PrismaClient();
    }

    async save(quality) {
        const saved = await this.prisma.videoQuality.create({
            data: {
                id: quality.id,
                videoId: quality.videoId,
                quality: quality.quality,
                storageKey: quality.storageKey,
                storageUrl: quality.storageUrl,
                cdnUrl: quality.cdnUrl,
                width: quality.width,
                height: quality.height,
                sizeBytes: BigInt(quality.sizeBytes),
                bitrate: quality.bitrate,
                status: quality.status,
                createdAt: quality.createdAt,
                updatedAt: quality.updatedAt
            }
        });

        return {
            ...saved,
            sizeBytes: Number(saved.sizeBytes)
        };
    }

    async findById(id) {
        const quality = await this.prisma.videoQuality.findUnique({
            where: { id }
        });

        if (!quality) return null;

        return {
            ...quality,
            sizeBytes: Number(quality.sizeBytes)
        };
    }

    async findByVideoId(videoId) {
        const qualities = await this.prisma.videoQuality.findMany({
            where: { videoId },
            orderBy: { height: 'asc' }
        });

        return qualities.map(q => ({
            ...q,
            sizeBytes: Number(q.sizeBytes)
        }));
    }

    async findByVideoIdAndQuality(videoId, quality) {
        const result = await this.prisma.videoQuality.findUnique({
            where: {
                videoId_quality: {
                    videoId,
                    quality
                }
            }
        });

        if (!result) return null;

        return {
            ...result,
            sizeBytes: Number(result.sizeBytes)
        };
    }

    async findByStorageKey(storageKey) {
        const quality = await this.prisma.videoQuality.findUnique({
            where: { storageKey }
        });

        if (!quality) return null;

        return {
            ...quality,
            sizeBytes: Number(quality.sizeBytes)
        };
    }

    async update(id, data) {
        const updateData = { ...data };
        if (updateData.sizeBytes !== undefined) {
            updateData.sizeBytes = BigInt(updateData.sizeBytes);
        }

        const updated = await this.prisma.videoQuality.update({
            where: { id },
            data: updateData
        });

        return {
            ...updated,
            sizeBytes: Number(updated.sizeBytes)
        };
    }

    async delete(id) {
        await this.prisma.videoQuality.delete({
            where: { id }
        });
        return true;
    }

    async deleteByVideoId(videoId) {
        const result = await this.prisma.videoQuality.deleteMany({
            where: { videoId }
        });
        return result.count;
    }
}

module.exports = PrismaVideoQualityRepository;


