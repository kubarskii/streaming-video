// @ts-check
// Presentation: PlaylistController
// Handles HTTP interactions for playlist management

const { z } = require('zod');
const {
    uuidSchema,
    createPlaylistSchema,
    updatePlaylistSchema,
    listPlaylistsQuerySchema,
    addVideoToPlaylistSchema,
    reorderPlaylistVideosSchema
} = require('../../infrastructure/validation/schemas');
const {
    validateQuery,
    validateParams,
    parseAndValidateBody,
    sendValidationError
} = require('../../infrastructure/validation/validator');

class PlaylistController {
    constructor(playlistService) {
        this.playlistService = playlistService;
    }

    serializePlaylist(playlist) {
        if (!playlist) {
            return null;
        }

        // Debug: Log what we're serializing
        const videoCount = Array.isArray(playlist.videos) ? playlist.videos.length : 0;
        // if (videoCount > 0) {
        //     console.debug(`Serializing playlist ${playlist.id} with ${videoCount} videos`);
        //     // Debug: Log first video structure
        //     if (playlist.videos[0]) {
        //         console.debug(`First video item structure:`, {
        //             id: playlist.videos[0].id,
        //             videoId: playlist.videos[0].videoId,
        //             hasVideo: !!playlist.videos[0].video,
        //             videoType: playlist.videos[0].video ? typeof playlist.videos[0].video : 'none',
        //             videoKeys: playlist.videos[0].video ? Object.keys(playlist.videos[0].video) : []
        //         });
        //     }
        // }

        const serializedVideos = Array.isArray(playlist.videos)
            ? playlist.videos.map((item, index) => {
                if (!item) {
                    return null;
                }

                let video = null;
                if (item.video) {
                    try {
                        // Handle both Video entity and plain object
                        const videoData = item.video;
                        video = {
                            id: videoData.id || item.videoId,
                            title: videoData.title || '',
                            description: videoData.description || null,
                            storageKey: videoData.storageKey || null,
                            playbackUrl: typeof videoData.getPlaybackUrl === 'function'
                                ? videoData.getPlaybackUrl()
                                : (videoData.playbackUrl || (videoData.storageKey ? `/video?file=${videoData.storageKey}` : null)),
                            thumbnailUrl: videoData.thumbnailUrl || null,
                            durationMs: videoData.durationMs || null,
                            views: videoData.views || 0,
                            uploadedAt: videoData.uploadedAt || null,
                            userId: videoData.userId || null
                        };
                    } catch (err) {
                        console.error(`Error serializing video ${item.videoId} at index ${index}:`, err);
                        console.error(`Video data:`, JSON.stringify(item.video, null, 2));
                        // Return basic video info if serialization fails
                        video = {
                            id: item.video?.id || item.videoId,
                            videoId: item.videoId
                        };
                    }
                } else {
                    console.debug(`Video item ${item.videoId} has no video data`);
                }

                const serializedItem = {
                    id: item.id,
                    position: item.position || 0,
                    addedAt: item.addedAt,
                    videoId: item.videoId,
                    video
                };

                console.debug(`Created serialized item ${index}:`, {
                    id: serializedItem.id,
                    videoId: serializedItem.videoId,
                    hasVideo: !!serializedItem.video
                });

                return serializedItem;
            }).filter(item => {
                // Don't filter out items with null videos - include them anyway
                const keep = item !== null;
                if (!keep) {
                    console.debug(`Filtering out null item`);
                }
                return keep;
            })
            : [];

        console.debug(`Final serialized video count: ${serializedVideos.length} for playlist ${playlist.id}`);

        return {
            id: playlist.id,
            title: playlist.title,
            description: playlist.description,
            isPublic: playlist.isPublic,
            slug: playlist.slug,
            userId: playlist.userId,
            createdAt: playlist.createdAt,
            updatedAt: playlist.updatedAt,
            user: playlist.user ? {
                id: playlist.user.id,
                username: playlist.user.username,
                email: playlist.user.email
            } : null,
            videos: serializedVideos
        };
    }

    async listPlaylists(req, res, queryParams) {
        const validation = validateQuery(listPlaylistsQuerySchema, queryParams);
        if (validation.success === false) {
            return sendValidationError(res, validation.error, 400);
        }

        try {
            const result = await this.playlistService.listPlaylists({
                ...validation.data,
                requestingUserId: req.user ? req.user.id : undefined
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                playlists: result.playlists.map(playlist => this.serializePlaylist(playlist)),
                total: result.total,
                limit: result.limit,
                offset: result.offset,
                hasMore: result.hasMore
            }));
        } catch (error) {
            console.error('Error listing playlists:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }

    async getPlaylist(req, res, playlistId) {
        const validation = validateParams(z.object({ id: uuidSchema }), { id: playlistId });
        if (validation.success === false) {
            return sendValidationError(res, validation.error, 400);
        }

        try {
            const playlist = await this.playlistService.getPlaylist({
                playlistId,
                requestingUserId: req.user ? req.user.id : undefined
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(this.serializePlaylist(playlist)));
        } catch (error) {
            if (error.message === 'Playlist not found') {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Playlist not found' }));
            }
            if (error.message === 'Playlist is private') {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Playlist is private' }));
            }

            console.error('Error retrieving playlist:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }

    async getPlaylistBySlug(req, res, slug) {
        if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Playlist slug is required' }));
        }

        try {
            const playlist = await this.playlistService.getPlaylist({
                slug,
                requestingUserId: req.user ? req.user.id : undefined
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(this.serializePlaylist(playlist)));
        } catch (error) {
            if (error.message === 'Playlist not found') {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Playlist not found' }));
            }
            if (error.message === 'Playlist is private') {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Playlist is private' }));
            }

            console.error('Error retrieving playlist by slug:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }

    async createPlaylist(req, res) {
        if (!req.user) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Authentication required' }));
        }

        try {
            const body = await parseAndValidateBody(req, createPlaylistSchema);

            const playlist = await this.playlistService.createPlaylist({
                title: body.title,
                description: body.description ?? null,
                isPublic: body.isPublic !== undefined ? body.isPublic : true,
                slug: body.slug ?? null,
                userId: req.user.id,
                videoIds: body.videoIds || []
            });

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(this.serializePlaylist(playlist)));
        } catch (error) {
            if (error.validationError) {
                return sendValidationError(res, error.validationError, 400);
            }

            console.error('Error creating playlist:', error);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message || 'Failed to create playlist' }));
        }
    }

    async updatePlaylist(req, res, playlistId) {
        if (!req.user) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Authentication required' }));
        }

        const validation = validateParams(z.object({ id: uuidSchema }), { id: playlistId });
        if (validation.success === false) {
            return sendValidationError(res, validation.error, 400);
        }

        try {
            const body = await parseAndValidateBody(req, updatePlaylistSchema);

            const playlist = await this.playlistService.updatePlaylist({
                playlistId,
                userId: req.user.id,
                ...body
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(this.serializePlaylist(playlist)));
        } catch (error) {
            if (error.validationError) {
                return sendValidationError(res, error.validationError, 400);
            }
            if (error.message === 'Playlist not found') {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Playlist not found' }));
            }
            if (error.message === 'You do not have permission to modify this playlist') {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Forbidden' }));
            }

            console.error('Error updating playlist:', error);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message || 'Failed to update playlist' }));
        }
    }

    async deletePlaylist(req, res, playlistId) {
        if (!req.user) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Authentication required' }));
        }

        const validation = validateParams(z.object({ id: uuidSchema }), { id: playlistId });
        if (validation.success === false) {
            return sendValidationError(res, validation.error, 400);
        }

        try {
            await this.playlistService.deletePlaylist({ playlistId, userId: req.user.id });
            res.writeHead(204, { 'Content-Type': 'application/json' });
            res.end();
        } catch (error) {
            if (error.message === 'Playlist not found') {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Playlist not found' }));
            }
            if (error.message === 'You do not have permission to delete this playlist' || error.message === 'You do not have permission to modify this playlist') {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Forbidden' }));
            }

            console.error('Error deleting playlist:', error);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message || 'Failed to delete playlist' }));
        }
    }

    async addVideoToPlaylist(req, res, playlistId) {
        if (!req.user) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Authentication required' }));
        }

        const validation = validateParams(z.object({ id: uuidSchema }), { id: playlistId });
        if (validation.success === false) {
            return sendValidationError(res, validation.error, 400);
        }

        try {
            const body = await parseAndValidateBody(req, addVideoToPlaylistSchema);

            const playlist = await this.playlistService.addVideoToPlaylist({
                playlistId,
                userId: req.user.id,
                videoId: body.videoId,
                position: body.position
            });

            if (!playlist) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Playlist not found' }));
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(this.serializePlaylist(playlist)));
        } catch (error) {
            if (error.validationError) {
                return sendValidationError(res, error.validationError, 400);
            }
            if (error.message === 'Playlist not found' || error.message === 'Video not found') {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: error.message }));
            }
            if (error.message === 'You do not have permission to modify this playlist') {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Forbidden' }));
            }

            console.error('Error adding video to playlist:', error);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message || 'Failed to add video' }));
        }
    }

    async removeVideoFromPlaylist(req, res, playlistId, videoId) {
        if (!req.user) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Authentication required' }));
        }

        const paramValidation = validateParams(z.object({ id: uuidSchema, videoId: uuidSchema }), { id: playlistId, videoId });
        if (paramValidation.success === false) {
            return sendValidationError(res, paramValidation.error, 400);
        }

        try {
            const playlist = await this.playlistService.removeVideoFromPlaylist({
                playlistId,
                userId: req.user.id,
                videoId
            });

            if (!playlist) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Playlist not found' }));
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(this.serializePlaylist(playlist)));
        } catch (error) {
            if (error.message === 'Playlist not found') {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Playlist not found' }));
            }
            if (error.message === 'You do not have permission to modify this playlist') {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Forbidden' }));
            }

            console.error('Error removing video from playlist:', error);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message || 'Failed to remove video' }));
        }
    }

    async reorderPlaylist(req, res, playlistId) {
        if (!req.user) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Authentication required' }));
        }

        const validation = validateParams(z.object({ id: uuidSchema }), { id: playlistId });
        if (validation.success === false) {
            return sendValidationError(res, validation.error, 400);
        }

        try {
            const body = await parseAndValidateBody(req, reorderPlaylistVideosSchema);

            const playlist = await this.playlistService.reorderPlaylistVideos({
                playlistId,
                userId: req.user.id,
                videoIds: body.videoIds
            });

            if (!playlist) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Playlist not found' }));
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(this.serializePlaylist(playlist)));
        } catch (error) {
            if (error.validationError) {
                return sendValidationError(res, error.validationError, 400);
            }
            if (error.message === 'Playlist not found') {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Playlist not found' }));
            }
            if (error.message === 'You do not have permission to modify this playlist') {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Forbidden' }));
            }
            if (error.message === 'Playlist order must include the same videos') {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: error.message }));
            }

            console.error('Error reordering playlist:', error);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message || 'Failed to reorder playlist' }));
        }
    }
}

module.exports = PlaylistController;

