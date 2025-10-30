// Pages: Profile Page
// User profile with video management features
import { useState, useEffect } from 'react';
import { useAuth } from '../../shared/context/AuthContext';
import { useAbortController } from '../../shared/lib';
import { videosAPI } from '../../shared/api/videos';
import { channelsAPI } from '../../shared/api/channels';
import { useNavigate } from '@tanstack/react-router';
import { VideoCard, VideoCardGrid, Avatar, Button, EmptyState, VideoEmptyIcon, EditIcon, EyeIcon, DeleteIcon, UploadIcon, ConfirmDialog } from '../../shared/ui';
import './ProfilePage.css';

export const ProfilePage = () => {
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const signal = useAbortController();
    const [videos, setVideos] = useState([]);
    const [channel, setChannel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showChannelForm, setShowChannelForm] = useState(false);
    const [channelForm, setChannelForm] = useState({
        name: '',
        description: '',
    });
    const [uploadingThumbnail, setUploadingThumbnail] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate({ to: '/login' });
            return;
        }
        loadUserVideos();
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
                // Ignore abort errors
                if (err.name === 'AbortError' || err.name === 'CanceledError') {
                    return;
                }
                // Channel doesn't exist yet
                setChannel(null);
                setChannelForm({
                    name: user.username || '',
                    description: '',
                });
            }
        } catch (err) {
            // Ignore abort errors
            if (err.name === 'AbortError' || err.name === 'CanceledError') {
                return;
            }
            console.error('Error loading videos:', err);
            setError('Failed to load videos');
        } finally {
            setLoading(false);
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
            const updatedChannel = await channelsAPI.updateChannel(channel.id, channelForm);
            setChannel(updatedChannel);
            setShowChannelForm(false);
        } catch (err) {
            console.error('Error updating channel:', err);
            alert('Failed to update channel: ' + err.message);
        }
    };

    const handleUpdate = async (videoId, updates) => {
        try {
            await videosAPI.updateVideoMetadata(videoId, updates);
            setVideos(videos.map(v =>
                v.id === videoId ? { ...v, ...updates } : v
            ));
        } catch (err) {
            console.error('Error updating video:', err);
            throw err;
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        try {
            await videosAPI.deleteVideo(deleteConfirm);
            setVideos(videos.filter(v => v.id !== deleteConfirm));
            setDeleteConfirm(null);
        } catch (err) {
            console.error('Error deleting video:', err);
            alert('Failed to delete video');
        }
    };

    const handleThumbnailChange = async (videoId, event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        setUploadingThumbnail(videoId);
        try {
            const response = await videosAPI.updateVideoThumbnail(videoId, file);
            setVideos(videos.map(v =>
                v.id === videoId
                    ? { ...v, thumbnailUrl: response.video.thumbnailUrl }
                    : v
            ));
        } catch (err) {
            console.error('Error updating thumbnail:', err);
            alert('Failed to update thumbnail');
        } finally {
            setUploadingThumbnail(null);
        }
    };

    if (loading) {
        return (
            <div className="profile-page">
                <div className="loading">Loading your videos...</div>
            </div>
        );
    }

    return (
        <div className="profile-page">
            <div className="profile-header">
                <div className="profile-info">
                    <Avatar name={user?.username} size="xlarge" />
                    <div>
                        <h1>{user?.username}</h1>
                        <p className="profile-email">{user?.email}</p>
                        <div className="profile-actions">
                            {channel && (
                                <>
                                    <Button
                                        variant="secondary"
                                        size="small"
                                        onClick={() => navigate({ to: `/channel/${user.id}` })}
                                    >
                                        View Public Channel
                                    </Button>
                                    <Button
                                        variant="primary"
                                        size="small"
                                        onClick={() => navigate({ to: '/upload' })}
                                    >
                                        Upload Video
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="profile-stats">
                    <div className="stat">
                        <span className="stat-value">{videos.length}</span>
                        <span className="stat-label">Videos</span>
                    </div>
                    {channel && (
                        <div className="stat">
                            <span className="stat-value">{channel.subscriberCount}</span>
                            <span className="stat-label">Subscribers</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Channel Management Section */}
            <div className="channel-section">
                {!channel ? (
                    <div className="channel-create">
                        <h2>Create Your Channel</h2>
                        <p>Create a channel to make your videos discoverable by others</p>
                        {!showChannelForm ? (
                            <Button onClick={() => setShowChannelForm(true)}>
                                Create Channel
                            </Button>
                        ) : (
                            <div className="channel-form">
                                <input
                                    type="text"
                                    placeholder="Channel Name"
                                    value={channelForm.name}
                                    onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
                                    className="form-input"
                                />
                                <textarea
                                    placeholder="Channel Description"
                                    value={channelForm.description}
                                    onChange={(e) => setChannelForm({ ...channelForm, description: e.target.value })}
                                    className="form-textarea"
                                    rows="3"
                                />
                                <div className="form-actions">
                                    <Button onClick={handleCreateChannel}>Create</Button>
                                    <Button variant="secondary" onClick={() => setShowChannelForm(false)}>
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="channel-info">
                        <h2>Your Channel</h2>
                        {!showChannelForm ? (
                            <div>
                                <p><strong>{channel.name}</strong></p>
                                <p>{channel.description}</p>
                                <Button size="small" onClick={() => setShowChannelForm(true)}>
                                    Edit Channel
                                </Button>
                            </div>
                        ) : (
                            <div className="channel-form">
                                <input
                                    type="text"
                                    placeholder="Channel Name"
                                    value={channelForm.name}
                                    onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
                                    className="form-input"
                                />
                                <textarea
                                    placeholder="Channel Description"
                                    value={channelForm.description}
                                    onChange={(e) => setChannelForm({ ...channelForm, description: e.target.value })}
                                    className="form-textarea"
                                    rows="3"
                                />
                                <div className="form-actions">
                                    <Button onClick={handleUpdateChannel}>Save</Button>
                                    <Button variant="secondary" onClick={() => setShowChannelForm(false)}>
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="videos-section">
                <h2>Your Videos</h2>

                {error && <div className="error-message">{error}</div>}

                {videos.length === 0 ? (
                    <EmptyState
                        icon={<VideoEmptyIcon />}
                        title="No videos yet"
                        description="Upload your first video to get started!"
                        action={
                            <Button variant="primary" onClick={() => navigate({ to: '/upload' })}>
                                Upload Video
                            </Button>
                        }
                    />
                ) : (
                    <VideoCardGrid>
                        {videos.map(video => (
                            <VideoCard
                                key={video.id}
                                video={video}
                                variant="grid"
                                showFileSize={true}
                                showDescription={false}
                                onThumbnailUpload={
                                    <label
                                        htmlFor={`thumbnail-${video.id}`}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: '48px',
                                            height: '48px',
                                            background: 'rgba(255, 255, 255, 0.9)',
                                            borderRadius: '50%',
                                            cursor: 'pointer',
                                            color: '#333',
                                        }}
                                        title="Change thumbnail"
                                    >
                                        {uploadingThumbnail === video.id ? (
                                            <span style={{ fontSize: '14px' }}>...</span>
                                        ) : (
                                            <UploadIcon size={20} />
                                        )}
                                        <input
                                            id={`thumbnail-${video.id}`}
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleThumbnailChange(video.id, e)}
                                            style={{ display: 'none' }}
                                            disabled={uploadingThumbnail === video.id}
                                        />
                                    </label>
                                }
                                actions={
                                    <>
                                        <Button
                                            variant="primary"
                                            size="small"
                                            onClick={() => navigate({ to: `/video/${video.id}` })}
                                            icon={<EyeIcon size={16} />}
                                        >
                                            View
                                        </Button>
                                        <Button
                                            variant="danger"
                                            size="small"
                                            onClick={() => setDeleteConfirm(video.id)}
                                            icon={<DeleteIcon size={16} />}
                                        >
                                            Delete
                                        </Button>
                                    </>
                                }
                            />
                        ))}
                    </VideoCardGrid>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            {deleteConfirm && (
                <ConfirmDialog
                    isOpen={!!deleteConfirm}
                    onClose={() => setDeleteConfirm(null)}
                    onConfirm={handleDelete}
                    title="Delete Video"
                    message={`Are you sure you want to delete this video? This action cannot be undone.`}
                    confirmText="Delete"
                    variant="danger"
                />
            )}
        </div>
    );
};

