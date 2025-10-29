// Pages: Channel Page
// Public channel view with videos and subscription functionality
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useAuth } from '../../shared/context/AuthContext';
import { useAbortController } from '../../shared/lib';
import { channelsAPI } from '../../shared/api/channels';
import { subscriptionsAPI } from '../../shared/api/subscriptions';
import { videosAPI } from '../../shared/api/videos';
import { Avatar, Button, EmptyState, VideoCard, VideoEmptyIcon } from '../../shared/ui';
import './ChannelPage.css';

export const ChannelPage = () => {
    const { userId } = useParams({ from: '/channel/$userId' });
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    const signal = useAbortController();
    const [channel, setChannel] = useState(null);
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [subscribing, setSubscribing] = useState(false);

    const isOwnChannel = isAuthenticated && user?.id === userId;

    useEffect(() => {
        loadChannelData();
    }, [userId, signal]);

    const loadChannelData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Load channel info
            const channelData = await channelsAPI.getChannel({ userId, signal });
            setChannel(channelData);

            // Load videos
            const videosData = await videosAPI.getVideos({ userId, limit: 100, signal });
            setVideos(videosData.videos);

            // Check subscription status if authenticated
            if (isAuthenticated && !isOwnChannel) {
                try {
                    const statusData = await subscriptionsAPI.checkStatus(channelData.id, signal);
                    setIsSubscribed(statusData.isSubscribed);
                } catch (err) {
                    // Ignore abort errors
                    if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
                        console.error('Error checking subscription:', err);
                    }
                }
            }
        } catch (err) {
            // Ignore abort errors
            if (err.name === 'AbortError' || err.name === 'CanceledError') {
                return;
            }
            console.error('Error loading channel:', err);
            setError('Channel not found or failed to load');
        } finally {
            setLoading(false);
        }
    };

    const handleSubscribe = async () => {
        if (!isAuthenticated) {
            navigate({ to: '/login' });
            return;
        }

        try {
            setSubscribing(true);
            if (isSubscribed) {
                await subscriptionsAPI.unsubscribe(channel.id);
                setIsSubscribed(false);
                setChannel({ ...channel, subscriberCount: channel.subscriberCount - 1 });
            } else {
                await subscriptionsAPI.subscribe(channel.id);
                setIsSubscribed(true);
                setChannel({ ...channel, subscriberCount: channel.subscriberCount + 1 });
            }
        } catch (err) {
            console.error('Error toggling subscription:', err);
            alert('Failed to update subscription');
        } finally {
            setSubscribing(false);
        }
    };

    const handleVideoClick = (video) => {
        navigate({ to: `/video/${video.id}` });
    };

    if (loading) {
        return (
            <div className="channel-page">
                <div className="loading">Loading channel...</div>
            </div>
        );
    }

    if (error || !channel) {
        return (
            <div className="channel-page">
                <EmptyState
                    icon={<VideoEmptyIcon />}
                    title="Channel Not Found"
                    message={error || "This channel doesn't exist or hasn't been created yet"}
                />
            </div>
        );
    }

    return (
        <div className="channel-page">
            {/* Channel Banner */}
            {channel.bannerUrl && (
                <div className="channel-banner">
                    <img src={channel.bannerUrl} alt={channel.name} />
                </div>
            )}

            {/* Channel Header */}
            <div className="channel-header">
                <div className="channel-info">
                    <Avatar
                        name={channel.name}
                        src={channel.avatarUrl}
                        size="xlarge"
                    />
                    <div className="channel-details">
                        <h1 className="channel-name">{channel.name}</h1>
                        {channel.description && (
                            <p className="channel-description">{channel.description}</p>
                        )}
                        <div className="channel-stats">
                            <span>{channel.subscriberCount} subscribers</span>
                            <span className="stat-separator">•</span>
                            <span>{videos.length} videos</span>
                        </div>
                    </div>
                </div>

                {/* Subscribe Button */}
                {!isOwnChannel && isAuthenticated && (
                    <Button
                        variant={isSubscribed ? 'secondary' : 'primary'}
                        onClick={handleSubscribe}
                        disabled={subscribing}
                    >
                        {subscribing ? 'Loading...' : isSubscribed ? 'Subscribed' : 'Subscribe'}
                    </Button>
                )}

                {isOwnChannel && (
                    <Button
                        variant="secondary"
                        onClick={() => navigate({ to: '/profile' })}
                    >
                        Manage Channel
                    </Button>
                )}
            </div>

            {/* Videos Grid */}
            <div className="channel-content">
                <h2 className="section-title">Videos</h2>
                {videos.length === 0 ? (
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
        </div>
    );
};

