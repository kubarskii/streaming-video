// Pages: Home Page with Infinite Scrolling
import { useState, useEffect, useCallback } from 'react';
import { Link } from '@tanstack/react-router';
import InfiniteScroll from 'react-infinite-scroll-component';
import { videosAPI } from '../../shared/api/videos';
import { VideoCard } from '../../entities/video/ui/VideoCard';
import './HomePage.css';

export const HomePage = () => {
    const [videos, setVideos] = useState([]);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const LIMIT = 20;

    const fetchVideos = useCallback(async () => {
        try {
            const data = await videosAPI.getVideos({ limit: LIMIT, offset });

            if (offset === 0) {
                setVideos(data.videos);
            } else {
                setVideos(prev => [...prev, ...data.videos]);
            }

            setHasMore(data.hasMore);
            setOffset(prev => prev + LIMIT);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching videos:', err);
            setError('Failed to load videos');
            setLoading(false);
        }
    }, [offset]);

    useEffect(() => {
        fetchVideos();
    }, []);

    const fetchMoreVideos = () => {
        if (!loading) {
            fetchVideos();
        }
    };

    if (loading && videos.length === 0) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
            </div>
        );
    }

    if (error && videos.length === 0) {
        return (
            <div className="error-container">
                <p>{error}</p>
                <button onClick={() => window.location.reload()} className="btn btn-primary">
                    Retry
                </button>
            </div>
        );
    }

    if (videos.length === 0) {
        return (
            <div className="empty-container">
                <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
                    <circle cx="60" cy="60" r="50" stroke="#e5e5e5" strokeWidth="4" />
                    <path d="M45 40l30 20-30 20V40z" fill="#e5e5e5" />
                </svg>
                <h2>No videos yet</h2>
                <p>Be the first to upload a video!</p>
                <Link to="/upload" className="btn btn-primary">
                    Upload Video
                </Link>
            </div>
        );
    }

    return (
        <div className="home-page">
            <InfiniteScroll
                dataLength={videos.length}
                next={fetchMoreVideos}
                hasMore={hasMore}
                loader={
                    <div className="loading-more">
                        <div className="spinner-small"></div>
                    </div>
                }
                endMessage={
                    <div className="end-message">
                        <p>You've seen all videos! 🎉</p>
                    </div>
                }
            >
                <div className="video-grid">
                    {videos.map((video) => (
                        <VideoCard key={video.id} video={video} />
                    ))}
                </div>
            </InfiniteScroll>
        </div>
    );
};
