// Pages: Video Player Page
import { useState, useEffect } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { videosAPI } from '../../shared/api/videos';
import { useAuth } from '../../shared/context/AuthContext';
import { CommentsSection, VideoPlayer } from '../../shared/ui';
import './VideoPage.css';

export const VideoPage = () => {
    const { id } = useParams({ from: '/video/$id' });
    const { user } = useAuth();
    const [video, setVideo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchVideo = async () => {
            try {
                const data = await videosAPI.getVideo(id);
                setVideo(data);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching video:', err);
                setError('Video not found');
                setLoading(false);
            }
        };

        fetchVideo();
    }, [id]);

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this video?')) {
            return;
        }

        try {
            await videosAPI.deleteVideo(id);
            window.location.href = '/';
        } catch (err) {
            console.error('Error deleting video:', err);
            alert('Failed to delete video');
        }
    };

    const formatViews = (views) => {
        if (views >= 1000000) {
            return `${(views / 1000000).toFixed(1)}M`;
        }
        if (views >= 1000) {
            return `${(views / 1000).toFixed(1)}K`;
        }
        return views.toString();
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
            </div>
        );
    }

    if (error || !video) {
        return (
            <div className="error-container">
                <h2>Video not found</h2>
                <p>{error}</p>
                <Link to="/" className="btn btn-primary">
                    Back to Home
                </Link>
            </div>
        );
    }

    // Use playbackUrl from API response, fallback to constructing URL
    const videoUrl = video.playbackUrl || videosAPI.getVideoUrl(video.storageKey);
    const canDelete = user && user.id === video.userId;

    return (
        <div className="video-page">
            <div className="video-container">
                <div className="video-player-wrapper">
                    <VideoPlayer
                        src={videoUrl}
                        poster={video.thumbnailUrl}
                        title={video.title}
                        autoPlay={true}
                        primaryColor="#ff0000"
                        onTimeUpdate={(time) => {
                            // Update view count after 30 seconds
                            if (Math.floor(time) === 30) {
                                videosAPI.incrementViews(id).catch(console.error);
                            }
                        }}
                        onError={() => {
                            console.error('Error loading video');
                            setError('Failed to load video');
                        }}
                    />
                </div>

                <div className="video-details">
                    <h1 className="video-title">{video.title}</h1>

                    <div className="video-stats">
                        <div className="video-views">
                            {formatViews(video.views)} views • {formatDate(video.uploadedAt)}
                        </div>
                        {canDelete && (
                            <button onClick={handleDelete} className="btn-delete">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5zM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.5a.5.5 0 0 0 0 1h.75l.5 10.5A1.5 1.5 0 0 0 5.25 15h5.5a1.5 1.5 0 0 0 1.5-1.5L12.75 3.5h.75a.5.5 0 0 0 0-1H11z" />
                                </svg>
                                Delete
                            </button>
                        )}
                    </div>

                    {video.userId && (
                        <div className="video-channel">
                            <Link to={`/channel/${video.userId}`} className="channel-link">
                                View Channel
                            </Link>
                        </div>
                    )}

                    {video.description && (
                        <div className="video-description">
                            <p>{video.description}</p>
                        </div>
                    )}

                    <div className="video-metadata">
                        <div className="metadata-item">
                            <span className="metadata-label">File:</span>
                            <span className="metadata-value">{video.fileName}</span>
                        </div>
                        <div className="metadata-item">
                            <span className="metadata-label">Size:</span>
                            <span className="metadata-value">
                                {(video.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                            </span>
                        </div>
                        {video.width && video.height && (
                            <div className="metadata-item">
                                <span className="metadata-label">Resolution:</span>
                                <span className="metadata-value">
                                    {video.width} × {video.height}
                                </span>
                            </div>
                        )}
                        <div className="metadata-item">
                            <span className="metadata-label">Format:</span>
                            <span className="metadata-value">{video.mimeType}</span>
                        </div>
                    </div>

                    {/* Comments Section */}
                    <CommentsSection videoId={video.id} />
                </div>
            </div>
        </div>
    );
};
