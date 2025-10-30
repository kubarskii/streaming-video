// Pages: Channel Page
// Public channel view with videos and subscription functionality
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useAuth } from '../../shared/context/AuthContext';
import { useAbortController } from '../../shared/lib';
import { channelsAPI } from '../../shared/api/channels';
import { subscriptionsAPI } from '../../shared/api/subscriptions';
import { videosAPI } from '../../shared/api/videos';
import { playlistsAPI } from '../../shared/api/playlists';
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
    const [activeTab, setActiveTab] = useState('videos');
    const [playlists, setPlaylists] = useState([]);
    const [playlistsLoading, setPlaylistsLoading] = useState(false);

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

            // Load playlists
            await loadPlaylists();

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

    const loadPlaylists = async () => {
        setPlaylistsLoading(true);
        try {
            const data = await playlistsAPI.getPlaylists({ userId, isPublic: true }, signal);
            const playlists = data.playlists || [];

            // Load full playlist data with videos for each playlist
            const playlistsWithVideos = await Promise.all(
                playlists.map(async (playlist) => {
                    try {
                        const fullPlaylist = await playlistsAPI.getPlaylist(playlist.id, signal);
                        return fullPlaylist.playlist || playlist;
                    } catch (err) {
                        // If we can't load full playlist, use the basic data
                        return playlist;
                    }
                })
            );

            setPlaylists(playlistsWithVideos);
        } catch (err) {
            if (err.name === 'AbortError' || err.name === 'CanceledError') {
                return;
            }
            console.error('Error loading playlists:', err);
        } finally {
            setPlaylistsLoading(false);
        }
    };

    const handleVideoClick = (video) => {
        navigate({ to: `/video/${video.id}` });
    };

    const handlePlaylistClick = (playlist) => {
        // Navigate to first video in playlist with playlistId in query params
        if (playlist.videos && playlist.videos.length > 0 && playlist.videos[0].video) {
            navigate({
                to: `/video/${playlist.videos[0].video.id}`,
                search: { playlistId: playlist.id }
            });
        }
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

            {/* Tabs and Content */}
            <div className="channel-content">
                <div className="channel-tabs">
                    <button
                        className={`channel-tab ${activeTab === 'videos' ? 'active' : ''}`}
                        onClick={() => setActiveTab('videos')}
                    >
                        Videos
                    </button>
                    <button
                        className={`channel-tab ${activeTab === 'playlists' ? 'active' : ''}`}
                        onClick={() => setActiveTab('playlists')}
                    >
                        Playlists
                    </button>
                </div>

                {activeTab === 'videos' && (
                    <div className="channel-tab-content">
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
                )}

                {activeTab === 'playlists' && (
                    <div className="channel-tab-content">
                        {playlistsLoading ? (
                            <div className="loading">Loading playlists...</div>
                        ) : playlists.length === 0 ? (
                            <EmptyState
                                icon={<VideoEmptyIcon />}
                                title="No Playlists Yet"
                                message="This channel hasn't created any public playlists yet"
                            />
                        ) : (
                            <div className="playlists-grid">
                                {playlists.map(playlist => (
                                    <div
                                        key={playlist.id}
                                        className="playlist-card-channel"
                                        onClick={() => handlePlaylistClick(playlist)}
                                    >
                                        {playlist.videos && playlist.videos.length > 0 && playlist.videos[0]?.video?.thumbnailUrl ? (
                                            <div className="playlist-thumbnail-grid">
                                                <img
                                                    src={playlist.videos[0].video.thumbnailUrl}
                                                    alt={playlist.title}
                                                    className="playlist-grid-thumbnail"
                                                />
                                                {playlist.videos.length > 1 && (
                                                    <>
                                                        {playlist.videos[1]?.video?.thumbnailUrl && (
                                                            <img
                                                                src={playlist.videos[1].video.thumbnailUrl}
                                                                alt=""
                                                                className="playlist-grid-thumbnail"
                                                            />
                                                        )}
                                                        {playlist.videos.length > 2 && playlist.videos[2]?.video?.thumbnailUrl && (
                                                            <img
                                                                src={playlist.videos[2].video.thumbnailUrl}
                                                                alt=""
                                                                className="playlist-grid-thumbnail"
                                                            />
                                                        )}
                                                        {playlist.videos.length > 3 && playlist.videos[3]?.video?.thumbnailUrl && (
                                                            <img
                                                                src={playlist.videos[3].video.thumbnailUrl}
                                                                alt=""
                                                                className="playlist-grid-thumbnail"
                                                            />
                                                        )}
                                                    </>
                                                )}
                                                {playlist.videos.length > 4 && (
                                                    <div className="playlist-thumbnail-overlay">
                                                        <span>+{playlist.videos.length - 4}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="playlist-thumbnail-placeholder">
                                                <VideoEmptyIcon />
                                            </div>
                                        )}
                                        <div className="playlist-card-info">
                                            <h3 className="playlist-card-title">{playlist.title}</h3>
                                            <p className="playlist-card-meta">
                                                {playlist.videos?.length || 0} videos
                                                {playlist.description && ` • ${playlist.description.substring(0, 50)}${playlist.description.length > 50 ? '...' : ''}`}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

