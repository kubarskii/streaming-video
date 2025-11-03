// Pages: Subscriptions Page
// View and manage channel subscriptions
import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '../../shared/context/AuthContext';
import { useAbortController } from '../../shared/lib';
import { subscriptionsAPI } from '../../shared/api/subscriptions';
import { channelsAPI } from '../../shared/api/channels';
import { Avatar, Button, EmptyState, VideoEmptyIcon, ChannelCardSkeleton } from '../../shared/ui';
import './SubscriptionsPage.css';

export const SubscriptionsPage = () => {
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const signal = useAbortController();
    const [subscriptions, setSubscriptions] = useState([]);
    const [channels, setChannels] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate({ to: '/login' });
            return;
        }
        loadSubscriptions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated]);

    const loadSubscriptions = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await subscriptionsAPI.getSubscriptions({ limit: 100, signal });
            setSubscriptions(data.subscriptions);

            // Load channel details for each subscription
            const channelPromises = data.subscriptions.map(sub =>
                channelsAPI.getChannel({ channelId: sub.channelId, signal })
                    .catch(err => {
                        // Ignore abort errors
                        if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
                            console.error(`Error loading channel ${sub.channelId}:`, err);
                        }
                        return null;
                    })
            );
            const channelData = await Promise.all(channelPromises);

            const channelsMap = {};
            channelData.forEach(channel => {
                if (channel) {
                    channelsMap[channel.id] = channel;
                }
            });
            setChannels(channelsMap);
        } catch (err) {
            // Ignore abort errors
            if (err.name === 'AbortError' || err.name === 'CanceledError') {
                return;
            }
            console.error('Error loading subscriptions:', err);
            setError('Failed to load subscriptions');
        } finally {
            setLoading(false);
        }
    };

    const handleUnsubscribe = async (channelId) => {
        try {
            await subscriptionsAPI.unsubscribe(channelId);
            setSubscriptions(subscriptions.filter(sub => sub.channelId !== channelId));
        } catch (err) {
            console.error('Error unsubscribing:', err);
            alert('Failed to unsubscribe');
        }
    };

    const handleChannelClick = (channel) => {
        navigate({ to: `/channel/${channel.userId}` });
    };

    if (loading) {
        return (
            <div className="subscriptions-page">
                <div className="page-header">
                    <h1>Your Subscriptions</h1>
                    <p className="page-description">
                        Channels you're subscribed to
                    </p>
                </div>
                <div className="channels-grid">
                    {Array.from({ length: 8 }).map((_, index) => (
                        <ChannelCardSkeleton key={index} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="subscriptions-page">
            <div className="page-header">
                <h1>Your Subscriptions</h1>
                <p className="page-description">
                    Channels you're subscribed to
                </p>
            </div>

            {subscriptions.length === 0 ? (
                <EmptyState
                    icon={<VideoEmptyIcon />}
                    title="No Subscriptions Yet"
                    message="Subscribe to channels to see them here"
                    action={
                        <Button onClick={() => navigate({ to: '/channels' })}>
                            Browse Channels
                        </Button>
                    }
                />
            ) : (
                <div className="subscriptions-grid">
                    {subscriptions.map(subscription => {
                        const channel = channels[subscription.channelId];
                        if (!channel) return null;

                        return (
                            <div key={subscription.id} className="subscription-card">
                                <div
                                    className="subscription-info"
                                    onClick={() => handleChannelClick(channel)}
                                >
                                    <Avatar
                                        name={channel.name}
                                        src={channel.avatarUrl}
                                        size="large"
                                    />
                                    <div className="subscription-details">
                                        <h3 className="subscription-name">{channel.name}</h3>
                                        <p className="subscription-stats">
                                            {channel.subscriberCount} subscribers • {channel.videoCount} videos
                                        </p>
                                        {channel.description && (
                                            <p className="subscription-description">
                                                {channel.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <Button
                                    variant="secondary"
                                    size="small"
                                    onClick={() => handleUnsubscribe(channel.id)}
                                >
                                    Unsubscribe
                                </Button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

