// Pages: Home Page with Infinite Scrolling
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearch } from '@tanstack/react-router';
import InfiniteScroll from 'react-infinite-scroll-component';
import { useTranslation } from 'react-i18next';
import { videosAPI } from '../../shared/api/videos';
import { useAbortController } from '../../shared/lib';
import { VideoCard, VideoCardGrid, VideoCardSkeleton, Spinner, EmptyState, VideoEmptyIcon, SearchEmptyIcon, Button } from '../../shared/ui';
import './HomePage.css';

export const HomePage = () => {
    const { t } = useTranslation();
    const searchParams = useSearch({ from: '/' });
    const searchQuery = searchParams?.q || '';
    const signal = useAbortController();
    
    // Use refs to store current values without triggering re-renders
    const offsetRef = useRef(0);
    const searchQueryRef = useRef(searchQuery);
    const containerRef = useRef(null);

    const [videos, setVideos] = useState([]);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
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
            setLoadingMore(false);
        } catch (err) {
            // Ignore abort errors
            if (err.name === 'AbortError' || err.name === 'CanceledError') {
                return;
            }
            console.error('Error fetching videos:', err);
            setError(t('home.failed_to_load'));
            setLoading(false);
            setLoadingMore(false);
        }
    }, [t]);

    useEffect(() => {
        setVideos([]);
        setOffset(0);
        offsetRef.current = 0;
        searchQueryRef.current = searchQuery;
        setLoading(true);
        setError(null);
        setHasMore(true);
        fetchVideos(0, searchQuery, signal);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery]); // Only re-fetch when searchQuery changes, not on every signal change

    const fetchMoreVideos = useCallback(() => {
        if (!loadingMore && !loading && hasMore) {
            const newOffset = offsetRef.current + LIMIT;
            offsetRef.current = newOffset;
            setOffset(newOffset);
            setLoadingMore(true);
            fetchVideos(newOffset, searchQueryRef.current);
        }
    }, [loadingMore, loading, hasMore, fetchVideos]);

    // Use Intersection Observer to auto-load more content on huge screens
    useEffect(() => {
        if (!containerRef.current || loading || videos.length === 0) {
            return;
        }

        const sentinel = containerRef.current.querySelector('.loading-more, .end-message');
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                // If the sentinel is visible and we have more content to load
                if (entry.isIntersecting && hasMore && !loading && !loadingMore) {
                    fetchMoreVideos();
                }
            },
            {
                root: null, // viewport
                rootMargin: '200px', // Start loading 200px before sentinel is visible
                threshold: 0.1
            }
        );

        observer.observe(sentinel);

        return () => {
            observer.disconnect();
        };
    }, [videos.length, loading, loadingMore, hasMore, fetchMoreVideos]);

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
                    title={t('home.failed_to_load')}
                    description={error}
                    action={
                        <Button variant="primary" onClick={() => window.location.reload()}>
                            {t('common.retry')}
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
                        title={t('home.no_search_results')}
                        description={t('home.no_search_results_description', { query: searchQuery })}
                    />
                ) : (
                    <EmptyState
                        icon={<VideoEmptyIcon />}
                        title={t('home.no_videos')}
                        description={t('home.no_videos_description')}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="home-page" ref={containerRef}>
            {searchQuery && (
                <div className="search-header">
                    <h2>{t('home.search_results', { query: searchQuery })}</h2>
                    <p className="results-count">
                        {videos.length === 1 
                            ? t('home.results_count', { count: videos.length })
                            : t('home.results_count_plural', { count: videos.length })}
                    </p>
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
                        <p>{searchQuery 
                            ? t('home.search_all_loaded', { query: searchQuery }) 
                            : t('home.all_videos_loaded')}</p>
                    </div>
                }
                scrollThreshold={0.9}
                style={{ overflow: 'visible' }}
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
