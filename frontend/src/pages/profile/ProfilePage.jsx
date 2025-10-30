// Pages: Profile Page - YouTube Studio Style
// User profile with video and playlist management
import { useState, useEffect } from 'react';
import { useAuth } from '../../shared/context/AuthContext';
import { useAbortController } from '../../shared/lib';
import { videosAPI } from '../../shared/api/videos';
import { channelsAPI } from '../../shared/api/channels';
import { playlistsAPI } from '../../shared/api/playlists';
import { useNavigate } from '@tanstack/react-router';
import { Avatar, Button, EmptyState, VideoEmptyIcon, EditIcon, EyeIcon, DeleteIcon, UploadIcon, Modal } from '../../shared/ui';
import { formatViews, formatDate, formatDuration } from '../../shared/lib';
import './ProfilePage.css';

export const ProfilePage = () => {
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const signal = useAbortController();
    const [videos, setVideos] = useState([]);
    const [channel, setChannel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('videos'); // 'videos', 'playlists', 'channel'
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
            await playlistsAPI.createPlaylist({
                title: playlistForm.title.trim(),
                description: playlistForm.description.trim() || null,
                isPublic: playlistForm.isPublic,
                userId: user.id,
            });
            setPlaylistForm({ title: '', description: '', isPublic: true });
            setShowPlaylistForm(false);
            loadUserPlaylists();
        } catch (err) {
            console.error('Error creating playlist:', err);
            alert('Failed to create playlist: ' + err.message);
        }
    };

    const handleUpdatePlaylist = async (playlistId, updates) => {
        try {
            await playlistsAPI.updatePlaylist(playlistId, updates);
            loadUserPlaylists();
            setEditingPlaylist(null);
        } catch (err) {
            console.error('Error updating playlist:', err);
            alert('Failed to update playlist: ' + err.message);
        }
    };

    const handleDeletePlaylist = async (playlistId) => {
        if (!window.confirm('Are you sure you want to delete this playlist?')) {
            return;
        }
        try {
            await playlistsAPI.deletePlaylist(playlistId);
            loadUserPlaylists();
        } catch (err) {
            console.error('Error deleting playlist:', err);
            alert('Failed to delete playlist: ' + err.message);
        }
    };

    const handleAddVideoToPlaylist = async (playlistId, videoId) => {
        try {
            await playlistsAPI.addVideoToPlaylist(playlistId, videoId);
            loadUserPlaylists();
        } catch (err) {
            console.error('Error adding video to playlist:', err);
            alert('Failed to add video to playlist: ' + err.message);
        }
    };

    const handleRemoveVideoFromPlaylist = async (playlistId, videoId) => {
        try {
            await playlistsAPI.removeVideoFromPlaylist(playlistId, videoId);
            loadUserPlaylists();
        } catch (err) {
            console.error('Error removing video from playlist:', err);
            alert('Failed to remove video from playlist: ' + err.message);
        }
    };

    const handleReorderPlaylist = async (playlistId, orderedVideoIds) => {
        try {
            await playlistsAPI.reorderPlaylistVideos(playlistId, orderedVideoIds);
            loadUserPlaylists();
        } catch (err) {
            console.error('Error reordering playlist:', err);
            alert('Failed to reorder playlist: ' + err.message);
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
                    <h2>Studio</h2>
                </div>
                <nav className="studio-nav">
                    <button
                        className={`studio-nav-item ${activeTab === 'videos' ? 'active' : ''}`}
                        onClick={() => setActiveTab('videos')}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <line x1="9" y1="3" x2="9" y2="21" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                        </svg>
                        <span>Videos</span>
                    </button>
                    <button
                        className={`studio-nav-item ${activeTab === 'playlists' ? 'active' : ''}`}
                        onClick={() => setActiveTab('playlists')}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                        </svg>
                        <span>Playlists</span>
                    </button>
                    <button
                        className={`studio-nav-item ${activeTab === 'channel' ? 'active' : ''}`}
                        onClick={() => setActiveTab('channel')}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span>Channel</span>
                    </button>
                </nav>
                <div className="studio-sidebar-footer">
                    <Button
                        variant="primary"
                        size="small"
                        onClick={() => navigate({ to: '/upload' })}
                        style={{ width: '100%' }}
                    >
                        <UploadIcon size={16} />
                        Upload Video
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
                                    >
                                        {editingPlaylist ? 'Save' : 'Create'}
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        onClick={() => {
                                            setShowPlaylistForm(false);
                                            setEditingPlaylist(null);
                                            setPlaylistForm({ title: '', description: '', isPublic: true });
                                        }}
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
                            <div className="studio-playlists">
                                {playlists.map(playlist => (
                                    <div key={playlist.id} className="studio-playlist-card">
                                        <div className="playlist-card-header">
                                            <div className="playlist-header-info">
                                                <h3>{playlist.title}</h3>
                                                <p className="playlist-meta">
                                                    {playlist.videos?.length || 0} videos • {playlist.isPublic ? 'Public' : 'Private'}
                                                </p>
                                            </div>
                                            <div className="playlist-card-actions">
                                                <Button
                                                    variant="primary"
                                                    size="small"
                                                    onClick={() => navigate({ to: `/playlist/${playlist.id}/manage` })}
                                                >
                                                    Manage
                                                </Button>
                                                <Button
                                                    variant="secondary"
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
                                                >
                                                    <EditIcon size={14} />
                                                    Edit
                                                </Button>
                                                <Button
                                                    variant="danger"
                                                    size="small"
                                                    onClick={() => handleDeletePlaylist(playlist.id)}
                                                >
                                                    <DeleteIcon size={14} />
                                                    Delete
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="small"
                                                    onClick={() => setExpandedPlaylistId(
                                                        expandedPlaylistId === playlist.id ? null : playlist.id
                                                    )}
                                                >
                                                    {expandedPlaylistId === playlist.id ? '▼' : '▶'}
                                                </Button>
                                            </div>
                                        </div>
                                        {playlist.description && (
                                            <p className="playlist-description">{playlist.description}</p>
                                        )}
                                        {expandedPlaylistId === playlist.id && (
                                            <div className="playlist-videos-manager">
                                                {playlist.videos && playlist.videos.length > 0 && (
                                                    <div className="playlist-current-videos">
                                                        <h5>Videos (drag to reorder)</h5>
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
                                                                            >
                                                                                Remove
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
                                                                    >
                                                                        Add
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
                                        )}
                                    </div>
                                ))}
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
                            <Button onClick={handleAddVideosToPlaylists} disabled={selectedPlaylists.size === 0 && !showNewPlaylistInput}>
                                Save
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    setShowAddToPlaylistModal(false);
                                    setShowNewPlaylistInput(false);
                                    setNewPlaylistName('');
                                }}
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
