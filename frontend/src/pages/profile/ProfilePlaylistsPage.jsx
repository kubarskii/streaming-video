// Profile Playlists Page - Manage playlists
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../shared/context/AuthContext';
import { useAbortController } from '../../shared/lib';
import { videosAPI } from '../../shared/api/videos';
import { playlistsAPI } from '../../shared/api/playlists';
import { useNavigate } from '@tanstack/react-router';
import { Button, EmptyState, VideoEmptyIcon, EditIcon, DeleteIcon, Skeleton, PlaylistCardSkeleton } from '../../shared/ui';
import { formatViews, formatDate, formatDuration } from '../../shared/lib';
import styles from './ProfilePage.module.css';

export const ProfilePlaylistsPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const signal = useAbortController();
    const [playlists, setPlaylists] = useState([]);
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showPlaylistForm, setShowPlaylistForm] = useState(false);
    const [editingPlaylist, setEditingPlaylist] = useState(null);
    const [playlistForm, setPlaylistForm] = useState({
        title: '',
        description: '',
        isPublic: true,
    });
    const [creatingPlaylist, setCreatingPlaylist] = useState(false);
    const [updatingPlaylist, setUpdatingPlaylist] = useState(null);
    const [deletingPlaylist, setDeletingPlaylist] = useState(null);
    const [addingToPlaylist, setAddingToPlaylist] = useState(null);
    const [removingFromPlaylist, setRemovingFromPlaylist] = useState(null);
    const [reorderingPlaylist, setReorderingPlaylist] = useState(null);
    const [expandedPlaylistId, setExpandedPlaylistId] = useState(null);
    const [draggedVideoId, setDraggedVideoId] = useState(null);
    const [draggedOverIndex, setDraggedOverIndex] = useState(null);

    useEffect(() => {
        loadUserPlaylists();
        loadUserVideos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const loadUserPlaylists = async () => {
        try {
            setLoading(true);
            const data = await playlistsAPI.getPlaylists({
                userId: user.id,
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

    const loadUserVideos = async () => {
        try {
            const data = await videosAPI.getVideos({ userId: user.id, limit: 100, signal });
            setVideos(data.videos || []);
        } catch (err) {
            if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
                console.error('Error loading videos:', err);
            }
        }
    };

    const handleCreatePlaylist = async () => {
        try {
            setCreatingPlaylist(true);
            await playlistsAPI.createPlaylist({
                title: playlistForm.title.trim(),
                description: playlistForm.description.trim() || null,
                isPublic: playlistForm.isPublic,
                userId: user.id,
            });
            setPlaylistForm({ title: '', description: '', isPublic: true });
            setShowPlaylistForm(false);
            await loadUserPlaylists();
        } catch (err) {
            console.error('Error creating playlist:', err);
            alert('Failed to create playlist: ' + err.message);
        } finally {
            setCreatingPlaylist(false);
        }
    };

    const handleUpdatePlaylist = async (playlistId, updates) => {
        try {
            setUpdatingPlaylist(playlistId);
            await playlistsAPI.updatePlaylist(playlistId, updates);
            await loadUserPlaylists();
            setEditingPlaylist(null);
        } catch (err) {
            console.error('Error updating playlist:', err);
            alert('Failed to update playlist: ' + err.message);
        } finally {
            setUpdatingPlaylist(null);
        }
    };

    const handleDeletePlaylist = async (playlistId) => {
        if (!window.confirm('Are you sure you want to delete this playlist?')) {
            return;
        }
        try {
            setDeletingPlaylist(playlistId);
            await playlistsAPI.deletePlaylist(playlistId);
            await loadUserPlaylists();
        } catch (err) {
            console.error('Error deleting playlist:', err);
            alert('Failed to delete playlist: ' + err.message);
        } finally {
            setDeletingPlaylist(null);
        }
    };

    const handleAddVideoToPlaylist = async (playlistId, videoId) => {
        try {
            setAddingToPlaylist(`${playlistId}-${videoId}`);
            await playlistsAPI.addVideoToPlaylist(playlistId, videoId);
            await loadUserPlaylists();
        } catch (err) {
            console.error('Error adding video to playlist:', err);
            alert('Failed to add video to playlist: ' + err.message);
        } finally {
            setAddingToPlaylist(null);
        }
    };

    const handleRemoveVideoFromPlaylist = async (playlistId, videoId) => {
        try {
            setRemovingFromPlaylist(`${playlistId}-${videoId}`);
            await playlistsAPI.removeVideoFromPlaylist(playlistId, videoId);
            await loadUserPlaylists();
        } catch (err) {
            console.error('Error removing video from playlist:', err);
            alert('Failed to remove video from playlist: ' + err.message);
        } finally {
            setRemovingFromPlaylist(null);
        }
    };

    const handleReorderPlaylist = async (playlistId, orderedVideoIds) => {
        try {
            setReorderingPlaylist(playlistId);
            await playlistsAPI.reorderPlaylistVideos(playlistId, orderedVideoIds);
            await loadUserPlaylists();
        } catch (err) {
            console.error('Error reordering playlist:', err);
            alert('Failed to reorder playlist: ' + err.message);
        } finally {
            setReorderingPlaylist(null);
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

    const handleDrop = async (e, playlistId, playlistVideos, dropIndex) => {
        e.preventDefault();
        setDraggedOverIndex(null);

        if (!draggedVideoId || dropIndex === null) {
            setDraggedVideoId(null);
            return;
        }

        const currentOrder = playlistVideos
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

        await handleReorderPlaylist(playlistId, newOrder);
        setDraggedVideoId(null);
    };

    if (loading) {
        return (
            <div className={styles['studio-tab-content']}>
                <div className={styles['studio-header']}>
                    <h1>Playlists</h1>
                </div>
                <div className={styles['playlists-grid']}>
                    {Array.from({ length: 4 }).map((_, index) => (
                        <PlaylistCardSkeleton key={index} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className={styles['studio-tab-content']}>
            <div className={styles['studio-header']}>
                <div>
                    <h1>Playlists</h1>
                    <p className={styles['studio-subtitle']}>
                        {playlists.length} {playlists.length === 1 ? 'playlist' : 'playlists'}
                    </p>
                </div>
                <Button
                    variant="primary"
                    onClick={() => {
                        setShowPlaylistForm(true);
                        setEditingPlaylist(null);
                        setPlaylistForm({ title: '', description: '', isPublic: true });
                    }}
                >
                    Create Playlist
                </Button>
            </div>

            {showPlaylistForm && (
                <div className={styles['studio-form-card']}>
                    <h3>{editingPlaylist ? 'Edit Playlist' : 'Create Playlist'}</h3>
                    <div className={styles['form-group']}>
                        <input
                            type="text"
                            placeholder="Playlist Title"
                            value={playlistForm.title}
                            onChange={(e) => setPlaylistForm({ ...playlistForm, title: e.target.value })}
                            className={styles['form-input']}
                        />
                    </div>
                    <div className={styles['form-group']}>
                        <textarea
                            placeholder="Description (optional)"
                            value={playlistForm.description}
                            onChange={(e) => setPlaylistForm({ ...playlistForm, description: e.target.value })}
                            className={styles['form-textarea']}
                            rows="3"
                        />
                    </div>
                    <label className={styles['form-checkbox']}>
                        <input
                            type="checkbox"
                            checked={playlistForm.isPublic}
                            onChange={(e) => setPlaylistForm({ ...playlistForm, isPublic: e.target.checked })}
                        />
                        <span>Public playlist</span>
                    </label>
                    <div className={styles['form-actions']}>
                        <Button
                            onClick={() => {
                                if (editingPlaylist) {
                                    handleUpdatePlaylist(editingPlaylist.id, playlistForm);
                                } else {
                                    handleCreatePlaylist();
                                }
                            }}
                            disabled={creatingPlaylist || updatingPlaylist === editingPlaylist?.id}
                        >
                            {(creatingPlaylist || updatingPlaylist === editingPlaylist?.id) ? 'Saving...' : (editingPlaylist ? 'Save' : 'Create')}
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setShowPlaylistForm(false);
                                setEditingPlaylist(null);
                                setPlaylistForm({ title: '', description: '', isPublic: true });
                            }}
                            disabled={creatingPlaylist || updatingPlaylist === editingPlaylist?.id}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            {playlists.length === 0 && !showPlaylistForm ? (
                <EmptyState
                    icon={<VideoEmptyIcon />}
                    title="No playlists yet"
                    description="Create a playlist to organize your videos"
                    action={
                        <Button
                            variant="primary"
                            onClick={() => {
                                setShowPlaylistForm(true);
                                setEditingPlaylist(null);
                                setPlaylistForm({ title: '', description: '', isPublic: true });
                            }}
                        >
                            Create Playlist
                        </Button>
                    }
                />
            ) : (
                <div className={styles['studio-table-container']}>
                    <table className={styles['studio-table']}>
                        <thead>
                            <tr>
                                <th className={styles['col-video']}>Playlist</th>
                                <th className={styles['col-visibility']}>Visibility</th>
                                <th className={styles['col-date']}>Created</th>
                                <th className={styles['col-views']}>Videos</th>
                                <th className={styles['col-actions']}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {playlists.map(playlist => (
                                <React.Fragment key={playlist.id}>
                                    <tr>
                                        <td className={styles['col-video']}>
                                            <div className={styles['video-row']}>
                                                <div className={styles['video-thumbnail-wrapper']}>
                                                    <img
                                                        src={playlist.videos?.[0]?.video?.thumbnailUrl || '/placeholder-video.png'}
                                                        alt={playlist.title}
                                                        className={styles['video-thumbnail']}
                                                    />
                                                    <div className={styles['playlist-overlay']}>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M4 2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v16h16V4H4zm2 2h12v2H6V6zm0 4h12v2H6v-2zm0 4h12v2H6v-2z" />
                                                        </svg>
                                                        <span>{playlist.videos?.length || 0}</span>
                                                    </div>
                                                </div>
                                                <div className={styles['video-info']}>
                                                    <div className={styles['video-title']}>{playlist.title}</div>
                                                    {playlist.description && (
                                                        <div className={styles['video-meta']}>
                                                            <span style={{
                                                                display: '-webkit-box',
                                                                WebkitLineClamp: 1,
                                                                WebkitBoxOrient: 'vertical',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis'
                                                            }}>{playlist.description}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className={styles['col-visibility']}>
                                            <span className={`${styles['visibility-badge']} ${playlist.isPublic ? styles['public'] : styles['private']}`}>
                                                {playlist.isPublic ? 'Public' : 'Private'}
                                            </span>
                                        </td>
                                        <td className={styles['col-date']}>
                                            {playlist.createdAt ? formatDate(playlist.createdAt) : '-'}
                                        </td>
                                        <td className={styles['col-views']}>
                                            {playlist.videos?.length || 0}
                                        </td>
                                        <td className={styles['col-actions']}>
                                            <div className={styles['action-buttons']}>
                                                <Button
                                                    variant="ghost"
                                                    size="small"
                                                    onClick={() => setExpandedPlaylistId(
                                                        expandedPlaylistId === playlist.id ? null : playlist.id
                                                    )}
                                                    title="Manage videos"
                                                >
                                                    {expandedPlaylistId === playlist.id ? (
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <polyline points="18 15 12 9 6 15" />
                                                        </svg>
                                                    ) : (
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <polyline points="6 9 12 15 18 9" />
                                                        </svg>
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="small"
                                                    onClick={() => {
                                                        setEditingPlaylist(playlist);
                                                        setPlaylistForm({
                                                            title: playlist.title,
                                                            description: playlist.description || '',
                                                            isPublic: playlist.isPublic,
                                                        });
                                                        setShowPlaylistForm(true);
                                                    }}
                                                    title="Edit"
                                                >
                                                    <EditIcon size={16} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="small"
                                                    onClick={() => handleDeletePlaylist(playlist.id)}
                                                    disabled={deletingPlaylist === playlist.id}
                                                    title="Delete"
                                                >
                                                    <DeleteIcon size={16} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedPlaylistId === playlist.id && (
                                        <tr className={styles['playlist-details-row']}>
                                            <td colSpan="5">
                                                <div className={styles['playlist-videos-manager']}>
                                                    {playlist.videos && playlist.videos.length > 0 && (
                                                        <div className={styles['playlist-current-videos']}>
                                                            <h5>Videos (drag to reorder){reorderingPlaylist === playlist.id && <span style={{ marginLeft: '8px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Reordering...</span>}</h5>
                                                            <div className={styles['playlist-videos-ordered']}>
                                                                {playlist.videos
                                                                    .sort((a, b) => (a.position || 0) - (b.position || 0))
                                                                    .map((playlistVideo, index) => {
                                                                        const video = playlistVideo.video;
                                                                        const videoId = video?.id || playlistVideo.videoId;
                                                                        const isDragged = draggedVideoId === videoId;
                                                                        const isDraggedOver = draggedOverIndex === index;

                                                                        return (
                                                                            <div
                                                                                key={playlistVideo.id || videoId}
                                                                                className={`${styles['playlist-video-ordered-item']} ${isDragged ? styles['dragging'] : ''} ${isDraggedOver ? styles['drag-over'] : ''}`}
                                                                                draggable
                                                                                onDragStart={(e) => handleDragStart(e, videoId)}
                                                                                onDragOver={(e) => handleDragOver(e, index)}
                                                                                onDragLeave={handleDragLeave}
                                                                                onDrop={(e) => handleDrop(e, playlist.id, playlist.videos, index)}
                                                                            >
                                                                                <span className={styles['drag-handle']}>☰</span>
                                                                                <span className={styles['video-title']}>{video?.title || 'Loading...'}</span>
                                                                                <Button
                                                                                    variant="danger"
                                                                                    size="small"
                                                                                    onClick={() => handleRemoveVideoFromPlaylist(playlist.id, videoId)}
                                                                                    disabled={removingFromPlaylist === `${playlist.id}-${videoId}`}
                                                                                >
                                                                                    {removingFromPlaylist === `${playlist.id}-${videoId}` ? 'Removing...' : 'Remove'}
                                                                                </Button>
                                                                            </div>
                                                                        );
                                                                    })}
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className={styles['playlist-add-videos']}>
                                                        <h5>Add Videos</h5>
                                                        <div className={styles['playlist-videos-list']}>
                                                            {videos.map(video => {
                                                                const isInPlaylist = playlist.videos?.some(v =>
                                                                    String(v.video?.id || v.videoId) === String(video.id)
                                                                );
                                                                if (isInPlaylist) return null;

                                                                return (
                                                                    <div key={video.id} className={styles['playlist-video-item']}>
                                                                        <span>{video.title}</span>
                                                                        <Button
                                                                            variant="primary"
                                                                            size="small"
                                                                            onClick={() => handleAddVideoToPlaylist(playlist.id, video.id)}
                                                                            disabled={addingToPlaylist === `${playlist.id}-${video.id}`}
                                                                        >
                                                                            {addingToPlaylist === `${playlist.id}-${video.id}` ? 'Adding...' : 'Add'}
                                                                        </Button>
                                                                    </div>
                                                                );
                                                            })}
                                                            {videos.filter(v => !playlist.videos?.some(pv =>
                                                                String(pv.video?.id || pv.videoId) === String(v.id)
                                                            )).length === 0 && (
                                                                    <div className={styles['playlist-empty-message']}>All videos are in this playlist</div>
                                                                )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

