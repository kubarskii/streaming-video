// Channel Videos Page - Only loads videos
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useAbortController } from '../../shared/lib';
import { videosAPI } from '../../shared/api/videos';
import { EmptyState, VideoCard, VideoEmptyIcon, VideoCardSkeleton } from '../../shared/ui';

export const ChannelVideosPage = () => {
    const { userId } = useParams({ from: '/channel/$userId' });
    const navigate = useNavigate();
    const signal = useAbortController();
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadVideos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    const loadVideos = async () => {
        try {
            setLoading(true);
            const videosData = await videosAPI.getVideos({ userId, limit: 100, signal });
            setVideos(videosData.videos);
        } catch (err) {
            // Ignore abort errors
            if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
                console.error('Error loading videos:', err);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVideoClick = (video) => {
        navigate({ to: `/video/${video.id}` });
    };

    return (
        <div className="channel-tab-content">
            {loading ? (
                <div className="videos-grid">
                    {Array.from({ length: 8 }).map((_, index) => (
                        <VideoCardSkeleton key={index} />
                    ))}
                </div>
            ) : videos.length === 0 ? (
                <EmptyState
                    icon={<VideoEmptyIcon />}
                    title="No Videos Yet"
                    message="This channel hasn't uploaded any videos yet"
                />
            ) : (
                <div className="videos-grid">
                    {videos.map(video => (
                        <VideoCard
                            key={video.id}
                            video={video}
                            onClick={() => handleVideoClick(video)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

