// Pages: Video Player Page
import { useState, useEffect, useRef, startTransition } from 'react';
import { useParams, Link, useNavigate, useSearch } from '@tanstack/react-router';
import { videosAPI } from '../../shared/api/videos';
import { playlistsAPI } from '../../shared/api/playlists';
import { useAbortController } from '../../shared/lib';
import { useAuth } from '../../shared/context/AuthContext';
import { CommentsSection, VideoPlayer } from '../../shared/ui';
import { formatDuration } from '../../shared/lib';
import { MobilePlaylistSheet } from './components/MobilePlaylistSheet';
import { VideoPageSkeleton } from './components/VideoPageSkeleton';
import './VideoPage.css';

export const VideoPage = () => {
    const { id } = useParams({ from: '/video/$id' });
    const search = useSearch({ from: '/video/$id', strict: false });
    const navigate = useNavigate();
    const { user } = useAuth();
    const signal = useAbortController();
    const [video, setVideo] = useState(null);
    const [channelInfo, setChannelInfo] = useState(null);
    const [qualities, setQualities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentVideoUrl, setCurrentVideoUrl] = useState(null);
    const [likeStats, setLikeStats] = useState({ likes: 0, dislikes: 0, userLike: null });
    const [likingInProgress, setLikingInProgress] = useState(false);
    const ambientCanvasRef = useRef(null);
    const videoPlayerRef = useRef(null);
    const [playlist, setPlaylist] = useState([]);
    const [playlistLoading, setPlaylistLoading] = useState(false);
    const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0);
    const [nextVideoCountdown, setNextVideoCountdown] = useState(null);
    const [currentPlaylistId, setCurrentPlaylistId] = useState(null);
    const countdownIntervalRef = useRef(null);
    const [isPlaylistBottomSheetOpen, setIsPlaylistBottomSheetOpen] = useState(false);
    const isSeamlessNavigationRef = useRef(false);
    const seamlessResetTimeoutRef = useRef(null);

    // Get playlistId from URL search params
    const playlistIdFromUrl = search?.playlistId || null;

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
        // Skip normal video loading during seamless navigation
        if (isSeamlessNavigationRef.current) {
            return;
        }

        // Only show loading if we don't have a video yet (initial load)
        // For silent updates (when navigating between playlist videos), keep existing state
        const isInitialLoad = !video || String(video.id) !== String(id);

        const fetchVideo = async () => {
            try {
                if (isInitialLoad) {
                    setLoading(true);
                    setError(null);
                }

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

                // Fetch channel info if available
                if (data.userId) {
                    try {
                        const { channelsAPI } = await import('../../shared/api/channels');
                        const channelData = await channelsAPI.getChannel({ userId: data.userId }, signal);
                        setChannelInfo(channelData);
                    } catch (channelErr) {
                        // Channel might not exist, ignore
                        if (channelErr.name !== 'AbortError' && channelErr.name !== 'CanceledError') {
                            console.debug('Could not load channel info:', channelErr);
                        }
                    }
                }

                if (isInitialLoad) {
                    setLoading(false);
                }
            } catch (err) {
                // Ignore abort errors
                if (err.name === 'AbortError' || err.name === 'CanceledError') {
                    return;
                }
                console.error('Error fetching video:', err);
                setError('Video not found');
                if (isInitialLoad) {
                    setLoading(false);
                }
            }
        };

        fetchVideo();
    }, [id, signal]);

    useEffect(() => {
        if (!video) {
            return;
        }

        // Skip playlist reload during seamless navigation
        if (isSeamlessNavigationRef.current) {
            // Don't reset flag here - let loadVideoData reset it after all updates complete
            return;
        }

        const loadPlaylist = async () => {
            // Reset playlist when video changes to ensure fresh load
            // This is important for maintaining the linked list order
            // Don't show loading during seamless navigation
            if (!isSeamlessNavigationRef.current) {
                setPlaylistLoading(true);
            }

            const createPlaylistItem = (item) => ({
                id: item.id,
                title: item.title,
                thumbnailUrl: item.thumbnailUrl,
                playbackUrl: item.playbackUrl || (item.storageKey ? videosAPI.getVideoUrl(item.storageKey) : null),
                durationMs: item.durationMs,
                views: item.views,
                uploadedAt: item.uploadedAt,
                position: item.position || 0, // Preserve position if available
            });

            try {
                // Priority 1: If playlistId is in URL params, load that specific playlist
                if (playlistIdFromUrl) {
                    try {
                        const response = await playlistsAPI.getPlaylist(playlistIdFromUrl, signal);
                        // Backend returns playlist directly (not wrapped), but handle both cases
                        const fullPlaylist = response.playlist || response;

                        console.debug('Loaded playlist from URL:', {
                            playlistId: playlistIdFromUrl,
                            videoCount: fullPlaylist?.videos?.length,
                            videos: fullPlaylist?.videos,
                            hasPlaylistWrapper: !!response.playlist
                        });

                        if (fullPlaylist.videos && fullPlaylist.videos.length > 0) {
                            // Backend returns videos, ensure they're sorted by position (database order)
                            // Sort by position to guarantee database order
                            const sortedVideos = [...fullPlaylist.videos].sort((a, b) => {
                                const posA = a.position || 0;
                                const posB = b.position || 0;
                                return posA - posB;
                            });

                            console.debug('Sorted videos:', sortedVideos.length, sortedVideos.map(v => ({
                                videoId: v.videoId,
                                position: v.position,
                                hasVideo: !!v.video,
                                videoIdInVideo: v.video?.id
                            })));

                            // Map all videos including current one - maintain exact database order
                            const playlistItems = sortedVideos
                                .map((pv, index) => {
                                    // Use video from playlist item, fallback to current video if available
                                    const v = pv.video || (pv.videoId === video?.id ? video : null);

                                    // If video data is missing or incomplete, use placeholder
                                    if (!v || !v.id) {
                                        // Ensure we have at least a videoId from the playlist item
                                        const videoId = pv.videoId || (v?.id ? v.id : null);
                                        if (!videoId) {
                                            console.warn(`Playlist item at index ${index} has no videoId:`, pv);
                                            return null;
                                        }
                                        // Return a placeholder that can be displayed
                                        return {
                                            id: videoId,
                                            title: v?.title || 'Loading...',
                                            thumbnailUrl: v?.thumbnailUrl || null,
                                            playbackUrl: v?.playbackUrl || (v?.storageKey ? videosAPI.getVideoUrl(v.storageKey) : null),
                                            durationMs: v?.durationMs || null,
                                            views: v?.views || 0,
                                            uploadedAt: v?.uploadedAt || null,
                                            position: pv.position || 0,
                                        };
                                    }

                                    const item = createPlaylistItem(v);
                                    // Preserve position from database for linked list order
                                    item.position = pv.position || 0;
                                    return item;
                                })
                                .filter(item => item !== null && item.id); // Filter out null items only

                            console.debug('Mapped playlist items:', playlistItems.length, playlistItems.map(item => ({
                                id: item.id,
                                title: item.title,
                                position: item.position
                            })));

                            if (playlistItems.length > 0) {
                                setPlaylist(playlistItems);
                                setCurrentPlaylistId(playlistIdFromUrl);
                                setPlaylistLoading(false);
                                return;
                            }
                        } else {
                            console.warn('Playlist has no videos or empty:', {
                                hasPlaylist: !!fullPlaylist,
                                videosLength: fullPlaylist?.videos?.length,
                                playlistData: fullPlaylist
                            });
                        }
                    } catch (err) {
                        if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
                            console.error('Error loading playlist from URL:', err);
                        }
                    }
                }

                // Priority 2: Try to find a playlist that contains this video
                let playlistData = null;

                // Try to get user's playlists and find one containing this video
                if (video.userId) {
                    try {
                        const playlistsResponse = await playlistsAPI.getPlaylists({ userId: video.userId }, signal);
                        const playlists = playlistsResponse.playlists || [];

                        // Find the first playlist that contains this video
                        for (const pl of playlists) {
                            try {
                                const response = await playlistsAPI.getPlaylist(pl.id, signal);
                                // Backend returns playlist directly (not wrapped), but handle both cases
                                const fullPlaylist = response.playlist || response;
                                if (fullPlaylist.videos?.some(v => String(v.video?.id || v.videoId) === String(video.id))) {
                                    playlistData = fullPlaylist;
                                    setCurrentPlaylistId(pl.id);
                                    break;
                                }
                            } catch (err) {
                                // Continue searching
                            }
                        }
                    } catch (err) {
                        // If we can't load playlists, fall back to default behavior
                        console.debug('Could not load playlists:', err);
                    }
                }

                // If we found a playlist, use it
                if (playlistData && playlistData.videos && playlistData.videos.length > 0) {
                    // Backend returns videos, ensure they're sorted by position (database order)
                    // Sort by position to guarantee database order
                    const sortedVideos = [...playlistData.videos].sort((a, b) => {
                        const posA = a.position || 0;
                        const posB = b.position || 0;
                        return posA - posB;
                    });

                    // Map all videos including current one - maintain exact database order
                    const playlistItems = sortedVideos
                        .map(pv => {
                            // Use video from playlist item, fallback to current video if available
                            const v = pv.video || (pv.videoId === video?.id ? video : null);
                            if (!v || !v.id) {
                                // If video data is missing, return a placeholder with at least videoId
                                return {
                                    id: pv.videoId || null,
                                    title: 'Loading...',
                                    thumbnailUrl: null,
                                    playbackUrl: null,
                                    durationMs: null,
                                    views: 0,
                                    uploadedAt: null,
                                    position: pv.position || 0, // Preserve position from database
                                };
                            }
                            const item = createPlaylistItem(v);
                            // Preserve position from database for linked list order
                            item.position = pv.position || 0;
                            return item;
                        })
                        .filter(item => item && item.id); // Only filter out completely invalid items

                    if (playlistItems.length > 0) {
                        setPlaylist(playlistItems);
                        setPlaylistLoading(false);
                        return;
                    }
                }

                // Fallback: show related videos from same channel (YouTube-like behavior)
                // Only show fallback if no playlistId was specified in URL
                if (!playlistIdFromUrl) {
                    const params = { limit: 20, signal };
                    if (video.userId) {
                        params.userId = video.userId;
                    }

                    const data = await videosAPI.getVideos(params);
                    const videos = data?.videos || [];

                    const seen = new Set();
                    const playlistItems = [];

                    const addItem = (item) => {
                        if (!item || !item.id) return;
                        const key = String(item.id);
                        if (seen.has(key)) return;
                        seen.add(key);
                        playlistItems.push(createPlaylistItem(item));
                    };

                    addItem(video);
                    videos.forEach(addItem);

                    setPlaylist(playlistItems.length > 0 ? playlistItems : [createPlaylistItem(video)]);
                } else {
                    // If playlistId was specified but no videos found, show only current video
                    setPlaylist([createPlaylistItem(video)]);
                }
            } catch (playlistErr) {
                if (playlistErr.name === 'AbortError' || playlistErr.name === 'CanceledError') {
                    return;
                }
                console.error('Error loading playlist:', playlistErr);
                setPlaylist([createPlaylistItem(video)]);
            } finally {
                setPlaylistLoading(false);
            }
        };

        loadPlaylist();
    }, [video, signal, playlistIdFromUrl]);


    useEffect(() => {
        // Skip index update during seamless navigation - loadVideoData handles it
        if (isSeamlessNavigationRef.current) {
            return;
        }

        if (!playlist.length) {
            setCurrentPlaylistIndex(0);
            return;
        }

        // Find current video index in playlist - must match exactly
        // This maintains the linked list order by position
        const currentIndex = playlist.findIndex((item) => {
            if (!item || !item.id) return false;
            return String(item.id) === String(id);
        });

        // If current video is not found but we have a playlistId, it might be loading
        // Keep the index at 0 or the last known index
        if (currentIndex === -1 && currentPlaylistId) {
            // Don't reset to 0 if we're in a playlist - wait for video to load
            return;
        }

        setCurrentPlaylistIndex(currentIndex === -1 ? 0 : currentIndex);
    }, [playlist, id, currentPlaylistId]);

    // Load video data directly without navigation for seamless transitions
    const loadVideoData = async (videoId) => {
        try {
            // Clear any pending reset timeout from previous navigation
            if (seamlessResetTimeoutRef.current) {
                clearTimeout(seamlessResetTimeoutRef.current);
                seamlessResetTimeoutRef.current = null;
            }

            // Mark as seamless navigation to prevent playlist reload
            isSeamlessNavigationRef.current = true;

            // Fetch video data
            const data = await videosAPI.getVideo(videoId, signal);

            // Batch initial state updates to prevent flickering
            startTransition(() => {
                setVideo(data);
                // Set default video URL
                const defaultUrl = data.playbackUrl || videosAPI.getVideoUrl(data.storageKey);
                setCurrentVideoUrl(defaultUrl);
            });

            // Fetch available quality variants
            try {
                const qualitiesData = await videosAPI.getVideoQualities(videoId, signal);
                startTransition(() => {
                    if (qualitiesData.qualities && qualitiesData.qualities.length > 0) {
                        setQualities(qualitiesData.qualities);
                        const highestQuality = qualitiesData.qualities[qualitiesData.qualities.length - 1];
                        if (highestQuality && highestQuality.playbackUrl) {
                            setCurrentVideoUrl(highestQuality.playbackUrl);
                        }
                    } else {
                        setQualities([]);
                    }
                });
            } catch (qualErr) {
                if (qualErr.name !== 'AbortError' && qualErr.name !== 'CanceledError') {
                    console.log('No quality variants available:', qualErr);
                }
                startTransition(() => setQualities([]));
            }

            // Fetch like statistics
            try {
                const stats = await videosAPI.getLikeStats(videoId, signal);
                startTransition(() => setLikeStats(stats));
            } catch (statsErr) {
                if (statsErr.name !== 'AbortError' && statsErr.name !== 'CanceledError') {
                    console.log('Error fetching like stats:', statsErr);
                }
            }

            // Fetch channel info if available
            if (data.userId) {
                try {
                    const { channelsAPI } = await import('../../shared/api/channels');
                    const channelData = await channelsAPI.getChannel({ userId: data.userId }, signal);
                    startTransition(() => setChannelInfo(channelData));
                } catch (channelErr) {
                    if (channelErr.name !== 'AbortError' && channelErr.name !== 'CanceledError') {
                        console.debug('Could not load channel info:', channelErr);
                    }
                }
            }

            // Update playlist index if we're in a playlist
            if (playlist.length > 0) {
                const newIndex = playlist.findIndex((item) => {
                    if (!item || !item.id) return false;
                    return String(item.id) === String(videoId);
                });
                if (newIndex !== -1) {
                    startTransition(() => setCurrentPlaylistIndex(newIndex));
                }
            }

            // Update URL using History API without causing navigation
            const searchParams = new URLSearchParams();
            if (currentPlaylistId) {
                searchParams.set('playlistId', currentPlaylistId);
            }
            const newUrl = `/video/${videoId}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
            window.history.pushState({ videoId }, '', newUrl);

            // Reset flag after all state updates and useEffects have completed
            // Use a delay to ensure startTransition and all derived effects finish
            seamlessResetTimeoutRef.current = setTimeout(() => {
                isSeamlessNavigationRef.current = false;
                seamlessResetTimeoutRef.current = null;
            }, 200);

        } catch (err) {
            if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
                console.error('Error loading video:', err);
                setError(err.message || 'Failed to load video');
            }
            // Clear timeout and reset flag on error
            if (seamlessResetTimeoutRef.current) {
                clearTimeout(seamlessResetTimeoutRef.current);
                seamlessResetTimeoutRef.current = null;
            }
            isSeamlessNavigationRef.current = false;
        }
    };

    const handleNavigateToVideo = (videoId, options = {}) => {
        // Load video data directly without route navigation for seamless transition
        loadVideoData(videoId);
    };

    const hasPrevious = currentPlaylistIndex > 0;
    const hasNext = currentPlaylistIndex < playlist.length - 1;

    const handleNextVideo = () => {
        if (!hasNext) return;
        const nextItem = playlist[currentPlaylistIndex + 1];
        if (nextItem) {
            // Don't update index here - loadVideoData will handle it
            handleNavigateToVideo(nextItem.id);
        }
    };

    const handlePreviousVideo = () => {
        if (!hasPrevious) return;
        const prevItem = playlist[currentPlaylistIndex - 1];
        if (prevItem) {
            // Don't update index here - loadVideoData will handle it
            handleNavigateToVideo(prevItem.id);
        }
    };

    const handlePlaylistSelect = (index) => {
        const item = playlist[index];
        if (!item || String(item.id) === String(id)) return;
        // Don't update index here - loadVideoData will handle it
        handleNavigateToVideo(item.id);
    };

    const handleVideoEnded = () => {
        if (hasNext) {
            // Start countdown before playing next video (YouTube-like behavior)
            let countdown = 5; // 5 seconds countdown
            setNextVideoCountdown(countdown);

            // Clear any existing interval
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }

            countdownIntervalRef.current = setInterval(() => {
                countdown -= 1;
                if (countdown <= 0) {
                    if (countdownIntervalRef.current) {
                        clearInterval(countdownIntervalRef.current);
                        countdownIntervalRef.current = null;
                    }
                    setNextVideoCountdown(null);
                    handleNextVideo();
                } else {
                    setNextVideoCountdown(countdown);
                }
            }, 1000);
        }
    };

    const handleCancelCountdown = () => {
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
        setNextVideoCountdown(null);
    };

    // Cleanup countdown and seamless timeout on unmount
    useEffect(() => {
        return () => {
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }
            if (seamlessResetTimeoutRef.current) {
                clearTimeout(seamlessResetTimeoutRef.current);
            }
        };
    }, []);

    // Handle browser back/forward buttons
    useEffect(() => {
        const handlePopState = (event) => {
            // Extract video ID from current URL
            const match = window.location.pathname.match(/\/video\/([^/]+)/);
            if (match && match[1] !== id) {
                loadVideoData(match[1]);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [id]);

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

    // Don't show skeleton during seamless navigation - keep existing content
    if (loading && !isSeamlessNavigationRef.current) {
        return <VideoPageSkeleton />;
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

    const handleSubstrateMouseMove = () => {
        if (videoPlayerRef.current) {
            videoPlayerRef.current.showControls();
        }
    };

    const handleSubstrateMouseEnter = () => {
        if (videoPlayerRef.current) {
            videoPlayerRef.current.showControls();
        }
    };

    return (
        <div className="video-page">
            <div
                className="video-player-substrate"
                onMouseMove={handleSubstrateMouseMove}
                onMouseEnter={handleSubstrateMouseEnter}
            >
                <div className="video-player-wrapper">
                    <canvas ref={ambientCanvasRef} className="ambient-canvas" />
                    {nextVideoCountdown !== null && hasNext && playlist[currentPlaylistIndex + 1] && (
                        <div className="next-video-countdown">
                            <div className="countdown-content">
                                <h3 className="countdown-header">
                                    Up next in {nextVideoCountdown}
                                </h3>
                                <div className="countdown-video-preview">
                                    {playlist[currentPlaylistIndex + 1]?.thumbnailUrl && (
                                        <div className="countdown-thumbnail-wrapper">
                                            <img
                                                src={playlist[currentPlaylistIndex + 1].thumbnailUrl}
                                                alt={playlist[currentPlaylistIndex + 1].title}
                                                className="countdown-thumbnail"
                                            />
                                            {playlist[currentPlaylistIndex + 1]?.durationMs && (
                                                <div className="countdown-duration">
                                                    {formatDuration(playlist[currentPlaylistIndex + 1].durationMs)}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="countdown-video-info">
                                        <h4 className="countdown-video-title">
                                            {playlist[currentPlaylistIndex + 1]?.title || 'Next video'}
                                        </h4>
                                        <p className="countdown-channel-name">
                                            {(() => {
                                                const nextVideo = playlist[currentPlaylistIndex + 1];
                                                // If next video is from same channel, use current channel info
                                                if (nextVideo?.userId === video?.userId) {
                                                    return channelInfo?.name || video.user?.username || 'Channel';
                                                }
                                                // Otherwise, we'd need to fetch it, but for now use a fallback
                                                return channelInfo?.name || video.user?.username || 'Channel';
                                            })()}
                                        </p>
                                    </div>
                                </div>
                                <div className="countdown-actions">
                                    <button
                                        className="btn-countdown-cancel"
                                        onClick={handleCancelCountdown}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="btn-countdown-play-now"
                                        onClick={() => {
                                            handleCancelCountdown();
                                            handleNextVideo();
                                        }}
                                    >
                                        Play Now
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    <VideoPlayer
                        ref={videoPlayerRef}
                        videoId={video.id}
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
                        onEnded={handleVideoEnded}
                        onNext={playlist.length > 1 ? handleNextVideo : undefined}
                        onPrevious={playlist.length > 1 ? handlePreviousVideo : undefined}
                        canPlayNext={hasNext}
                        canPlayPrevious={hasPrevious}
                    />
                </div>
            </div>

            <div className="video-content">
                <div className="video-main-column">
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

                                {/* Mobile Playlist Button */}
                                {playlistIdFromUrl && playlist.length > 0 && (
                                    <button
                                        onClick={() => setIsPlaylistBottomSheetOpen(true)}
                                        className="btn-playlist-mobile"
                                        aria-label="Open playlist"
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                                        </svg>
                                        <span>Playlist</span>
                                    </button>
                                )}

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
                {/* Show playlist section only if playlistId is in URL query params */}
                {playlistIdFromUrl && playlist.length > 0 && (
                    <aside className="video-playlist" aria-label="Playlist">
                        <div className="playlist-header">
                            <div>
                                <h2>Playlist</h2>
                                <span>{playlist.length} video{playlist.length === 1 ? '' : 's'}</span>
                            </div>
                            <div className="playlist-controls">
                                <button
                                    type="button"
                                    onClick={handlePreviousVideo}
                                    disabled={!hasPrevious}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                                    </svg>
                                    Previous
                                </button>
                                <button
                                    type="button"
                                    onClick={handleNextVideo}
                                    disabled={!hasNext}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M16 6h2v12h-2zM6 18V6l8.5 6z" />
                                    </svg>
                                    Next
                                </button>
                            </div>
                        </div>

                        <div className="playlist-items">
                            {playlistLoading && (
                                <div className="playlist-empty">Loading playlist…</div>
                            )}

                            {!playlistLoading && playlist.length === 0 && (
                                <div className="playlist-empty">No videos available</div>
                            )}

                            {!playlistLoading && playlist.map((item, index) => {
                                const isActive = index === currentPlaylistIndex;
                                const metaParts = [];

                                if (item.durationMs) {
                                    metaParts.push(formatDuration(item.durationMs));
                                }
                                metaParts.push(`${formatViews(item.views || 0)} views`);
                                if (item.uploadedAt) {
                                    metaParts.push(formatDate(item.uploadedAt));
                                }

                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className={`playlist-item ${isActive ? 'active' : ''}`}
                                        onClick={() => handlePlaylistSelect(index)}
                                    >
                                        {item.thumbnailUrl ? (
                                            <img src={item.thumbnailUrl} alt="" className="playlist-thumbnail" />
                                        ) : (
                                            <div className="playlist-thumbnail placeholder">No thumbnail</div>
                                        )}
                                        <div className="playlist-info">
                                            <span className="playlist-title">{item.title}</span>
                                            <span className="playlist-meta">{metaParts.join(' • ')}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </aside>
                )}
            </div>

            {/* Mobile Playlist Sheet */}
            {playlistIdFromUrl && playlist.length > 0 && (
                <MobilePlaylistSheet
                    isOpen={isPlaylistBottomSheetOpen}
                    onClose={() => setIsPlaylistBottomSheetOpen(false)}
                    playlist={playlist}
                    currentIndex={currentPlaylistIndex}
                    playlistLoading={playlistLoading}
                    onSelectVideo={handlePlaylistSelect}
                    onNext={handleNextVideo}
                    onPrevious={handlePreviousVideo}
                    hasNext={hasNext}
                    hasPrevious={hasPrevious}
                />
            )}
        </div>
    );
};
