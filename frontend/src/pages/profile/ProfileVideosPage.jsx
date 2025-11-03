// Profile Videos Page - Manage uploaded videos
import { useState, useEffect } from 'react';
import { useAuth } from '../../shared/context/AuthContext';
import { useAbortController } from '../../shared/lib';
import { videosAPI } from '../../shared/api/videos';
import { playlistsAPI } from '../../shared/api/playlists';
import { useNavigate } from '@tanstack/react-router';
import {
    Button, EmptyState, VideoEmptyIcon, EyeIcon, DeleteIcon,
    UploadIcon, Modal, TableRowSkeleton
} from '../../shared/ui';
import { formatViews, formatDate, formatDuration } from '../../shared/lib';
import styles from './ProfilePage.module.css';

export const ProfileVideosPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const signal = useAbortController();
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [uploadingThumbnail, setUploadingThumbnail] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [selectedVideos, setSelectedVideos] = useState(new Set());
    const [showAddToPlaylistModal, setShowAddToPlaylistModal] = useState(false);
    const [playlists, setPlaylists] = useState([]);
    const [selectedPlaylists, setSelectedPlaylists] = useState(new Set());
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [showNewPlaylistInput, setShowNewPlaylistInput] = useState(false);
    const [addingVideosToPlaylists, setAddingVideosToPlaylists] = useState(false);

    useEffect(() => {
        loadUserVideos();
        loadUserPlaylists();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const loadUserVideos = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await videosAPI.getVideos({ userId: user.id, limit: 100, signal });
            setVideos(data.videos);
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
            const data = await playlistsAPI.getPlaylists({
                userId: user.id,
                includeVideos: true
            }, signal);
            setPlaylists(data.playlists || []);
        } catch (err) {
            if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
                console.error('Error loading playlists:', err);
            }
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
        if (selectedVideos.size === 0) return;

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

    const filteredVideos = videos.filter(video =>
        video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (video.description && video.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className={styles['studio-tab-content']}>
            <div className={styles['studio-header']}>
                <div>
                    <h1>Content</h1>
                    {!loading && (
                        <p className={styles['studio-subtitle']}>
                            {filteredVideos.length} {filteredVideos.length === 1 ? 'video' : 'videos'}
                        </p>
                    )}
                </div>
                {!loading && (
                    <div className={styles['studio-header-actions']}>
                        <div className={styles['studio-search']}>
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
                            <div className={styles['studio-bulk-actions']}>
                                <span className={styles['bulk-count']}>{selectedVideos.size} selected</span>
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
                )}
            </div>

            {loading ? (
                <div className={styles['studio-table-container']}>
                    <table className={styles['studio-table']}>
                        <thead>
                            <tr>
                                <th className={styles['col-checkbox']}></th>
                                <th className={styles['col-video']}>Video</th>
                                <th className={styles['col-visibility']}>Visibility</th>
                                <th className={styles['col-date']}>Date</th>
                                <th className={styles['col-views']}>Views</th>
                                <th className={styles['col-actions']}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: 5 }).map((_, index) => (
                                <tr key={index}>
                                    <td colSpan={6}>
                                        <TableRowSkeleton columns={6} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : filteredVideos.length === 0 ? (
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
                <div className={styles['studio-table-container']}>
                    <table className={styles['studio-table']}>
                        <thead>
                            <tr>
                                <th className={styles['col-checkbox']}>
                                    <input
                                        type="checkbox"
                                        checked={selectedVideos.size === filteredVideos.length && filteredVideos.length > 0}
                                        onChange={handleSelectAllVideos}
                                    />
                                </th>
                                <th className={styles['col-video']}>Video</th>
                                <th className={styles['col-visibility']}>Visibility</th>
                                <th className={styles['col-date']}>Date</th>
                                <th className={styles['col-views']}>Views</th>
                                <th className={styles['col-actions']}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredVideos.map(video => (
                                <tr key={video.id} className={selectedVideos.has(video.id) ? styles['selected'] : ''}>
                                    <td className={styles['col-checkbox']}>
                                        <input
                                            type="checkbox"
                                            checked={selectedVideos.has(video.id)}
                                            onChange={() => handleToggleVideoSelection(video.id)}
                                        />
                                    </td>
                                    <td className={styles['col-video']}>
                                        <div className={styles['video-row']}>
                                            <div className={styles['video-thumbnail-wrapper']}>
                                                <img
                                                    src={video.thumbnailUrl || '/placeholder-video.png'}
                                                    alt={video.title}
                                                    className={styles['video-thumbnail']}
                                                />
                                                {uploadingThumbnail === video.id ? (
                                                    <div className={styles['thumbnail-overlay']}>
                                                        <span>Uploading...</span>
                                                    </div>
                                                ) : (
                                                    <label className={styles['thumbnail-upload-btn']} title="Change thumbnail">
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
                                            <div className={styles['video-info']}>
                                                <div className={styles['video-title']}>{video.title}</div>
                                                <div className={styles['video-meta']}>
                                                    {video.durationMs && (
                                                        <span>{formatDuration(video.durationMs)}</span>
                                                    )}
                                                    {video.status && (
                                                        <span className={`${styles['status-badge']} ${styles['status-' + video.status]}`}>
                                                            {video.status}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className={styles['col-visibility']}>
                                        <span className={`${styles['visibility-badge']} ${styles['public']}`}>Public</span>
                                    </td>
                                    <td className={styles['col-date']}>
                                        {video.uploadedAt ? formatDate(video.uploadedAt) : '-'}
                                    </td>
                                    <td className={styles['col-views']}>
                                        {formatViews(video.views || 0)}
                                    </td>
                                    <td className={styles['col-actions']}>
                                        <div className={styles['action-buttons']}>
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
                    <div className={styles['add-to-playlist-modal']}>
                        <div className={styles['playlist-selection-list']}>
                            {playlists.length === 0 ? (
                                <div className={styles['playlist-selection-empty']}>No playlists yet</div>
                            ) : (
                                playlists.map(playlist => (
                                    <label key={playlist.id} className={styles['playlist-selection-item']}>
                                        <input
                                            type="checkbox"
                                            checked={selectedPlaylists.has(playlist.id)}
                                            onChange={() => handleTogglePlaylistSelection(playlist.id)}
                                        />
                                        <div className={styles['playlist-selection-info']}>
                                            <div className={styles['playlist-selection-name']}>{playlist.title}</div>
                                            <div className={styles['playlist-selection-meta']}>
                                                {playlist.videos?.length || 0} videos • {playlist.isPublic ? 'Public' : 'Private'}
                                            </div>
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>
                        <div className={styles['new-playlist-section']}>
                            {!showNewPlaylistInput ? (
                                <Button
                                    variant="secondary"
                                    onClick={() => setShowNewPlaylistInput(true)}
                                    style={{ width: '100%' }}
                                >
                                    Create New Playlist
                                </Button>
                            ) : (
                                <div className={styles['new-playlist-input']}>
                                    <input
                                        type="text"
                                        placeholder="Playlist name"
                                        value={newPlaylistName}
                                        onChange={(e) => setNewPlaylistName(e.target.value)}
                                        className={styles['form-input']}
                                    />
                                </div>
                            )}
                        </div>
                        <div className={styles['modal-actions']}>
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
                        <div className={styles['modal-actions']}>
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

