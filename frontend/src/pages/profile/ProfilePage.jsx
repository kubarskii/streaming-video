// Pages: Profile Page - YouTube Studio Style
// User profile with video and playlist management
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../shared/context/AuthContext';
import { useAbortController } from '../../shared/lib';
import { videosAPI } from '../../shared/api/videos';
import { channelsAPI } from '../../shared/api/channels';
import { playlistsAPI } from '../../shared/api/playlists';
import { useNavigate, useLocation, Link } from '@tanstack/react-router';
import { Avatar, Button, EmptyState, VideoEmptyIcon, EditIcon, EyeIcon, DeleteIcon, UploadIcon, Modal, Spinner } from '../../shared/ui';
import { formatViews, formatDate, formatDuration } from '../../shared/lib';
import './ProfilePage.css';

export const ProfilePage = () => {
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const signal = useAbortController();
    const [videos, setVideos] = useState([]);
    const [channel, setChannel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Determine active tab from URL
    const getActiveTab = () => {
        const path = location.pathname;
        // Exact path matching for nested routes
        if (path === '/profile/playlists' || path.startsWith('/profile/playlists/')) return 'playlists';
        if (path === '/profile/channel' || path.startsWith('/profile/channel/')) return 'channel';
        if (path === '/profile' || path === '/profile/') return 'videos';
        // Fallback to includes for any other nested routes under profile
        if (path.includes('/playlists')) return 'playlists';
        if (path.includes('/channel')) return 'channel';
        return 'videos';
    };
    const activeTab = getActiveTab();
    const [searchQuery, setSearchQuery] = useState('');
    const [showChannelForm, setShowChannelForm] = useState(false);
    const [channelForm, setChannelForm] = useState({
        name: '',
        description: '',
    });
    const [uploadingThumbnail, setUploadingThumbnail] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [playlists, setPlaylists] = useState([]);
    const [showPlaylistForm, setShowPlaylistForm] = useState(false);
    const [editingPlaylist, setEditingPlaylist] = useState(null);
    const [playlistForm, setPlaylistForm] = useState({
        title: '',
        description: '',
        isPublic: true,
    });
    const [selectedVideos, setSelectedVideos] = useState(new Set());
    const [showAddToPlaylistModal, setShowAddToPlaylistModal] = useState(false);
    const [selectedPlaylists, setSelectedPlaylists] = useState(new Set());
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [showNewPlaylistInput, setShowNewPlaylistInput] = useState(false);
    const [draggedVideoId, setDraggedVideoId] = useState(null);
    const [draggedOverIndex, setDraggedOverIndex] = useState(null);
    const [expandedPlaylistId, setExpandedPlaylistId] = useState(null);

    // Loading states for playlist operations
    const [playlistsLoading, setPlaylistsLoading] = useState(true);
    const [creatingPlaylist, setCreatingPlaylist] = useState(false);
    const [updatingPlaylist, setUpdatingPlaylist] = useState(null);
    const [deletingPlaylist, setDeletingPlaylist] = useState(null);
    const [addingToPlaylist, setAddingToPlaylist] = useState(null);
    const [removingFromPlaylist, setRemovingFromPlaylist] = useState(null);
    const [reorderingPlaylist, setReorderingPlaylist] = useState(null);
    const [addingVideosToPlaylists, setAddingVideosToPlaylists] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate({ to: '/login' });
            return;
        }
        loadUserVideos();
        loadUserPlaylists();
    }, [isAuthenticated, user, signal]);

    const loadUserVideos = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await videosAPI.getVideos({ userId: user.id, limit: 100, signal });
            setVideos(data.videos);

            // Load channel info
            try {
                const channelData = await channelsAPI.getChannel({ userId: user.id, signal });
                setChannel(channelData);
                setChannelForm({
                    name: channelData.name,
                    description: channelData.description || '',
                });
            } catch (err) {
                if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
                    setChannel(null);
                    setChannelForm({
                        name: user.username || '',
                        description: '',
                    });
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
                console.error('Error loading videos:', err);
                setError('Failed to load videos');
            }
        } finally {
            setLoading(false);
        }
    };

    const loadUserPlaylists = async () => {
        try {
            setPlaylistsLoading(true);
            const data = await playlistsAPI.getPlaylists({ userId: user.id }, signal);
            const playlists = data.playlists || [];

            // Load full playlist data with videos for each playlist
            const playlistsWithVideos = await Promise.all(
                playlists.map(async (playlist) => {
                    try {
                        const fullPlaylist = await playlistsAPI.getPlaylist(playlist.id, signal);
                        return fullPlaylist.playlist || playlist;
                    } catch (err) {
                        return playlist;
                    }
                })
            );

            setPlaylists(playlistsWithVideos);
        } catch (err) {
            if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
                console.error('Error loading playlists:', err);
            }
        } finally {
            setPlaylistsLoading(false);
        }
    };

    const handleCreateChannel = async () => {
        try {
            const newChannel = await channelsAPI.createChannel(channelForm);
            setChannel(newChannel);
            setShowChannelForm(false);
        } catch (err) {
            console.error('Error creating channel:', err);
            alert('Failed to create channel: ' + err.message);
        }
    };

    const handleUpdateChannel = async () => {
        try {
            const updated = await channelsAPI.updateChannel(channel.id, channelForm);
            setChannel(updated);
            setShowChannelForm(false);
        } catch (err) {
            console.error('Error updating channel:', err);
            alert('Failed to update channel: ' + err.message);
        }
    };

    const handleThumbnailChange = async (videoId, event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setUploadingThumbnail(videoId);
            await videosAPI.updateVideoThumbnail(videoId, file);
            await loadUserVideos();
        } catch (err) {
            console.error('Error uploading thumbnail:', err);
            alert('Failed to upload thumbnail: ' + err.message);
        } finally {
            setUploadingThumbnail(null);
        }
    };

    const handleDeleteVideo = async (videoId) => {
        try {
            await videosAPI.deleteVideo(videoId);
            setDeleteConfirm(null);
            await loadUserVideos();
        } catch (err) {
            console.error('Error deleting video:', err);
            alert('Failed to delete video: ' + err.message);
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

    const handleToggleVideoSelection = (videoId) => {
        const newSelection = new Set(selectedVideos);
        if (newSelection.has(videoId)) {
            newSelection.delete(videoId);
        } else {
            newSelection.add(videoId);
        }
        setSelectedVideos(newSelection);
    };

    const handleSelectAllVideos = () => {
        if (selectedVideos.size === filteredVideos.length) {
            setSelectedVideos(new Set());
        } else {
            setSelectedVideos(new Set(filteredVideos.map(v => v.id)));
        }
    };

    const handleOpenAddToPlaylist = () => {
        setSelectedPlaylists(new Set());
        setNewPlaylistName('');
        setShowNewPlaylistInput(false);
        setShowAddToPlaylistModal(true);
    };

    const handleTogglePlaylistSelection = (playlistId) => {
        const newSelection = new Set(selectedPlaylists);
        if (newSelection.has(playlistId)) {
            newSelection.delete(playlistId);
        } else {
            newSelection.add(playlistId);
        }
        setSelectedPlaylists(newSelection);
    };

    const handleAddVideosToPlaylists = async () => {
        if (selectedVideos.size === 0) {
            return;
        }

        try {
            setAddingVideosToPlaylists(true);
            let newPlaylistId = null;

            if (showNewPlaylistInput && newPlaylistName.trim()) {
                const newPlaylist = await playlistsAPI.createPlaylist({
                    title: newPlaylistName.trim(),
                    description: '',
                    isPublic: true,
                    userId: user.id,
                });
                newPlaylistId = newPlaylist.playlist?.id || newPlaylist.id;
                selectedPlaylists.add(newPlaylistId);
                await loadUserPlaylists();
            }

            const videoIds = Array.from(selectedVideos);
            const playlistIds = Array.from(selectedPlaylists);

            if (playlistIds.length === 0 && !newPlaylistId) {
                alert('Please select at least one playlist or create a new one');
                return;
            }

            const allPlaylistIds = newPlaylistId ? [...playlistIds, newPlaylistId] : playlistIds;

            for (const playlistId of allPlaylistIds) {
                for (const videoId of videoIds) {
                    try {
                        await playlistsAPI.addVideoToPlaylist(playlistId, videoId);
                    } catch (err) {
                        console.debug('Video might already be in playlist:', err);
                    }
                }
            }

            setSelectedVideos(new Set());
            setSelectedPlaylists(new Set());
            setShowAddToPlaylistModal(false);
            setShowNewPlaylistInput(false);
            setNewPlaylistName('');

            await loadUserPlaylists();
        } catch (err) {
            console.error('Error adding videos to playlists:', err);
            alert('Failed to add videos to playlists: ' + err.message);
        } finally {
            setAddingVideosToPlaylists(false);
        }
    };

    // Filter videos based on search query
    const filteredVideos = videos.filter(video =>
        video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (video.description && video.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (loading) {
        return (
            <div className="studio-page">
                <div className="studio-loading">Loading...</div>
            </div>
        );
    }

    return (
        <div className="studio-page">
            {/* Sidebar Navigation */}
            <aside className="studio-sidebar">
                <div className="studio-sidebar-header">
                    <Avatar
                        src={user?.profilePicture}
                        name={user?.username}
                        size="large"
                    />
                    <div className="studio-sidebar-user-info">
                        <h3>{user?.username}</h3>
                        <p>{channel?.name || 'Your Channel'}</p>
                    </div>
                </div>
                <nav className="studio-nav">
                    <Link
                        to="/profile"
                        className="studio-nav-item"
                        activeOptions={{ exact: true }}
                        activeProps={{ className: 'studio-nav-item active' }}
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18 4l2 3h-3l-2-3h-2l2 3h-3l-2-3H8l2 3H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
                        </svg>
                        <span>Content</span>
                    </Link>
                    <Link
                        to="/profile/playlists"
                        className="studio-nav-item"
                        activeOptions={{ exact: false }}
                        activeProps={{ className: 'studio-nav-item active' }}
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12zM10 9h8v2h-8zm0 3h4v2h-4zm0-6h8v2h-8z" />
                        </svg>
                        <span>Playlists</span>
                    </Link>
                    <Link
                        to="/profile/channel"
                        className="studio-nav-item"
                        activeOptions={{ exact: false }}
                        activeProps={{ className: 'studio-nav-item active' }}
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                        </svg>
                        <span>Customization</span>
                    </Link>
                </nav>
                <div className="studio-sidebar-footer">
                    <Button
                        variant="primary"
                        size="medium"
                        onClick={() => navigate({ to: '/upload' })}
                        style={{ width: '100%', justifyContent: 'center' }}
                    >
                        <UploadIcon size={18} />
                        Create
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="studio-content">
                {/* Videos Tab */}
                {activeTab === 'videos' && (
                    <div className="studio-tab-content">
                        <div className="studio-header">
                            <div>
                                <h1>Content</h1>
                                <p className="studio-subtitle">{filteredVideos.length} {filteredVideos.length === 1 ? 'video' : 'videos'}</p>
                            </div>
                            <div className="studio-header-actions">
                                <div className="studio-search">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="11" cy="11" r="8" />
                                        <path d="m21 21-4.35-4.35" />
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="Search videos..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                {selectedVideos.size > 0 && (
                                    <div className="studio-bulk-actions">
                                        <span className="bulk-count">{selectedVideos.size} selected</span>
                                        <Button
                                            variant="secondary"
                                            size="small"
                                            onClick={handleOpenAddToPlaylist}
                                        >
                                            Add to playlist
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {filteredVideos.length === 0 ? (
                            <EmptyState
                                icon={<VideoEmptyIcon />}
                                title={searchQuery ? "No videos found" : "No videos yet"}
                                description={searchQuery ? "Try a different search term" : "Upload your first video to get started!"}
                                action={
                                    !searchQuery && (
                                        <Button variant="primary" onClick={() => navigate({ to: '/upload' })}>
                                            Upload Video
                                        </Button>
                                    )
                                }
                            />
                        ) : (
                            <div className="studio-table-container">
                                <table className="studio-table">
                                    <thead>
                                        <tr>
                                            <th className="col-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedVideos.size === filteredVideos.length && filteredVideos.length > 0}
                                                    onChange={handleSelectAllVideos}
                                                />
                                            </th>
                                            <th className="col-video">Video</th>
                                            <th className="col-visibility">Visibility</th>
                                            <th className="col-date">Date</th>
                                            <th className="col-views">Views</th>
                                            <th className="col-actions">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredVideos.map(video => (
                                            <tr key={video.id} className={selectedVideos.has(video.id) ? 'selected' : ''}>
                                                <td className="col-checkbox">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedVideos.has(video.id)}
                                                        onChange={() => handleToggleVideoSelection(video.id)}
                                                    />
                                                </td>
                                                <td className="col-video">
                                                    <div className="video-row">
                                                        <div className="video-thumbnail-wrapper">
                                                            <img
                                                                src={video.thumbnailUrl || '/placeholder-video.png'}
                                                                alt={video.title}
                                                                className="video-thumbnail"
                                                            />
                                                            {uploadingThumbnail === video.id ? (
                                                                <div className="thumbnail-overlay">
                                                                    <span>Uploading...</span>
                                                                </div>
                                                            ) : (
                                                                <label className="thumbnail-upload-btn" title="Change thumbnail">
                                                                    <UploadIcon size={14} />
                                                                    <input
                                                                        type="file"
                                                                        accept="image/*"
                                                                        onChange={(e) => handleThumbnailChange(video.id, e)}
                                                                        style={{ display: 'none' }}
                                                                    />
                                                                </label>
                                                            )}
                                                        </div>
                                                        <div className="video-info">
                                                            <div className="video-title">{video.title}</div>
                                                            <div className="video-meta">
                                                                {video.durationMs && (
                                                                    <span>{formatDuration(video.durationMs)}</span>
                                                                )}
                                                                {video.status && (
                                                                    <span className={`status-badge status-${video.status}`}>
                                                                        {video.status}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="col-visibility">
                                                    <span className="visibility-badge public">Public</span>
                                                </td>
                                                <td className="col-date">
                                                    {video.uploadedAt ? formatDate(video.uploadedAt) : '-'}
                                                </td>
                                                <td className="col-views">
                                                    {formatViews(video.views || 0)}
                                                </td>
                                                <td className="col-actions">
                                                    <div className="action-buttons">
                                                        <Button
                                                            variant="ghost"
                                                            size="small"
                                                            onClick={() => navigate({ to: `/video/${video.id}` })}
                                                            title="View"
                                                        >
                                                            <EyeIcon size={16} />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="small"
                                                            onClick={() => setDeleteConfirm(video.id)}
                                                            title="Delete"
                                                        >
                                                            <DeleteIcon size={16} />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Playlists Tab */}
                {activeTab === 'playlists' && (
                    <div className="studio-tab-content">
                        <div className="studio-header">
                            <div>
                                <h1>Playlists</h1>
                                <p className="studio-subtitle">{playlists.length} {playlists.length === 1 ? 'playlist' : 'playlists'}</p>
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
                            <div className="studio-form-card">
                                <h3>{editingPlaylist ? 'Edit Playlist' : 'Create Playlist'}</h3>
                                <div className="form-group">
                                    <input
                                        type="text"
                                        placeholder="Playlist Title"
                                        value={playlistForm.title}
                                        onChange={(e) => setPlaylistForm({ ...playlistForm, title: e.target.value })}
                                        className="form-input"
                                    />
                                </div>
                                <div className="form-group">
                                    <textarea
                                        placeholder="Description (optional)"
                                        value={playlistForm.description}
                                        onChange={(e) => setPlaylistForm({ ...playlistForm, description: e.target.value })}
                                        className="form-textarea"
                                        rows="3"
                                    />
                                </div>
                                <label className="form-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={playlistForm.isPublic}
                                        onChange={(e) => setPlaylistForm({ ...playlistForm, isPublic: e.target.checked })}
                                    />
                                    <span>Public playlist</span>
                                </label>
                                <div className="form-actions">
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

                        {playlistsLoading ? (
                            <div className="studio-loading">
                                <Spinner size="large" label="Loading playlists" />
                            </div>
                        ) : playlists.length === 0 && !showPlaylistForm ? (
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
                            <div className="studio-table-container">
                                <table className="studio-table">
                                    <thead>
                                        <tr>
                                            <th className="col-video">Playlist</th>
                                            <th className="col-visibility">Visibility</th>
                                            <th className="col-date">Created</th>
                                            <th className="col-views">Videos</th>
                                            <th className="col-actions">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {playlists.map(playlist => (
                                            <React.Fragment key={playlist.id}>
                                                <tr>
                                                    <td className="col-video">
                                                        <div className="video-row">
                                                            <div className="video-thumbnail-wrapper">
                                                                <img
                                                                    src={playlist.videos?.[0]?.video?.thumbnailUrl || '/placeholder-video.png'}
                                                                    alt={playlist.title}
                                                                    className="video-thumbnail"
                                                                />
                                                                <div className="playlist-overlay">
                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                                        <path d="M4 2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v16h16V4H4zm2 2h12v2H6V6zm0 4h12v2H6v-2zm0 4h12v2H6v-2z" />
                                                                    </svg>
                                                                    <span>{playlist.videos?.length || 0}</span>
                                                                </div>
                                                            </div>
                                                            <div className="video-info">
                                                                <div className="video-title">{playlist.title}</div>
                                                                {playlist.description && (
                                                                    <div className="video-meta">
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
                                                    <td className="col-visibility">
                                                        <span className={`visibility-badge ${playlist.isPublic ? 'public' : 'private'}`}>
                                                            {playlist.isPublic ? 'Public' : 'Private'}
                                                        </span>
                                                    </td>
                                                    <td className="col-date">
                                                        {playlist.createdAt ? formatDate(playlist.createdAt) : '-'}
                                                    </td>
                                                    <td className="col-views">
                                                        {playlist.videos?.length || 0}
                                                    </td>
                                                    <td className="col-actions">
                                                        <div className="action-buttons">
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
                                                    <tr className="playlist-details-row">
                                                        <td colSpan="5">
                                                            <div className="playlist-videos-manager">
                                                                {playlist.videos && playlist.videos.length > 0 && (
                                                                    <div className="playlist-current-videos">
                                                                        <h5>Videos (drag to reorder){reorderingPlaylist === playlist.id && <span style={{ marginLeft: '8px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Reordering...</span>}</h5>
                                                                        <div className="playlist-videos-ordered">
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
                                                                                            className={`playlist-video-ordered-item ${isDragged ? 'dragging' : ''} ${isDraggedOver ? 'drag-over' : ''}`}
                                                                                            draggable
                                                                                            onDragStart={(e) => handleDragStart(e, videoId)}
                                                                                            onDragOver={(e) => handleDragOver(e, index)}
                                                                                            onDragLeave={handleDragLeave}
                                                                                            onDrop={(e) => handleDrop(e, playlist.id, playlist.videos, index)}
                                                                                        >
                                                                                            <span className="drag-handle">☰</span>
                                                                                            <span className="video-title">{video?.title || 'Loading...'}</span>
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
                                                                <div className="playlist-add-videos">
                                                                    <h5>Add Videos</h5>
                                                                    <div className="playlist-videos-list">
                                                                        {videos.map(video => {
                                                                            const isInPlaylist = playlist.videos?.some(v =>
                                                                                String(v.video?.id || v.videoId) === String(video.id)
                                                                            );
                                                                            if (isInPlaylist) return null;

                                                                            return (
                                                                                <div key={video.id} className="playlist-video-item">
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
                                                                                <div className="playlist-empty-message">All videos are in this playlist</div>
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
                )}

                {/* Channel Tab */}
                {activeTab === 'channel' && (
                    <div className="studio-tab-content">
                        <div className="studio-header">
                            <div>
                                <h1>Channel</h1>
                                <p className="studio-subtitle">Manage your channel settings</p>
                            </div>
                            {channel && (
                                <Button
                                    variant="secondary"
                                    onClick={() => navigate({ to: `/channel/${user.id}` })}
                                >
                                    View Public Channel
                                </Button>
                            )}
                        </div>

                        {!channel ? (
                            <div className="studio-form-card">
                                <h2>Create Your Channel</h2>
                                <p>Create a channel to make your videos discoverable by others</p>
                                <div className="form-group">
                                    <label>Channel Name</label>
                                    <input
                                        type="text"
                                        placeholder="Channel Name"
                                        value={channelForm.name}
                                        onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
                                        className="form-input"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Description</label>
                                    <textarea
                                        placeholder="Channel Description"
                                        value={channelForm.description}
                                        onChange={(e) => setChannelForm({ ...channelForm, description: e.target.value })}
                                        className="form-textarea"
                                        rows="4"
                                    />
                                </div>
                                <div className="form-actions">
                                    <Button onClick={handleCreateChannel}>Create Channel</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="studio-form-card">
                                <h2>Edit Channel</h2>
                                <div className="form-group">
                                    <label>Channel Name</label>
                                    <input
                                        type="text"
                                        placeholder="Channel Name"
                                        value={channelForm.name}
                                        onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
                                        className="form-input"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Description</label>
                                    <textarea
                                        placeholder="Channel Description"
                                        value={channelForm.description}
                                        onChange={(e) => setChannelForm({ ...channelForm, description: e.target.value })}
                                        className="form-textarea"
                                        rows="4"
                                    />
                                </div>
                                <div className="form-actions">
                                    <Button onClick={handleUpdateChannel}>Save Changes</Button>
                                    <Button variant="secondary" onClick={() => setChannelForm({
                                        name: channel.name,
                                        description: channel.description || '',
                                    })}>
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Add to Playlist Modal */}
            {showAddToPlaylistModal && (
                <Modal
                    isOpen={showAddToPlaylistModal}
                    onClose={() => {
                        setShowAddToPlaylistModal(false);
                        setShowNewPlaylistInput(false);
                        setNewPlaylistName('');
                    }}
                    title="Add to Playlist"
                >
                    <div className="add-to-playlist-modal">
                        <div className="playlist-selection-list">
                            {playlists.length === 0 ? (
                                <div className="playlist-selection-empty">No playlists yet</div>
                            ) : (
                                playlists.map(playlist => (
                                    <label key={playlist.id} className="playlist-selection-item">
                                        <input
                                            type="checkbox"
                                            checked={selectedPlaylists.has(playlist.id)}
                                            onChange={() => handleTogglePlaylistSelection(playlist.id)}
                                        />
                                        <div className="playlist-selection-info">
                                            <div className="playlist-selection-name">{playlist.title}</div>
                                            <div className="playlist-selection-meta">
                                                {playlist.videos?.length || 0} videos • {playlist.isPublic ? 'Public' : 'Private'}
                                            </div>
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>
                        <div className="new-playlist-section">
                            {!showNewPlaylistInput ? (
                                <Button
                                    variant="secondary"
                                    onClick={() => setShowNewPlaylistInput(true)}
                                    style={{ width: '100%' }}
                                >
                                    Create New Playlist
                                </Button>
                            ) : (
                                <div className="new-playlist-input">
                                    <input
                                        type="text"
                                        placeholder="Playlist name"
                                        value={newPlaylistName}
                                        onChange={(e) => setNewPlaylistName(e.target.value)}
                                        className="form-input"
                                    />
                                </div>
                            )}
                        </div>
                        <div className="modal-actions">
                            <Button
                                onClick={handleAddVideosToPlaylists}
                                disabled={addingVideosToPlaylists || (selectedPlaylists.size === 0 && !showNewPlaylistInput)}
                            >
                                {addingVideosToPlaylists ? 'Saving...' : 'Save'}
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    setShowAddToPlaylistModal(false);
                                    setShowNewPlaylistInput(false);
                                    setNewPlaylistName('');
                                }}
                                disabled={addingVideosToPlaylists}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Delete Confirmation */}
            {deleteConfirm && (
                <Modal
                    isOpen={!!deleteConfirm}
                    onClose={() => setDeleteConfirm(null)}
                    title="Delete Video"
                >
                    <div>
                        <p>Are you sure you want to delete this video? This action cannot be undone.</p>
                        <div className="modal-actions">
                            <Button
                                variant="danger"
                                onClick={() => handleDeleteVideo(deleteConfirm)}
                            >
                                Delete
                            </Button>
                            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
