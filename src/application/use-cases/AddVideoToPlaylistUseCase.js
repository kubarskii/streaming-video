// @ts-check
// Application: AddVideoToPlaylistUseCase
// Adds a video to a playlist at a specific position

class AddVideoToPlaylistUseCase {
    /**
     * @param {import('../../domain/repositories/IPlaylistRepository')} playlistRepository
     * @param {import('../../domain/repositories/IVideoRepository')} videoRepository
     */
    constructor(playlistRepository, videoRepository) {
        this.playlistRepository = playlistRepository;
        this.videoRepository = videoRepository;
    }

    /**
     * Add a video to a playlist
     * @param {Object} input
     * @param {string} input.playlistId
     * @param {string} input.videoId
     * @param {string} input.userId
     * @param {number} [input.position]
     */
    async execute(input) {
        const { playlistId, videoId, userId, position } = input;

        if (!playlistId) {
            throw new Error('Playlist ID is required');
        }
        if (!videoId) {
            throw new Error('Video ID is required');
        }
        if (!userId) {
            throw new Error('User ID is required');
        }

        const playlist = await this.playlistRepository.getPlaylistById(playlistId, { includeVideos: true });
        if (!playlist) {
            throw new Error('Playlist not found');
        }

        if (playlist.userId !== userId) {
            throw new Error('You do not have permission to modify this playlist');
        }

        const video = await this.videoRepository.findById(videoId);
        if (!video) {
            throw new Error('Video not found');
        }

        return await this.playlistRepository.addVideoToPlaylist(playlistId, videoId, position);
    }
}

module.exports = AddVideoToPlaylistUseCase;

