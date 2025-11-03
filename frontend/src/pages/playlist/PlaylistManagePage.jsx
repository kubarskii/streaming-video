// Pages: Playlist Management Page
// Dedicated page for managing playlist videos and their order
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useAuth } from '../../shared/context/AuthContext';
import { useAbortController } from '../../shared/lib';
import { playlistsAPI } from '../../shared/api/playlists';
import { videosAPI } from '../../shared/api/videos';
import { Button, EmptyState, VideoEmptyIcon, DeleteIcon, Skeleton, VideoCardSkeleton } from '../../shared/ui';
import { formatDuration } from '../../shared/lib';
import styles from './PlaylistManagePage.module.css';

export const PlaylistManagePage = () => {
    const { playlistId } = useParams({ from: '/playlist/$playlistId/manage' });
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    const signal = useAbortController();

    const [playlist, setPlaylist] = useState(null);
    const [availableVideos, setAvailableVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [draggedVideoId, setDraggedVideoId] = useState(null);
    const [draggedOverIndex, setDraggedOverIndex] = useState(null);
    const [reordering, setReordering] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate({ to: '/login' });
            return;
        }
        loadPlaylist();
        loadAvailableVideos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playlistId, isAuthenticated]);

    const loadPlaylist = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await playlistsAPI.getPlaylist(playlistId, signal);
            const playlistData = data.playlist || data;

            // Verify ownership
            if (playlistData.userId !== user.id) {
                setError('You do not have permission to manage this playlist');
                return;
            }

            setPlaylist(playlistData);
        } catch (err) {
            if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
                console.error('Error loading playlist:', err);
                setError('Failed to load playlist: ' + (err.message || 'Unknown error'));
            }
        } finally {
            setLoading(false);
        }
    };

    const loadAvailableVideos = async () => {
        try {
            const data = await videosAPI.getVideos({ userId: user.id, limit: 100, signal });
            setAvailableVideos(data.videos || []);
        } catch (err) {
            if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
                console.error('Error loading videos:', err);
            }
        }
    };

    const handleReorderPlaylist = async (orderedVideoIds) => {
        try {
            setReordering(true);
            await playlistsAPI.reorderPlaylistVideos(playlistId, orderedVideoIds);
            await loadPlaylist(); // Reload to get updated order
        } catch (err) {
            console.error('Error reordering playlist:', err);
            alert('Failed to reorder playlist: ' + err.message);
        } finally {
            setReordering(false);
        }
    };

    const handleDragStart = (e, videoId) => {
        setDraggedVideoId(videoId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', videoId);
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDraggedOverIndex(index);
    };

    const handleDragLeave = () => {
        setDraggedOverIndex(null);
    };

    const handleDrop = async (e, dropIndex) => {
        e.preventDefault();
        setDraggedOverIndex(null);

        if (!draggedVideoId || dropIndex === null || !playlist?.videos) {
            setDraggedVideoId(null);
            return;
        }

        const currentOrder = playlist.videos
            .sort((a, b) => (a.position || 0) - (b.position || 0))
            .map(v => v.video?.id || v.videoId);

        const draggedIndex = currentOrder.findIndex(id => String(id) === String(draggedVideoId));

        if (draggedIndex === -1 || draggedIndex === dropIndex) {
            setDraggedVideoId(null);
            return;
        }

        const newOrder = [...currentOrder];
        const [removed] = newOrder.splice(draggedIndex, 1);
        newOrder.splice(dropIndex, 0, removed);

        await handleReorderPlaylist(newOrder);
        setDraggedVideoId(null);
    };

    const handleAddVideoToPlaylist = async (videoId) => {
        try {
            await playlistsAPI.addVideoToPlaylist(playlistId, videoId);
            await loadPlaylist();
        } catch (err) {
            console.error('Error adding video to playlist:', err);
            alert('Failed to add video to playlist: ' + err.message);
        }
    };

    const handleRemoveVideoFromPlaylist = async (videoId) => {
        if (!window.confirm('Are you sure you want to remove this video from the playlist?')) {
            return;
        }
        try {
            await playlistsAPI.removeVideoFromPlaylist(playlistId, videoId);
            await loadPlaylist();
        } catch (err) {
            console.error('Error removing video from playlist:', err);
            alert('Failed to remove video from playlist: ' + err.message);
        }
    };

    const playlistVideos = playlist?.videos?.sort((a, b) => (a.position || 0) - (b.position || 0)) || [];
    const videosInPlaylist = new Set(playlistVideos.map(v => String(v.video?.id || v.videoId)));
    const videosNotInPlaylist = availableVideos.filter(v => !videosInPlaylist.has(String(v.id)));

    if (loading) {
        return (
            <div className={styles['playlist-manage-page']}>
                <div className={styles['playlist-manage-header']}>
                    <Skeleton width="300px" height="2rem" />
                    <Skeleton width="500px" height="1rem" />
                </div>
                <div className={styles['playlist-manage-content']}>
                    <div className={styles['videos-section']}>
                        <Skeleton width="200px" height="1.5rem" />
                        <div className={styles['videos-grid']}>
                            {Array.from({ length: 6 }).map((_, index) => (
                                <VideoCardSkeleton key={index} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles['playlist-manage-page']}>
                <div className={styles['playlist-manage-error']}>{error}</div>
                <Button variant="secondary" onClick={() => navigate({ to: '/profile' })}>
                    Back to Profile
                </Button>
            </div>
        );
    }

    if (!playlist) {
        return (
            <div className={styles['playlist-manage-page']}>
                <div className={styles['playlist-manage-error']}>Playlist not found</div>
                <Button variant="secondary" onClick={() => navigate({ to: '/profile' })}>
                    Back to Profile
                </Button>
            </div>
        );
    }

    return (
        <div className={styles['playlist-manage-page']}>
            <div className={styles['playlist-manage-header']}>
                <div className={styles['playlist-manage-header-left']}>
                    <Button
                        variant="ghost"
                        size="small"
                        onClick={() => navigate({ to: '/profile', search: { tab: 'playlists' } })}
                    >
                        ← Back
                    </Button>
                    <div className={styles['playlist-manage-title-section']}>
                        <h1>{playlist.title}</h1>
                        <p className={styles['playlist-manage-subtitle']}>
                            {playlistVideos.length} {playlistVideos.length === 1 ? 'video' : 'videos'}
                            {playlist.description && ` • ${playlist.description}`}
                        </p>
                    </div>
                </div>
            </div>

            <div className={styles['playlist-manage-content']}>
                {/* Current Videos in Playlist */}
                <div className={styles['playlist-manage-section']}>
                    <div className={styles['playlist-manage-section-header']}>
                        <h2>Playlist Videos</h2>
                        <p className={styles['section-description']}>
                            Drag videos to reorder them. The order will be saved automatically.
                        </p>
                    </div>

                    {playlistVideos.length === 0 ? (
                        <EmptyState
                            icon={<VideoEmptyIcon />}
                            title="No videos in playlist"
                            description="Add videos from your library below"
                        />
                    ) : (
                        <div className={styles['playlist-videos-list']}>
                            {playlistVideos.map((playlistVideo, index) => {
                                const video = playlistVideo.video;
                                const videoId = video?.id || playlistVideo.videoId;
                                const isDragged = draggedVideoId === videoId;
                                const isDraggedOver = draggedOverIndex === index;

                                return (
                                    <div
                                        key={playlistVideo.id || videoId}
                                        className={`${styles['playlist-video-item']} ${isDragged ? styles['dragging'] : ''} ${isDraggedOver ? styles['drag-over'] : ''}`}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, videoId)}
                                        onDragOver={(e) => handleDragOver(e, index)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, index)}
                                    >
                                        <div className={styles['video-item-content']}>
                                            <div className={styles['video-index']}>{index + 1}</div>
                                            <div className={styles['drag-handle']} title="Drag to reorder">
                                                ☰
                                            </div>
                                            {video?.thumbnailUrl && (
                                                <img
                                                    src={video.thumbnailUrl}
                                                    alt={video.title}
                                                    className={styles['video-thumbnail']}
                                                />
                                            )}
                                            <div className={styles['video-info']}>
                                                <div className={styles['video-title']}>{video?.title || 'Loading...'}</div>
                                                <div className={styles['video-meta']}>
                                                    {video?.durationMs && (
                                                        <span>{formatDuration(video.durationMs)}</span>
                                                    )}
                                                    {video?.views !== undefined && (
                                                        <span>{video.views} views</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <Button
                                            variant="danger"
                                            size="small"
                                            onClick={() => handleRemoveVideoFromPlaylist(videoId)}
                                            disabled={reordering}
                                        >
                                            <DeleteIcon size={14} />
                                            Remove
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Add Videos Section */}
                <div className={styles['playlist-manage-section']}>
                    <div className={styles['playlist-manage-section-header']}>
                        <h2>Add Videos</h2>
                        <p className={styles['section-description']}>
                            Select videos from your library to add to this playlist
                        </p>
                    </div>

                    {videosNotInPlaylist.length === 0 ? (
                        <EmptyState
                            icon={<VideoEmptyIcon />}
                            title="All videos added"
                            description="All your videos are already in this playlist"
                        />
                    ) : (
                        <div className={styles['add-videos-list']}>
                            {videosNotInPlaylist.map(video => (
                                <div key={video.id} className={styles['add-video-item']}>
                                    <div className={styles['video-item-content']}>
                                        {video.thumbnailUrl && (
                                            <img
                                                src={video.thumbnailUrl}
                                                alt={video.title}
                                                className={styles['video-thumbnail']}
                                            />
                                        )}
                                        <div className={styles['video-info']}>
                                            <div className={styles['video-title']}>{video.title}</div>
                                            <div className={styles['video-meta']}>
                                                {video.durationMs && (
                                                    <span>{formatDuration(video.durationMs)}</span>
                                                )}
                                                {video.views !== undefined && (
                                                    <span>{video.views} views</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        variant="primary"
                                        size="small"
                                        onClick={() => handleAddVideoToPlaylist(video.id)}
                                        disabled={reordering}
                                    >
                                        Add
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

