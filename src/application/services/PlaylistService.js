// @ts-check
// Application: PlaylistService
// Coordinates playlist-related use cases

const CreatePlaylistUseCase = require('../use-cases/CreatePlaylistUseCase');
const UpdatePlaylistUseCase = require('../use-cases/UpdatePlaylistUseCase');
const DeletePlaylistUseCase = require('../use-cases/DeletePlaylistUseCase');
const GetPlaylistUseCase = require('../use-cases/GetPlaylistUseCase');
const ListPlaylistsUseCase = require('../use-cases/ListPlaylistsUseCase');
const AddVideoToPlaylistUseCase = require('../use-cases/AddVideoToPlaylistUseCase');
const RemoveVideoFromPlaylistUseCase = require('../use-cases/RemoveVideoFromPlaylistUseCase');
const ReorderPlaylistVideosUseCase = require('../use-cases/ReorderPlaylistVideosUseCase');

class PlaylistService {
    constructor(playlistRepository, videoRepository) {
        this.createPlaylistUseCase = new CreatePlaylistUseCase(playlistRepository, videoRepository);
        this.updatePlaylistUseCase = new UpdatePlaylistUseCase(playlistRepository);
        this.deletePlaylistUseCase = new DeletePlaylistUseCase(playlistRepository);
        this.getPlaylistUseCase = new GetPlaylistUseCase(playlistRepository);
        this.listPlaylistsUseCase = new ListPlaylistsUseCase(playlistRepository);
        this.addVideoToPlaylistUseCase = new AddVideoToPlaylistUseCase(playlistRepository, videoRepository);
        this.removeVideoFromPlaylistUseCase = new RemoveVideoFromPlaylistUseCase(playlistRepository);
        this.reorderPlaylistVideosUseCase = new ReorderPlaylistVideosUseCase(playlistRepository);
    }

    async createPlaylist(input) {
        return await this.createPlaylistUseCase.execute(input);
    }

    async updatePlaylist(input) {
        return await this.updatePlaylistUseCase.execute(input);
    }

    async deletePlaylist(input) {
        return await this.deletePlaylistUseCase.execute(input);
    }

    async getPlaylist(input) {
        return await this.getPlaylistUseCase.execute(input);
    }

    async listPlaylists(input) {
        return await this.listPlaylistsUseCase.execute(input);
    }

    async addVideoToPlaylist(input) {
        return await this.addVideoToPlaylistUseCase.execute(input);
    }

    async removeVideoFromPlaylist(input) {
        return await this.removeVideoFromPlaylistUseCase.execute(input);
    }

    async reorderPlaylistVideos(input) {
        return await this.reorderPlaylistVideosUseCase.execute(input);
    }
}

module.exports = PlaylistService;

