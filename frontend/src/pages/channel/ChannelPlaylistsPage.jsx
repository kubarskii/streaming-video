// Channel Playlists Page - Only loads playlists
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useAbortController } from '../../shared/lib';
import { playlistsAPI } from '../../shared/api/playlists';
import { EmptyState, VideoEmptyIcon, PlaylistCardSkeleton } from '../../shared/ui';

export const ChannelPlaylistsPage = () => {
    const { userId } = useParams({ from: '/channel/$userId/playlists' });
    const navigate = useNavigate();
    const signal = useAbortController();
    const [playlists, setPlaylists] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPlaylists();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    const loadPlaylists = async () => {
        try {
            setLoading(true);
            // Fetch playlists with videos in a single request (no N+1 queries!)
            const data = await playlistsAPI.getPlaylists({
                userId,
                isPublic: true,
                includeVideos: true
            }, signal);
            setPlaylists(data.playlists || []);
        } catch (err) {
            if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
                console.error('Error loading playlists:', err);
            }
        } finally {
            setLoading(false);
        }
    };

    const handlePlaylistClick = (playlist) => {
        // Navigate to first video in playlist with playlistId in query params
        if (playlist.videos && playlist.videos.length > 0 && playlist.videos[0].video) {
            navigate({
                to: `/video/${playlist.videos[0].video.id}`,
                search: { playlistId: playlist.id }
            });
        }
    };

    return (
        <div className="channel-tab-content">
            {loading ? (
                <div className="playlists-grid">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <PlaylistCardSkeleton key={index} />
                    ))}
                </div>
            ) : playlists.length === 0 ? (
                <EmptyState
                    icon={<VideoEmptyIcon />}
                    title="No Playlists Yet"
                    message="This channel hasn't created any public playlists yet"
                />
            ) : (
                <div className="playlists-grid">
                    {playlists.map(playlist => (
                        <div
                            key={playlist.id}
                            className="playlist-card-channel"
                            onClick={() => handlePlaylistClick(playlist)}
                        >
                            {playlist.videos && playlist.videos.length > 0 && playlist.videos[0]?.video?.thumbnailUrl ? (
                                <div className="playlist-thumbnail-grid">
                                    <img
                                        src={playlist.videos[0].video.thumbnailUrl}
                                        alt={playlist.title}
                                        className="playlist-grid-thumbnail"
                                    />
                                    {playlist.videos.length > 1 && (
                                        <>
                                            {playlist.videos[1]?.video?.thumbnailUrl && (
                                                <img
                                                    src={playlist.videos[1].video.thumbnailUrl}
                                                    alt=""
                                                    className="playlist-grid-thumbnail"
                                                />
                                            )}
                                            {playlist.videos.length > 2 && playlist.videos[2]?.video?.thumbnailUrl && (
                                                <img
                                                    src={playlist.videos[2].video.thumbnailUrl}
                                                    alt=""
                                                    className="playlist-grid-thumbnail"
                                                />
                                            )}
                                            {playlist.videos.length > 3 && playlist.videos[3]?.video?.thumbnailUrl && (
                                                <img
                                                    src={playlist.videos[3].video.thumbnailUrl}
                                                    alt=""
                                                    className="playlist-grid-thumbnail"
                                                />
                                            )}
                                        </>
                                    )}
                                    {playlist.videos.length > 4 && (
                                        <div className="playlist-thumbnail-overlay">
                                            <span>+{playlist.videos.length - 4}</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="playlist-thumbnail-placeholder">
                                    <VideoEmptyIcon />
                                </div>
                            )}
                            <div className="playlist-card-info">
                                <h3 className="playlist-card-title">{playlist.title}</h3>
                                <p className="playlist-card-meta">
                                    {playlist.videos?.length || 0} videos
                                    {playlist.description && ` • ${playlist.description.substring(0, 50)}${playlist.description.length > 50 ? '...' : ''}`}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

