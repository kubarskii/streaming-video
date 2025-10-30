// Pages: Video Player Page
import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { videosAPI } from '../../shared/api/videos';
import { useAbortController } from '../../shared/lib';
import { useAuth } from '../../shared/context/AuthContext';
import { CommentsSection, VideoPlayer } from '../../shared/ui';
import './VideoPage.css';

export const VideoPage = () => {
    const { id } = useParams({ from: '/video/$id' });
    const { user } = useAuth();
    const signal = useAbortController();
    const [video, setVideo] = useState(null);
    const [qualities, setQualities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentVideoUrl, setCurrentVideoUrl] = useState(null);
    const [likeStats, setLikeStats] = useState({ likes: 0, dislikes: 0, userLike: null });
    const [likingInProgress, setLikingInProgress] = useState(false);
    const ambientCanvasRef = useRef(null);

    // Update ambient canvas with video frame
    const updateAmbientLight = (videoElement) => {
        const canvas = ambientCanvasRef.current;
        if (!canvas || !videoElement) return;

        const ctx = canvas.getContext('2d', {
            alpha: false,
            willReadFrequently: false
        });

        const aspectRatio = videoElement.videoWidth / videoElement.videoHeight || 16 / 9;

        // Only resize if dimensions changed
        const newWidth = 1280;
        const newHeight = newWidth / aspectRatio;

        if (canvas.width !== newWidth || canvas.height !== newHeight) {
            canvas.width = newWidth;
            canvas.height = newHeight;
        }

        try {
            // Use smooth rendering
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        } catch (err) {
            // CORS error - silent fail
        }
    };

    useEffect(() => {
        const fetchVideo = async () => {
            try {
                const data = await videosAPI.getVideo(id, signal);
                setVideo(data);

                // Set default video URL
                const defaultUrl = data.playbackUrl || videosAPI.getVideoUrl(data.storageKey);
                setCurrentVideoUrl(defaultUrl);

                // Fetch available quality variants
                try {
                    const qualitiesData = await videosAPI.getVideoQualities(id, signal);
                    console.log('Qualities data received:', qualitiesData);

                    if (qualitiesData.qualities && qualitiesData.qualities.length > 0) {
                        setQualities(qualitiesData.qualities);

                        // Set highest quality as default if available
                        const highestQuality = qualitiesData.qualities[qualitiesData.qualities.length - 1];
                        if (highestQuality && highestQuality.playbackUrl) {
                            setCurrentVideoUrl(highestQuality.playbackUrl);
                        }
                    } else {
                        setQualities([]);
                    }
                } catch (qualErr) {
                    // Ignore abort errors
                    if (qualErr.name !== 'AbortError' && qualErr.name !== 'CanceledError') {
                        console.log('No quality variants available:', qualErr);
                    }
                    setQualities([]);
                }

                // Fetch like statistics
                try {
                    const stats = await videosAPI.getLikeStats(id, signal);
                    setLikeStats(stats);
                } catch (statsErr) {
                    // Ignore abort errors
                    if (statsErr.name !== 'AbortError' && statsErr.name !== 'CanceledError') {
                        console.log('Error fetching like stats:', statsErr);
                    }
                }

                setLoading(false);
            } catch (err) {
                // Ignore abort errors
                if (err.name === 'AbortError' || err.name === 'CanceledError') {
                    return;
                }
                console.error('Error fetching video:', err);
                setError('Video not found');
                setLoading(false);
            }
        };

        fetchVideo();
    }, [id, signal]);

    const handleQualityChange = (quality) => {
        console.log('Quality changed to:', quality);
        if (quality && quality.playbackUrl) {
            setCurrentVideoUrl(quality.playbackUrl);
        }
    };

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

    const handleLike = async () => {
        if (!user) {
            alert('Please log in to like videos');
            return;
        }

        if (likingInProgress) return;

        try {
            setLikingInProgress(true);
            const result = await videosAPI.likeVideo(id, true);
            setLikeStats(result.stats);
        } catch (err) {
            console.error('Error liking video:', err);
            alert('Failed to like video');
        } finally {
            setLikingInProgress(false);
        }
    };

    const handleDislike = async () => {
        if (!user) {
            alert('Please log in to dislike videos');
            return;
        }

        if (likingInProgress) return;

        try {
            setLikingInProgress(true);
            const result = await videosAPI.likeVideo(id, false);
            setLikeStats(result.stats);
        } catch (err) {
            console.error('Error disliking video:', err);
            alert('Failed to dislike video');
        } finally {
            setLikingInProgress(false);
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

    const canDelete = user && user.id === video.userId;

    return (
        <div className="video-page">
            <div className="video-container">
                <div className="video-player-substrate">
                    <div className="video-player-wrapper">
                        <canvas ref={ambientCanvasRef} className="ambient-canvas" />
                        <VideoPlayer
                            src={currentVideoUrl}
                            poster={video.thumbnailUrl}
                            title={video.title}
                            autoPlay={true}
                            primaryColor="#ff0000"
                            qualities={qualities}
                            onQualityChange={handleQualityChange}
                            mimeType={video.mimeType}
                            onAmbientUpdate={updateAmbientLight}
                            onTimeUpdate={(time) => {
                                // Update view count after 30 seconds
                                if (Math.floor(time) === 30) {
                                    videosAPI.incrementViews(id, signal).catch(console.error);
                                }
                            }}
                            onError={() => {
                                console.error('Error loading video');
                                setError('Failed to load video');
                            }}
                        />
                    </div>
                </div>

                <div className="video-details">
                    <h1 className="video-title">{video.title}</h1>

                    <div className="video-stats">
                        <div className="video-views">
                            {formatViews(video.views)} views • {formatDate(video.uploadedAt)}
                        </div>
                        <div className="video-actions">
                            {/* Like/Dislike buttons with separator */}
                            <div className="like-dislike-group">
                                <button
                                    onClick={handleLike}
                                    disabled={likingInProgress}
                                    className={`btn-like ${likeStats.userLike === true ? 'active' : ''}`}
                                    aria-label="Like this video"
                                    title={`${likeStats.likes} likes`}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill={likeStats.userLike === true ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                                    </svg>
                                    <span>{likeStats.likes}</span>
                                </button>
                                <div className="like-dislike-separator"></div>
                                <button
                                    onClick={handleDislike}
                                    disabled={likingInProgress}
                                    className={`btn-dislike ${likeStats.userLike === false ? 'active' : ''}`}
                                    aria-label="Dislike this video"
                                    title="Dislike"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill={likeStats.userLike === false ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(180deg)' }}>
                                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                                    </svg>
                                </button>
                            </div>

                            <button
                                onClick={() => {
                                    if (navigator.share) {
                                        navigator.share({
                                            title: video.title,
                                            url: window.location.href
                                        }).catch(() => { });
                                    } else {
                                        navigator.clipboard.writeText(window.location.href);
                                        alert('Link copied to clipboard!');
                                    }
                                }}
                                className="btn-share"
                                aria-label="Share this video"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                    <polyline points="16 6 12 2 8 6" />
                                    <line x1="12" y1="2" x2="12" y2="15" />
                                </svg>
                                <span>Share</span>
                            </button>

                            {canDelete && (
                                <button onClick={handleDelete} className="btn-delete">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                    <span>Delete</span>
                                </button>
                            )}
                        </div>
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

                    {/* Comments Section */}
                    <CommentsSection videoId={video.id} />
                </div>
            </div>
        </div>
    );
};
