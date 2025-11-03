// Pages: Playlist View Page
// Public page to view and play videos from a playlist
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { playlistsAPI } from '../../shared/api/playlists';
import { useAbortController } from '../../shared/lib';
import { VideoCard, EmptyState, ErrorState, Skeleton, VideoCardSkeleton, Button } from '../../shared/ui';
import { formatRelativeTime } from '../../shared/lib';
import './PlaylistViewPage.css';

export const PlaylistViewPage = () => {
    const { playlistId } = useParams({ strict: false });
    const navigate = useNavigate();
    const signal = useAbortController();
    const [playlist, setPlaylist] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

    useEffect(() => {
        loadPlaylist();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playlistId]);

    const loadPlaylist = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await playlistsAPI.getPlaylist(playlistId, signal);
            setPlaylist(response.playlist);
        } catch (err) {
            if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
                console.error('Error loading playlist:', err);
                setError(err.message || 'Failed to load playlist');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVideoClick = (videoId, index) => {
        setCurrentVideoIndex(index);
        navigate({ to: `/video/${videoId}`, search: { playlist: playlistId, index } });
    };

    if (loading) {
        return (
            <div className="playlist-view-page">
                <div className="playlist-view-header">
                    <Skeleton width="300px" height="2rem" />
                    <Skeleton width="400px" height="1rem" />
                    <Skeleton width="200px" height="1rem" />
                </div>
                <div className="playlist-view-videos">
                    <div className="playlist-videos-grid">
                        {Array.from({ length: 8 }).map((_, index) => (
                            <VideoCardSkeleton key={index} />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="playlist-view-page">
                <ErrorState
                    title="Failed to load playlist"
                    message={error}
                    onRetry={loadPlaylist}
                />
            </div>
        );
    }

    if (!playlist) {
        return (
            <div className="playlist-view-page">
                <ErrorState
                    title="Playlist not found"
                    message="This playlist doesn't exist or has been removed"
                    action={
                        <Button variant="primary" onClick={() => navigate({ to: '/' })}>
                            Go to Home
                        </Button>
                    }
                />
            </div>
        );
    }

    const videos = playlist.videos || [];
    const sortedVideos = videos.sort((a, b) => (a.position || 0) - (b.position || 0));

    return (
        <div className="playlist-view-page">
            <div className="playlist-view-container">
                {/* Playlist Header */}
                <div className="playlist-view-header">
                    <div className="playlist-header-content">
                        <h1 className="playlist-title">{playlist.title}</h1>
                        {playlist.description && (
                            <p className="playlist-description">{playlist.description}</p>
                        )}
                        <div className="playlist-meta">
                            <span className="playlist-meta-item">
                                {playlist.user?.username || 'Unknown User'}
                            </span>
                            <span className="playlist-meta-separator">•</span>
                            <span className="playlist-meta-item">
                                {videos.length} {videos.length === 1 ? 'video' : 'videos'}
                            </span>
                            {playlist.createdAt && (
                                <>
                                    <span className="playlist-meta-separator">•</span>
                                    <span className="playlist-meta-item">
                                        Created {formatRelativeTime(playlist.createdAt)}
                                    </span>
                                </>
                            )}
                            <span className="playlist-meta-separator">•</span>
                            <span className={`playlist-visibility ${playlist.isPublic ? 'public' : 'private'}`}>
                                {playlist.isPublic ? 'Public' : 'Private'}
                            </span>
                        </div>
                        {videos.length > 0 && (
                            <div className="playlist-actions">
                                <Button
                                    variant="primary"
                                    size="large"
                                    onClick={() => handleVideoClick(sortedVideos[0].video?.id || sortedVideos[0].videoId, 0)}
                                >
                                    Play All
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Videos List */}
                {videos.length === 0 ? (
                    <EmptyState
                        title="No videos in this playlist"
                        description="This playlist is empty"
                    />
                ) : (
                    <div className="playlist-videos-grid">
                        {sortedVideos.map((playlistVideo, index) => {
                            const video = playlistVideo.video;
                            if (!video) return null;

                            return (
                                <VideoCard
                                    key={playlistVideo.id || video.id}
                                    video={video}
                                    variant="list"
                                    showUser={true}
                                    onClick={() => handleVideoClick(video.id, index)}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

