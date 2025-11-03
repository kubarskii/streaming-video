// Channel Layout - Shared navigation for channel pages
import { Outlet, Link, useParams, useNavigate } from '@tanstack/react-router';
import { useAuth } from '../../shared/context/AuthContext';
import { useAbortController } from '../../shared/lib';
import { channelsAPI } from '../../shared/api/channels';
import { subscriptionsAPI } from '../../shared/api/subscriptions';
import { Avatar, Button, EmptyState, VideoEmptyIcon, ChannelHeaderSkeleton } from '../../shared/ui';
import { useState, useEffect } from 'react';
import './ChannelPage.css';

export const ChannelLayout = () => {
    const { userId } = useParams({ from: '/channel/$userId' });
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    const signal = useAbortController();
    const [channel, setChannel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [subscribing, setSubscribing] = useState(false);

    const isOwnChannel = isAuthenticated && user?.id === userId;

    useEffect(() => {
        loadChannelInfo();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    const loadChannelInfo = async () => {
        try {
            setLoading(true);
            setError(null);

            // Load channel info
            const channelData = await channelsAPI.getChannel({ userId, signal });
            setChannel(channelData);

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

    if (loading) {
        return (
            <div className="channel-page">
                <ChannelHeaderSkeleton />
                <div className="channel-content">
                    <div className="channel-tabs">
                        <div className="channel-tab active">Videos</div>
                        <div className="channel-tab">Playlists</div>
                    </div>
                </div>
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
                            <span>{channel.subscriberCount || 0} subscribers</span>
                            {channel.videoCount !== undefined && (
                                <>
                                    <span className="stat-separator">•</span>
                                    <span>{channel.videoCount} videos</span>
                                </>
                            )}
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

            {/* Tabs Navigation */}
            <div className="channel-content">
                <div className="channel-tabs">
                    <Link
                        to="/channel/$userId"
                        params={{ userId }}
                        className="channel-tab"
                        activeOptions={{ exact: true }}
                        activeProps={{ className: 'channel-tab active' }}
                    >
                        Videos
                    </Link>
                    <Link
                        to="/channel/$userId/playlists"
                        params={{ userId }}
                        className="channel-tab"
                        activeOptions={{ exact: false }}
                        activeProps={{ className: 'channel-tab active' }}
                    >
                        Playlists
                    </Link>
                </div>

                {/* Tab Content */}
                <Outlet />
            </div>
        </div>
    );
};

