// Pages: Home Page with Infinite Scrolling
import { useState, useEffect, useCallback } from 'react';
import { Link, useSearch } from '@tanstack/react-router';
import InfiniteScroll from 'react-infinite-scroll-component';
import { videosAPI } from '../../shared/api/videos';
import { useAbortController } from '../../shared/lib';
import { VideoCard, VideoCardGrid, VideoCardSkeleton, Spinner, EmptyState, VideoEmptyIcon, SearchEmptyIcon, Button } from '../../shared/ui';
import './HomePage.css';

export const HomePage = () => {
    const searchParams = useSearch({ from: '/' });
    const searchQuery = searchParams?.q || '';
    const signal = useAbortController();

    const [videos, setVideos] = useState([]);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const LIMIT = 20;

    const fetchVideos = useCallback(async (currentOffset = 0, currentSearch = '', abortSignal) => {
        try {
            const data = await videosAPI.getVideos({
                limit: LIMIT,
                offset: currentOffset,
                search: currentSearch || undefined,
                signal: abortSignal
            });

            if (currentOffset === 0) {
                setVideos(data.videos);
            } else {
                setVideos(prev => [...prev, ...data.videos]);
            }

            setHasMore(data.hasMore);
            setLoading(false);
        } catch (err) {
            // Ignore abort errors
            if (err.name === 'AbortError' || err.name === 'CanceledError') {
                return;
            }
            console.error('Error fetching videos:', err);
            setError('Failed to load videos');
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        setVideos([]);
        setOffset(0);
        setLoading(true);
        setError(null);
        setHasMore(true);
        fetchVideos(0, searchQuery, signal);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery]); // Only re-fetch when searchQuery changes, not on every signal change

    const fetchMoreVideos = () => {
        if (!loading) {
            const newOffset = offset + LIMIT;
            setOffset(newOffset);
            fetchVideos(newOffset, searchQuery, signal);
        }
    };

    if (loading && videos.length === 0) {
        return (
            <div className="home-page">
                <VideoCardGrid>
                    {Array.from({ length: 12 }).map((_, index) => (
                        <VideoCardSkeleton key={index} />
                    ))}
                </VideoCardGrid>
            </div>
        );
    }

    if (error && videos.length === 0) {
        return (
            <div className="error-container">
                <EmptyState
                    icon={<VideoEmptyIcon />}
                    title="Failed to load videos"
                    description={error}
                    action={
                        <Button variant="primary" onClick={() => window.location.reload()}>
                            Retry
                        </Button>
                    }
                />
            </div>
        );
    }

    if (videos.length === 0) {
        return (
            <div className="empty-container">
                {searchQuery ? (
                    <EmptyState
                        icon={<SearchEmptyIcon />}
                        title="No videos found"
                        description={`No videos match "${searchQuery}"`}
                    />
                ) : (
                    <EmptyState
                        icon={<VideoEmptyIcon />}
                        title="No videos yet"
                        description="Check back soon for new content!"
                    />
                )}
            </div>
        );
    }

    return (
        <div className="home-page">
            {searchQuery && (
                <div className="search-header">
                    <h2>Search results for "{searchQuery}"</h2>
                    <p className="results-count">{videos.length} video{videos.length !== 1 ? 's' : ''} found</p>
                </div>
            )}
            <InfiniteScroll
                dataLength={videos.length}
                next={fetchMoreVideos}
                hasMore={hasMore}
                loader={
                    <div className="loading-more">
                        <Spinner size="medium" center />
                    </div>
                }
                endMessage={
                    <div className="end-message">
                        <p>{searchQuery ? `That's all we found for "${searchQuery}"` : "You've seen all videos! 🎉"}</p>
                    </div>
                }
            >
                <VideoCardGrid columns="auto">
                    {videos.map((video) => (
                        <VideoCard key={video.id} video={video} showUser />
                    ))}
                </VideoCardGrid>
            </InfiniteScroll>
        </div>
    );
};
