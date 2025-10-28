// Pages: Profile Page
// User profile with video management features
import { useState, useEffect } from 'react';
import { useAuth } from '../../shared/context/AuthContext';
import { videosAPI } from '../../shared/api/videos';
import { useNavigate } from '@tanstack/react-router';
import { ProfileVideoCard, ProfileVideoGrid, Avatar, Button, EmptyState, VideoEmptyIcon } from '../../shared/ui';
import './ProfilePage.css';

export const ProfilePage = () => {
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate({ to: '/login' });
            return;
        }
        loadUserVideos();
    }, [isAuthenticated, user]);

    const loadUserVideos = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await videosAPI.getVideos({ userId: user.id, limit: 100 });
            setVideos(data.videos);
        } catch (err) {
            console.error('Error loading videos:', err);
            setError('Failed to load videos');
        } finally {
            setLoading(false);
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

    const handleDelete = async (videoId) => {
        try {
            await videosAPI.deleteVideo(videoId);
            setVideos(videos.filter(v => v.id !== videoId));
        } catch (err) {
            console.error('Error deleting video:', err);
            alert('Failed to delete video');
        }
    };

    const handleThumbnailUpdate = async (videoId, file) => {
        try {
            const response = await videosAPI.updateVideoThumbnail(videoId, file);
            setVideos(videos.map(v =>
                v.id === videoId
                    ? { ...v, thumbnailUrl: response.video.thumbnailUrl }
                    : v
            ));
        } catch (err) {
            console.error('Error updating thumbnail:', err);
            throw err;
        }
    };

    const handleView = (video) => {
        navigate({ to: `/video/${video.id}` });
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
                    </div>
                </div>
                <div className="profile-stats">
                    <div className="stat">
                        <span className="stat-value">{videos.length}</span>
                        <span className="stat-label">Videos</span>
                    </div>
                </div>
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
                    <ProfileVideoGrid>
                        {videos.map(video => (
                            <ProfileVideoCard
                                key={video.id}
                                video={video}
                                onUpdate={handleUpdate}
                                onDelete={handleDelete}
                                onThumbnailUpdate={handleThumbnailUpdate}
                                onView={handleView}
                            />
                        ))}
                    </ProfileVideoGrid>
                )}
            </div>
        </div>
    );
};

