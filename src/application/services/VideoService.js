// @ts-check
// Application: VideoService
// Service that coordinates video-related use cases

const UploadVideoUseCase = require('../use-cases/UploadVideoUseCase');
const GetVideoUseCase = require('../use-cases/GetVideoUseCase');
const ListVideosUseCase = require('../use-cases/ListVideosUseCase');
const IncrementVideoViewsUseCase = require('../use-cases/IncrementVideoViewsUseCase');
const DeleteVideoUseCase = require('../use-cases/DeleteVideoUseCase');
const UpdateVideoMetadataUseCase = require('../use-cases/UpdateVideoMetadataUseCase');
const UpdateVideoThumbnailUseCase = require('../use-cases/UpdateVideoThumbnailUseCase');
const GetVideoQualitiesUseCase = require('../use-cases/GetVideoQualitiesUseCase');
const TranscodeVideoUseCase = require('../use-cases/TranscodeVideoUseCase');

class VideoService {
    constructor(videoRepository, storageRepository, thumbnailGenerator, channelRepository, videoQualityRepository = null, videoTranscoder = null) {
        this.uploadVideoUseCase = new UploadVideoUseCase(videoRepository, storageRepository, thumbnailGenerator, channelRepository);
        this.getVideoUseCase = new GetVideoUseCase(videoRepository);
        this.listVideosUseCase = new ListVideosUseCase(videoRepository);
        this.deleteVideoUseCase = new DeleteVideoUseCase(videoRepository, storageRepository, channelRepository);
        this.updateVideoMetadataUseCase = new UpdateVideoMetadataUseCase(videoRepository);
        this.updateVideoThumbnailUseCase = new UpdateVideoThumbnailUseCase(videoRepository, storageRepository);
        this.incrementVideoViewsUseCase = new IncrementVideoViewsUseCase(videoRepository);

        // Quality-related use cases (optional)
        if (videoQualityRepository) {
            this.getVideoQualitiesUseCase = new GetVideoQualitiesUseCase(videoQualityRepository);
        }
        if (videoQualityRepository && videoTranscoder) {
            this.transcodeVideoUseCase = new TranscodeVideoUseCase(videoRepository, videoQualityRepository, storageRepository, videoTranscoder);
        }
    }

    async uploadVideo(input) {
        return await this.uploadVideoUseCase.execute(input);
    }

    async getVideo(videoId) {
        return await this.getVideoUseCase.execute(videoId);
    }

    async getVideoByFileName(fileName) {
        return await this.getVideoUseCase.executeByFileName(fileName);
    }

    async getVideoByStorageKey(storageKey) {
        return await this.getVideoUseCase.executeByStorageKey(storageKey);
    }

    async listVideos(options = {}) {
        return await this.listVideosUseCase.execute(options);
    }

    async deleteVideo(videoId) {
        return await this.deleteVideoUseCase.execute(videoId);
    }

    async updateVideoMetadata(videoId, userId, metadata) {
        return await this.updateVideoMetadataUseCase.execute(videoId, userId, metadata);
    }

    async updateVideoThumbnail(videoId, userId, thumbnailPath, thumbnailMimeType) {
        return await this.updateVideoThumbnailUseCase.execute(videoId, userId, thumbnailPath, thumbnailMimeType);
    }

    async getVideoQualities(videoId) {
        if (!this.getVideoQualitiesUseCase) {
            return [];
        }
        return await this.getVideoQualitiesUseCase.execute(videoId);
    }

    async transcodeVideo(videoId) {
        if (!this.transcodeVideoUseCase) {
            throw new Error('Transcoding is not configured');
        }
        return await this.transcodeVideoUseCase.execute(videoId);
    }

    async incrementVideoViews(videoId) {
        return await this.incrementVideoViewsUseCase.execute(videoId);
    }
}

module.exports = VideoService;

