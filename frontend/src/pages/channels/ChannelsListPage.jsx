// Pages: Channels List Page
// Browse all available channels
import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAbortController } from '../../shared/lib';
import { channelsAPI } from '../../shared/api/channels';
import { Avatar, Button, EmptyState, VideoEmptyIcon } from '../../shared/ui';
import './ChannelsListPage.css';

export const ChannelsListPage = () => {
    const navigate = useNavigate();
    const signal = useAbortController();
    const [channels, setChannels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState('subscriberCount');

    useEffect(() => {
        loadChannels();
    }, [sortBy, signal]);

    const loadChannels = async () => {
        try {
            setLoading(true);
            const data = await channelsAPI.listChannels({ sortBy, limit: 100, signal });
            setChannels(data.channels);
        } catch (err) {
            // Ignore abort errors
            if (err.name === 'AbortError' || err.name === 'CanceledError') {
                return;
            }
            console.error('Error loading channels:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleChannelClick = (channel) => {
        navigate({ to: `/channel/${channel.userId}` });
    };

    if (loading) {
        return (
            <div className="channels-list-page">
                <div className="loading">Loading channels...</div>
            </div>
        );
    }

    return (
        <div className="channels-list-page">
            <div className="page-header">
                <div>
                    <h1>Browse Channels</h1>
                    <p className="page-description">
                        Discover content creators on our platform
                    </p>
                </div>
                <div className="sort-options">
                    <label htmlFor="sort-select">Sort by:</label>
                    <select
                        id="sort-select"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="sort-select"
                    >
                        <option value="subscriberCount">Most Subscribers</option>
                        <option value="videoCount">Most Videos</option>
                        <option value="createdAt">Newest</option>
                    </select>
                </div>
            </div>

            {channels.length === 0 ? (
                <EmptyState
                    icon={<VideoEmptyIcon />}
                    title="No Channels Yet"
                    message="Be the first to create a channel!"
                />
            ) : (
                <div className="channels-grid">
                    {channels.map(channel => (
                        <div
                            key={channel.id}
                            className="channel-card"
                            onClick={() => handleChannelClick(channel)}
                        >
                            <Avatar
                                name={channel.name}
                                src={channel.avatarUrl}
                                size="xlarge"
                            />
                            <div className="channel-card-details">
                                <h3 className="channel-card-name">{channel.name}</h3>
                                <p className="channel-card-stats">
                                    {channel.subscriberCount} subscribers
                                </p>
                                {channel.description && (
                                    <p className="channel-card-description">
                                        {channel.description}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

