// Application: VideoService
// Service that coordinates video-related use cases

const UploadVideoUseCase = require('../use-cases/UploadVideoUseCase');
const GetVideoUseCase = require('../use-cases/GetVideoUseCase');
const ListVideosUseCase = require('../use-cases/ListVideosUseCase');
const DeleteVideoUseCase = require('../use-cases/DeleteVideoUseCase');

class VideoService {
    constructor(videoRepository, storageRepository, thumbnailGenerator) {
        this.uploadVideoUseCase = new UploadVideoUseCase(videoRepository, storageRepository, thumbnailGenerator);
        this.getVideoUseCase = new GetVideoUseCase(videoRepository);
        this.listVideosUseCase = new ListVideosUseCase(videoRepository);
        this.deleteVideoUseCase = new DeleteVideoUseCase(videoRepository, storageRepository);
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
}

module.exports = VideoService;

