/**
 * Video Player Component (FSD Architecture)
 * Complete YouTube-like video player with Feature-Sliced Design
 */
import React, { useEffect, useState, useRef, useImperativeHandle, useCallback } from 'react';
import { FaCog, FaCheck } from 'react-icons/fa';
import { useFloating, offset, flip, shift, size, limitShift, autoUpdate } from '@floating-ui/react';

// FSD Imports
import { PLAYER_CONSTANTS, PLAYER_STATES, PLAYER_EVENTS, MIME_TYPES } from '../../../shared/config/videoPlayer.constants';
import { useStateMachine } from '../../../shared/lib/fsm';
import { videoPlayerFSMConfig, isPlayingState } from '../../../entities/video/model';
import {
    useFullscreen,
    useVideoEvents,
    useKeyboardShortcuts
} from '../../../shared/lib/hooks';
import { useFullscreenHeader } from '../../../features/video-player/hooks';
import {
    formatTime,
    getStorageNumber,
    setStorageItem,
    removeStorageItem,
    updateProgressBarHover,
    getProgressBarPosition
} from '../../../shared/lib/utils';

// Feature Components
import {
    PlayPauseButton,
    VolumeControl,
    TimeDisplay,
    FullscreenButton,
    PlaylistNavigation,
} from '../../../features/video-player/controls';
import {
    SeekOverlay,
    BufferingOverlay,
    VolumeIndicator,
    UpNextOverlay,
    TapZones,
} from '../../../features/video-player/overlays';

// Shared Components
import { Spinner } from '../../../shared/ui/Spinner';
import { Tooltip } from '../../../shared/ui/Tooltip';

// Styles
import styles from './VideoPlayer.module.css';
import { KeyboardShortcuts } from './KeyboardShortcuts';

/**
 * Video Player Component
 */
export const VideoPlayer = React.forwardRef(({
    src,
    poster,
    title,
    videoId,
    autoPlay = false,
    onTimeUpdate,
    onEnded,
    onError,
    primaryColor = PLAYER_CONSTANTS.COLORS.PRIMARY,
    qualities = [],
    onQualityChange,
    className = '',
    mimeType,
    onAmbientUpdate,
    onNext,
    onPrevious,
    canPlayNext = true,
    canPlayPrevious = true,
    nextVideo = null, // { title, thumbnailUrl, durationMs, channelName }
}, ref) => {
    // Refs
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const controlsTimeoutRef = useRef(null);
    const progressBarRef = useRef(null);
    const ambientIntervalRef = useRef(null);
    const saveIntervalRef = useRef(null);
    const lastSavedTimeRef = useRef(0);
    const hasRestoredPositionRef = useRef(false);
    const pendingRestorePositionRef = useRef(null);
    const isDraggingRef = useRef(false);

    // Floating UI for settings dropdown positioning
    // Always position above the settings button, constrained to player container
    const { refs: floatingRefs, floatingStyles } = useFloating({
        placement: 'top',
        strategy: 'absolute',
        whileElementsMounted: autoUpdate,
        middleware: [
            offset(8),
            // Only flip if absolutely necessary (not enough space at all)
            flip({
                fallbackPlacements: ['top-start', 'top-end'], // Keep above if possible
                boundary: containerRef.current,
                padding: 16,
            }),
            shift({
                padding: 8,
                boundary: containerRef.current,
                limiter: limitShift(),
            }),
            size({
                apply({ rects, elements }) {
                    // Get accurate measurements using getBoundingClientRect
                    const container = containerRef.current;
                    const reference = elements.reference;

                    if (!container || !reference) return;

                    const containerRect = container.getBoundingClientRect();
                    const referenceRect = reference.getBoundingClientRect();

                    // Calculate space from button to top of container
                    const spaceAbove = referenceRect.top - containerRect.top;
                    // Subtract offset (8px) and safety margin (16px)
                    const maxHeight = Math.max(Math.min(spaceAbove - 24, 400), 80);

                    // Calculate available width
                    const containerWidth = containerRect.width;
                    const maxWidth = Math.min(containerWidth - 24, 300);

                    Object.assign(elements.floating.style, {
                        maxHeight: `${maxHeight}px`,
                        maxWidth: `${maxWidth}px`,
                        overflowY: 'auto',
                        overflowX: 'hidden',
                    });
                },
            }),
        ],
    });

    // State Machine
    const [playerState, sendPlayerEvent] = useStateMachine(videoPlayerFSMConfig);
    const isPlaying = isPlayingState(playerState);

    // Native video state tracking (directly from video element)
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);
    const [isVideoBuffering, setIsVideoBuffering] = useState(false);
    const [isVideoLoading, setIsVideoLoading] = useState(true);

    // State
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(getStorageNumber(PLAYER_CONSTANTS.STORAGE_KEYS.VOLUME, PLAYER_CONSTANTS.VOLUME_DEFAULT));
    const [isMuted, setIsMuted] = useState(false);
    // Initially hide controls if autoPlay is true to prevent overlay conflicts on initial render
    const [showControls, setShowControls] = useState(!autoPlay);
    const [showSettings, setShowSettings] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(PLAYER_CONSTANTS.PLAYBACK_RATE_DEFAULT);
    const [showPlaybackRates, setShowPlaybackRates] = useState(false);
    const [showQualities, setShowQualities] = useState(false);
    const [selectedQuality, setSelectedQuality] = useState(null);
    const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [hoverTime, setHoverTime] = useState(null);
    const [hoverPosition, setHoverPosition] = useState(0);
    const [wasPlayingBeforeDrag, setWasPlayingBeforeDrag] = useState(false);

    // Seek overlay state
    const [seekOverlayState, setSeekOverlayState] = useState({
        visible: false,
        direction: 'forward',
        count: 1,
        x: 0,
        y: 0,
    });

    // Volume indicator state
    const [volumeIndicatorVisible, setVolumeIndicatorVisible] = useState(false);

    // Volume slider expand state (for mobile)
    const [volumeSliderExpanded, setVolumeSliderExpanded] = useState(false);

    // Up Next overlay state
    const [showUpNext, setShowUpNext] = useState(false);
    const [upNextCountdown, setUpNextCountdown] = useState(null);
    const countdownIntervalRef = useRef(null);

    // Native fullscreen API (like F11)
    const { isFullscreen, toggleFullscreen: toggleFullscreenNative } = useFullscreen(containerRef, videoRef);

    // Automatically hide/show header based on fullscreen state
    useFullscreenHeader({
        isFullscreen,
        autoHide: true,
        restoreOnExit: true,
    });

    // Storage key helper
    const getStorageKey = useCallback(() => {
        return videoId ? PLAYER_CONSTANTS.STORAGE_KEYS.POSITION(videoId) : null;
    }, [videoId]);

    // Save/restore position functions
    const saveVideoPosition = useCallback((time) => {
        const key = getStorageKey();
        if (!key) return;

        if (Math.abs(time - lastSavedTimeRef.current) < 1) return;

        lastSavedTimeRef.current = time;
        setStorageItem(key, time);
    }, [getStorageKey]);

    const restoreVideoPosition = useCallback(() => {
        const key = getStorageKey();
        if (!key || hasRestoredPositionRef.current) return null;

        try {
            const savedPosition = localStorage.getItem(key);
            if (savedPosition) {
                const position = parseFloat(savedPosition);
                if (!isNaN(position) && position > 0) {
                    hasRestoredPositionRef.current = true;
                    return position;
                }
            }
        } catch (err) {
            console.error('Failed to restore video position:', err);
        }

        return null;
    }, [getStorageKey]);

    const clearVideoPosition = useCallback(() => {
        const key = getStorageKey();
        if (key) {
            removeStorageItem(key);
        }
    }, [getStorageKey]);

    // Detect MIME type
    const detectMimeType = (url) => {
        if (!url) return MIME_TYPES.mp4;
        const ext = url.split('.').pop()?.toLowerCase();
        return MIME_TYPES[ext] || MIME_TYPES.mp4;
    };

    const videoMimeType = mimeType || detectMimeType(src);

    // Controls visibility
    const showControlsTemporarily = useCallback(() => {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying) {
                setShowControls(false);
            }
        }, PLAYER_CONSTANTS.CONTROLS_AUTO_HIDE_DELAY);
    }, [isPlaying]);

    const handleMouseMove = useCallback(() => {
        showControlsTemporarily();
    }, [showControlsTemporarily]);

    // Toggle native fullscreen (F11-like behavior)
    const toggleFullscreen = useCallback(() => {
        toggleFullscreenNative();
        showControlsTemporarily();
    }, [toggleFullscreenNative, showControlsTemporarily]);

    // Playback controls
    const togglePlayPause = useCallback(() => {
        if (!videoRef.current) return;

        if (videoRef.current.paused) {
            // Don't send PLAY event here - let the video element's 'play' event handler do it
            // This ensures state updates only when video actually starts playing
            videoRef.current.play().catch((error) => {
                console.error('Error playing video:', error);
                sendPlayerEvent(PLAYER_EVENTS.ERROR);
            });
        } else {
            if (videoId) {
                saveVideoPosition(videoRef.current.currentTime);
            }
            // Don't send PAUSE event here - let the video element's 'pause' event handler do it
            // This ensures state stays in sync with actual playback state
            videoRef.current.pause();
        }
        showControlsTemporarily();
    }, [videoId, sendPlayerEvent, saveVideoPosition, showControlsTemporarily]);

    // Seek functions
    const seekTo = useCallback((time) => {
        if (!videoRef.current) return;
        videoRef.current.currentTime = time;
        setCurrentTime(time);
    }, []);

    const seekForward = useCallback((seconds = PLAYER_CONSTANTS.SEEK_SHORT) => {
        if (!videoRef.current) return;
        const newTime = Math.min(videoRef.current.currentTime + seconds, duration);
        seekTo(newTime);
        showControlsTemporarily();
    }, [duration, seekTo, showControlsTemporarily]);

    const seekBackward = useCallback((seconds = PLAYER_CONSTANTS.SEEK_SHORT) => {
        if (!videoRef.current) return;
        const newTime = Math.max(videoRef.current.currentTime - seconds, 0);
        seekTo(newTime);
        showControlsTemporarily();
    }, [seekTo, showControlsTemporarily]);

    // Volume controls
    const handleVolumeChange = useCallback((newVolume) => {
        if (!videoRef.current) return;
        const vol = Math.max(PLAYER_CONSTANTS.VOLUME_MIN, Math.min(PLAYER_CONSTANTS.VOLUME_MAX, newVolume));

        // Update volume immediately with no debounce
        setVolume(vol);
        videoRef.current.volume = vol / 100;
        setStorageItem(PLAYER_CONSTANTS.STORAGE_KEYS.VOLUME, vol);

        if (vol > 0 && isMuted) {
            setIsMuted(false);
            videoRef.current.muted = false;
        }

        // Show indicator immediately - the indicator will handle its own hide timer
        setVolumeIndicatorVisible(true);
    }, [isMuted]);

    const increaseVolume = useCallback(() => {
        handleVolumeChange(volume + PLAYER_CONSTANTS.VOLUME_STEP);
    }, [volume, handleVolumeChange]);

    const decreaseVolume = useCallback(() => {
        handleVolumeChange(volume - PLAYER_CONSTANTS.VOLUME_STEP);
    }, [volume, handleVolumeChange]);

    const toggleMute = useCallback(() => {
        if (!videoRef.current) return;
        const newMuted = !isMuted;
        setIsMuted(newMuted);
        videoRef.current.muted = newMuted;
        showControlsTemporarily();
        setVolumeIndicatorVisible(true);
    }, [isMuted, showControlsTemporarily]);

    // Playback rate
    const handlePlaybackRateChange = useCallback((rate) => {
        if (!videoRef.current) return;
        videoRef.current.playbackRate = rate;
        setPlaybackRate(rate);
        setShowPlaybackRates(false);
        setShowSettings(false);
    }, []);

    // Quality switching
    const handleQualityChange = useCallback((quality) => {
        if (!videoRef.current) return;

        const currentTimeBeforeSwitch = videoRef.current.currentTime;
        const wasPlaying = !videoRef.current.paused;

        setSelectedQuality(quality);
        setShowQualities(false);
        setShowSettings(false);

        if (onQualityChange) {
            const handleLoadedData = () => {
                if (videoRef.current) {
                    videoRef.current.currentTime = currentTimeBeforeSwitch;
                    if (wasPlaying) {
                        videoRef.current.play().catch(() => { });
                    }
                }
                videoRef.current?.removeEventListener('loadeddata', handleLoadedData);
            };

            videoRef.current.addEventListener('loadeddata', handleLoadedData);
            onQualityChange(quality);
        }
    }, [onQualityChange]);

    // Progress bar handlers
    const handleProgressMouseMove = useCallback((e) => {
        if (!progressBarRef.current || !duration) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        updateProgressBarHover(e, rect, duration, PLAYER_CONSTANTS.PROGRESS_BAR_PADDING, setHoverTime, setHoverPosition);
    }, [duration]);

    const handleProgressMouseLeave = useCallback(() => {
        if (!isDragging) {
            setHoverTime(null);
            setHoverPosition(0);
        }
    }, [isDragging]);

    const handleProgressMouseDown = useCallback((e) => {
        if (!videoRef.current || !duration || !progressBarRef.current) return;
        e.preventDefault();
        setIsDragging(true);
        isDraggingRef.current = true;
        setWasPlayingBeforeDrag(!videoRef.current.paused);

        const rect = progressBarRef.current.getBoundingClientRect();
        const { time } = getProgressBarPosition(e, rect, duration, PLAYER_CONSTANTS.PROGRESS_BAR_PADDING);
        seekTo(time);
    }, [duration, seekTo]);

    const handleProgressChange = useCallback((e) => {
        if (isDragging || !progressBarRef.current) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const { time } = getProgressBarPosition(e, rect, duration, PLAYER_CONSTANTS.PROGRESS_BAR_PADDING);
        seekTo(time);
    }, [isDragging, duration, seekTo]);

    // Touch handlers for progress bar (mobile support)
    const handleProgressTouchStart = useCallback((e) => {
        if (!videoRef.current || !duration || !progressBarRef.current) return;
        // Note: Don't preventDefault here - React's onTouchStart is passive
        setIsDragging(true);
        isDraggingRef.current = true;
        setWasPlayingBeforeDrag(!videoRef.current.paused);

        const touch = e.touches[0];
        const rect = progressBarRef.current.getBoundingClientRect();
        const touchEvent = { clientX: touch.clientX, clientY: touch.clientY };
        const { time } = getProgressBarPosition(touchEvent, rect, duration, PLAYER_CONSTANTS.PROGRESS_BAR_PADDING);
        seekTo(time);
    }, [duration, seekTo]);

    const handleProgressTouchMove = useCallback((e) => {
        if (!isDragging || !progressBarRef.current || !duration) return;
        e.preventDefault();

        const touch = e.touches[0];
        const rect = progressBarRef.current.getBoundingClientRect();
        const touchEvent = { clientX: touch.clientX, clientY: touch.clientY };
        const time = updateProgressBarHover(touchEvent, rect, duration, PLAYER_CONSTANTS.PROGRESS_BAR_PADDING, setHoverTime, setHoverPosition);

        if (videoRef.current) {
            seekTo(time);
        }
    }, [isDragging, duration, seekTo]);

    const handleProgressTouchEnd = useCallback(() => {
        if (!isDragging) return;
        setIsDragging(false);
        isDraggingRef.current = false;
        setHoverTime(null);
        setHoverPosition(0);
    }, [isDragging]);


    // Handle seek overlay animation end
    const handleSeekOverlayEnd = useCallback(() => {
        setSeekOverlayState(prev => ({ ...prev, visible: false }));
    }, []);

    // Handle volume indicator hide
    const handleVolumeIndicatorHide = useCallback(() => {
        setVolumeIndicatorVisible(false);
    }, []);


    // Keyboard shortcuts
    useKeyboardShortcuts({
        onPlayPause: togglePlayPause,
        onSeekForward: () => seekForward(),
        onSeekBackward: () => seekBackward(),
        onSeekForwardLong: () => seekForward(PLAYER_CONSTANTS.SEEK_LONG),
        onSeekBackwardLong: () => seekBackward(PLAYER_CONSTANTS.SEEK_LONG),
        onVolumeUp: increaseVolume,
        onVolumeDown: decreaseVolume,
        onMute: toggleMute,
        onFullscreen: toggleFullscreen,
        onNextVideo: onNext,
        onPreviousVideo: onPrevious,
        onShowHelp: () => setShowKeyboardShortcuts(!showKeyboardShortcuts),
        onEscape: () => setShowKeyboardShortcuts(false),
    }, true);

    // Video events
    useVideoEvents(videoRef, {
        onLoadedMetadata: () => {
            const video = videoRef.current;
            if (!video) return;

            setDuration(video.duration);
            setIsVideoLoading(false);
            sendPlayerEvent(PLAYER_EVENTS.LOADED_METADATA);

            // Show controls once metadata is loaded (only if NOT autoPlay)
            // If autoPlay, controls will show on mouse move or when user interacts
            if (!autoPlay) {
                setShowControls(true);
            }

            // Restore position
            const pendingPosition = pendingRestorePositionRef.current;
            if (pendingPosition && video.duration && pendingPosition < video.duration - 5 && !hasRestoredPositionRef.current) {
                video.currentTime = pendingPosition;
                hasRestoredPositionRef.current = true;
                pendingRestorePositionRef.current = null;
            }
        },
        onLoadedData: () => {
            setIsVideoLoading(false);
            setIsVideoBuffering(false);
        },
        onTimeUpdate: () => {
            const video = videoRef.current;
            if (!video) return;

            const time = video.currentTime;
            setCurrentTime(time);

            // Don't save position while dragging - only during normal playback
            // Use ref to avoid recreating this callback on every drag state change
            if (!isDraggingRef.current) {
                saveVideoPosition(time);
            }

            // If we're getting time updates, we're not buffering
            if (isVideoBuffering) {
                setIsVideoBuffering(false);
            }

            if (onTimeUpdate) {
                onTimeUpdate(time);
            }
        },
        onPlay: () => {
            setIsVideoPlaying(true);
            setIsVideoBuffering(false);
            sendPlayerEvent(PLAYER_EVENTS.PLAY);
        },
        onPause: () => {
            setIsVideoPlaying(false);
            sendPlayerEvent(PLAYER_EVENTS.PAUSE);
        },
        onWaiting: () => {
            setIsVideoBuffering(true);
            sendPlayerEvent(PLAYER_EVENTS.WAITING);
        },
        onCanPlay: () => {
            setIsVideoBuffering(false);
            setIsVideoLoading(false);
            sendPlayerEvent(PLAYER_EVENTS.CAN_PLAY);
        },
        onCanPlayThrough: () => {
            setIsVideoBuffering(false);
            setIsVideoLoading(false);
        },
        onSeeking: () => {
            setIsVideoBuffering(true);
            sendPlayerEvent(PLAYER_EVENTS.SEEK);
        },
        onSeeked: () => {
            setIsVideoBuffering(false);
            sendPlayerEvent(PLAYER_EVENTS.SEEKED);
        },
        onEnded: () => {
            setIsVideoPlaying(false);
            clearVideoPosition();
            sendPlayerEvent(PLAYER_EVENTS.ENDED);

            // Check if we'll handle the countdown internally (fullscreen with next video)
            const willHandleInternally = nextVideo && onNext && isFullscreen && canPlayNext;

            // Show Up Next countdown in fullscreen
            handleVideoEnded();

            // Only call external onEnded if we're not handling it internally
            // This prevents duplicate countdowns
            if (onEnded && !willHandleInternally) {
                onEnded();
            }
        },
        onError: () => {
            setIsVideoLoading(false);
            setIsVideoBuffering(false);
            sendPlayerEvent(PLAYER_EVENTS.ERROR);
            if (onError) {
                onError();
            }
        },
    });

    // Load saved position when videoId changes
    useEffect(() => {
        hasRestoredPositionRef.current = false;
        pendingRestorePositionRef.current = null;

        if (videoId) {
            const key = PLAYER_CONSTANTS.STORAGE_KEYS.POSITION(videoId);
            try {
                const savedPosition = localStorage.getItem(key);
                if (savedPosition) {
                    const position = parseFloat(savedPosition);
                    if (!isNaN(position) && position > 5) {
                        pendingRestorePositionRef.current = position;
                    }
                }
            } catch (err) {
                console.error('Failed to load saved position:', err);
            }
        }
    }, [videoId]);

    // Auto-save position while playing
    useEffect(() => {
        if (!videoId) return;

        if (saveIntervalRef.current) {
            clearInterval(saveIntervalRef.current);
            saveIntervalRef.current = null;
        }

        if (isPlaying && videoRef.current) {
            saveIntervalRef.current = setInterval(() => {
                if (videoRef.current && videoId) {
                    const time = videoRef.current.currentTime;
                    const key = PLAYER_CONSTANTS.STORAGE_KEYS.POSITION(videoId);
                    setStorageItem(key, time);
                }
            }, PLAYER_CONSTANTS.POSITION_SAVE_INTERVAL);
        }

        return () => {
            if (saveIntervalRef.current) {
                clearInterval(saveIntervalRef.current);
                saveIntervalRef.current = null;
            }
        };
    }, [isPlaying, videoId]);

    // Save on unload
    useEffect(() => {
        if (!videoId) return;

        const storageKey = PLAYER_CONSTANTS.STORAGE_KEYS.POSITION(videoId);

        const saveOnUnload = () => {
            const video = videoRef.current;
            if (video) {
                setStorageItem(storageKey, video.currentTime);
            }
        };

        window.addEventListener('beforeunload', saveOnUnload);
        window.addEventListener('pagehide', saveOnUnload);
        document.addEventListener('visibilitychange', saveOnUnload);

        return () => {
            saveOnUnload();
            window.removeEventListener('beforeunload', saveOnUnload);
            window.removeEventListener('pagehide', saveOnUnload);
            document.removeEventListener('visibilitychange', saveOnUnload);
        };
    }, [videoId]);

    // Autoplay
    useEffect(() => {
        if (videoRef.current && autoPlay) {
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    // Autoplay was prevented
                });
            }
        }
    }, [autoPlay]);

    // Source changes
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Reset loading states when source changes
        setIsVideoLoading(true);
        setIsVideoBuffering(false);
        setIsVideoPlaying(false);

        video.load();

        if (autoPlay) {
            // Use a small delay to ensure video is ready
            const playTimeout = setTimeout(() => {
                const playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(() => {
                        // Autoplay was prevented
                    });
                }
            }, 10);

            return () => clearTimeout(playTimeout);
        }
    }, [src, autoPlay]);

    // Drag handling (mouse and touch)
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e) => {
            if (!progressBarRef.current || !duration) return;

            const rect = progressBarRef.current.getBoundingClientRect();
            const time = updateProgressBarHover(e, rect, duration, PLAYER_CONSTANTS.PROGRESS_BAR_PADDING, setHoverTime, setHoverPosition);

            if (videoRef.current) {
                seekTo(time);
            }
        };

        const handleTouchMove = (e) => {
            if (!progressBarRef.current || !duration) return;

            const touch = e.touches[0];
            const rect = progressBarRef.current.getBoundingClientRect();
            const touchEvent = { clientX: touch.clientX, clientY: touch.clientY };
            const time = updateProgressBarHover(touchEvent, rect, duration, PLAYER_CONSTANTS.PROGRESS_BAR_PADDING, setHoverTime, setHoverPosition);

            if (videoRef.current) {
                seekTo(time);
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            isDraggingRef.current = false;
            setHoverTime(null);
            setHoverPosition(0);
        };

        const handleTouchEnd = () => {
            setIsDragging(false);
            isDraggingRef.current = false;
            setHoverTime(null);
            setHoverPosition(0);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isDragging, duration, seekTo]);

    // Ambient light effect
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !onAmbientUpdate) return;

        let animationFrameId = null;
        let intervalId = null;
        let isRunning = false;

        const updateAmbient = () => {
            try {
                if (video.readyState >= 2 && !video.paused && !video.ended) {
                    onAmbientUpdate(video);
                    return true;
                }
                return false;
            } catch (err) {
                return false;
            }
        };

        // Update once immediately when video is ready (even if paused)
        const updateAmbientOnce = () => {
            try {
                if (video.readyState >= 2) {
                    onAmbientUpdate(video);
                }
            } catch (err) {
                // Silent fail
            }
        };

        const startAmbientUpdates = () => {
            if (isRunning) return;
            isRunning = true;

            const frameUpdate = () => {
                if (!video || video.paused || video.ended) {
                    isRunning = false;
                    if (animationFrameId) {
                        cancelAnimationFrame(animationFrameId);
                        animationFrameId = null;
                    }
                    return;
                }

                if (video.readyState >= 2) {
                    updateAmbient();
                }

                animationFrameId = requestAnimationFrame(frameUpdate);
            };

            intervalId = setInterval(() => {
                if (video && !video.paused && !video.ended && video.readyState >= 2) {
                    updateAmbient();
                }
            }, PLAYER_CONSTANTS.AMBIENT_UPDATE_INTERVAL);

            animationFrameId = requestAnimationFrame(frameUpdate);
            ambientIntervalRef.current = intervalId;
        };

        const stopAmbientUpdates = () => {
            isRunning = false;
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
                ambientIntervalRef.current = null;
            }
        };

        const handlePlay = () => {
            // Update once immediately when starting to play
            updateAmbientOnce();
            startAmbientUpdates();
        };
        const handlePause = () => stopAmbientUpdates();
        const handleEnded = () => stopAmbientUpdates();
        const handleLoadedData = () => {
            // Update once when data loads, but only start continuous updates if playing
            updateAmbientOnce();
            if (!video.paused && !video.ended) {
                startAmbientUpdates();
            }
        };

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('ended', handleEnded);
        video.addEventListener('loadeddata', handleLoadedData);

        // Initial setup: update once if ready, start continuous updates if playing
        if (video.readyState >= 2) {
            updateAmbientOnce();
            if (!video.paused && !video.ended) {
                startAmbientUpdates();
            }
        }

        return () => {
            stopAmbientUpdates();
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('ended', handleEnded);
            video.removeEventListener('loadeddata', handleLoadedData);
        };
    }, [src, onAmbientUpdate]);

    // Handle video ended - show Up Next countdown in fullscreen
    const handleVideoEnded = useCallback(() => {
        // Start countdown if next video available and in fullscreen
        if (nextVideo && onNext && isFullscreen && canPlayNext) {
            let countdown = PLAYER_CONSTANTS.UP_NEXT_AUTOPLAY_COUNTDOWN; // 5 seconds
            setShowUpNext(true);
            setUpNextCountdown(countdown);

            // Clear any existing interval
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }

            // Countdown timer
            countdownIntervalRef.current = setInterval(() => {
                countdown -= 1;
                if (countdown <= 0) {
                    if (countdownIntervalRef.current) {
                        clearInterval(countdownIntervalRef.current);
                        countdownIntervalRef.current = null;
                    }
                    setShowUpNext(false);
                    setUpNextCountdown(null);
                    if (onNext) {
                        onNext();
                    }
                } else {
                    setUpNextCountdown(countdown);
                }
            }, 1000);
        }
    }, [nextVideo, onNext, isFullscreen, canPlayNext]);

    // Handle Up Next actions
    const handleUpNextPlayNow = useCallback(() => {
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
        setShowUpNext(false);
        setUpNextCountdown(null);
        if (onNext) {
            onNext();
        }
    }, [onNext]);

    const handleUpNextCancel = useCallback(() => {
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
        setShowUpNext(false);
        setUpNextCountdown(null);
    }, []);

    // Close settings dropdown when clicking outside
    useEffect(() => {
        if (!showSettings) return;

        const handleClickOutside = (event) => {
            // Check if click is outside both the button and dropdown
            const referenceEl = floatingRefs.reference.current;
            const floatingEl = floatingRefs.floating.current;

            if (
                referenceEl &&
                floatingEl &&
                !referenceEl.contains(event.target) &&
                !floatingEl.contains(event.target)
            ) {
                setShowSettings(false);
                setShowPlaybackRates(false);
                setShowQualities(false);
            }
        };

        // Use setTimeout to avoid immediate closure on touch screens
        // This prevents the touchstart/click from closing the menu right after opening
        const timeoutId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside, { passive: true });
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [showSettings, floatingRefs]);

    // Cleanup countdown interval on unmount
    useEffect(() => {
        return () => {
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }
        };
    }, []);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        showControls: showControlsTemporarily,
    }));

    // Calculate progress percentage
    const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;


    return (
        <>
            <div
                ref={containerRef}
                className={`${styles.player} video-player-substrate ${isFullscreen ? 'fullscreen' : ''} ${className}`}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => {
                    if (isPlaying) setShowControls(false);
                    setShowSettings(false);
                    setShowPlaybackRates(false);
                    setShowQualities(false);
                }}
                onTouchStart={handleMouseMove}
            >
                <video
                    ref={videoRef}
                    className={styles.videoElement}
                    poster={poster}
                    preload="metadata"
                    playsInline
                    webkit-playsinline="true"
                    controls={false}
                    x-webkit-airplay="allow"
                >
                    {src && <source src={src} type={videoMimeType} />}
                    <p>
                        Your browser doesn't support HTML5 video.
                        You can <a href={src} download>download the video</a> instead.
                    </p>
                </video>

                {/* Tap Zones Overlay - Three-zone tap interface */}
                <TapZones
                    onSeekBackward={() => seekBackward(PLAYER_CONSTANTS.SEEK_LONG)}
                    onSeekForward={() => seekForward(PLAYER_CONSTANTS.SEEK_LONG)}
                    onTogglePlay={togglePlayPause}
                    onToggleFullscreen={toggleFullscreen}
                    showControls={showControls}
                    onShowControls={showControlsTemporarily}
                    onSeekFeedback={(direction, count, x, y) => {
                        setSeekOverlayState({
                            visible: true,
                            direction,
                            count,
                            x,
                            y,
                        });
                    }}
                />

                {/* Seek Overlay */}
                <SeekOverlay
                    direction={seekOverlayState.direction}
                    amount={PLAYER_CONSTANTS.SEEK_LONG}
                    count={seekOverlayState.count}
                    visible={seekOverlayState.visible}
                    x={seekOverlayState.x}
                    y={seekOverlayState.y}
                    onAnimationEnd={handleSeekOverlayEnd}
                />

                {/* Buffering Overlay */}
                <BufferingOverlay visible={isVideoBuffering} />

                {/* Volume Indicator */}
                <VolumeIndicator
                    volume={volume}
                    muted={isMuted}
                    visible={volumeIndicatorVisible}
                    onHide={handleVolumeIndicatorHide}
                />

                {/* Up Next Overlay (only in fullscreen with countdown) */}
                {upNextCountdown !== null && showUpNext && isFullscreen && (
                    <UpNextOverlay
                        visible={true}
                        countdown={upNextCountdown}
                        nextVideo={nextVideo}
                        onCancel={handleUpNextCancel}
                        onPlayNow={handleUpNextPlayNow}
                    />
                )}

                {/* Large Play Button Overlay - Show when paused and not buffering/loading */}
                {!isVideoPlaying && !isVideoBuffering && !isVideoLoading && (
                    <div className={styles.playOverlay}>
                        <div className={styles.playButtonLarge}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        </div>
                    </div>
                )}

                {/* Loading Indicator - Show only during initial load */}
                {isVideoLoading && (
                    <div className={styles.loadingIndicator}>
                        <Spinner />
                    </div>
                )}

                {/* Controls */}
                <div className={`${styles.videoControls} ${showControls ? styles.show : ''}`}>
                    {/* Progress Bar */}
                    <div
                        className={`${styles.progressBarContainer} ${isDragging ? styles.dragging : ''}`}
                        ref={progressBarRef}
                        onClick={handleProgressChange}
                        onMouseMove={handleProgressMouseMove}
                        onMouseLeave={handleProgressMouseLeave}
                        onMouseDown={handleProgressMouseDown}
                        onTouchStart={handleProgressTouchStart}
                        onTouchEnd={handleProgressTouchEnd}
                    >
                        {/* Time preview tooltip */}
                        {(hoverTime !== null || isDragging) && (
                            <Tooltip x={hoverPosition} y={32} visible={true}>
                                {formatTime(hoverTime || 0)}
                            </Tooltip>
                        )}
                        <div className={styles.progressBarBackground}>
                            <div
                                className={styles.progressBarFill}
                                style={{
                                    width: `${progressPercentage}%`,
                                    backgroundColor: primaryColor,
                                }}
                            />
                            {/* Preview indicator */}
                            {(hoverTime !== null || isDragging) && (
                                <div
                                    className={styles.progressBarPreview}
                                    style={{
                                        left: `${hoverPosition}px`,
                                        backgroundColor: primaryColor,
                                    }}
                                />
                            )}
                        </div>
                    </div>

                    {/* Controls Row */}
                    <div className={styles.controlsRow}>
                        <div className={styles.controlsLeft}>
                            {/* Playlist Navigation */}
                            <PlaylistNavigation
                                onPrevious={onPrevious}
                                onNext={onNext}
                                canPlayPrevious={canPlayPrevious}
                                canPlayNext={canPlayNext}
                            />

                            {/* Play/Pause Button */}
                            <PlayPauseButton
                                playerState={playerState}
                                onToggle={togglePlayPause}
                            />

                            {/* Volume Control */}
                            <VolumeControl
                                volume={volume}
                                muted={isMuted}
                                onVolumeChange={handleVolumeChange}
                                onMuteToggle={toggleMute}
                                onExpandChange={setVolumeSliderExpanded}
                            />

                            {/* Time Display */}
                            <TimeDisplay
                                currentTime={currentTime}
                                duration={duration}
                                collapsed={volumeSliderExpanded}
                            />
                        </div>

                        <div className={styles.controlsRight}>
                            {/* Video Title */}
                            {title && <div className={styles.videoTitleOverlay}>{title}</div>}

                            {/* Settings Menu */}
                            <div className={styles.settingsMenu}>
                                <button
                                    ref={floatingRefs.setReference}
                                    className={styles.controlButton}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowSettings(!showSettings);
                                    }}
                                    type="button"
                                >
                                    <FaCog />
                                </button>

                                {showSettings && (
                                    <div
                                        ref={floatingRefs.setFloating}
                                        className={styles.settingsDropdown}
                                        style={floatingStyles}
                                        onClick={(e) => e.stopPropagation()}
                                        onTouchStart={(e) => e.stopPropagation()}
                                    >
                                        {!showPlaybackRates && !showQualities && (
                                            <>
                                                <div
                                                    className={styles.settingsItem}
                                                    onClick={() => setShowPlaybackRates(true)}
                                                >
                                                    <span>Playback speed</span>
                                                    <span>{playbackRate === 1 ? 'Normal' : `${playbackRate}x`}</span>
                                                </div>
                                                {qualities && qualities.length > 0 && (
                                                    <div
                                                        className={styles.settingsItem}
                                                        onClick={() => setShowQualities(true)}
                                                    >
                                                        <span>Quality</span>
                                                        <span>{selectedQuality?.label || 'Auto'}</span>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {showPlaybackRates && (
                                            <div className={styles.settingsSubmenu}>
                                                <div
                                                    className={styles.settingsBack}
                                                    onClick={() => setShowPlaybackRates(false)}
                                                >
                                                    ← Playback speed
                                                </div>
                                                {PLAYER_CONSTANTS.PLAYBACK_RATES.map((rate) => (
                                                    <div
                                                        key={rate}
                                                        className={styles.settingsItem}
                                                        onClick={() => handlePlaybackRateChange(rate)}
                                                    >
                                                        <span>{rate === 1 ? 'Normal' : `${rate}x`}</span>
                                                        {playbackRate === rate && <FaCheck />}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {showQualities && (
                                            <div className={styles.settingsSubmenu}>
                                                <div
                                                    className={styles.settingsBack}
                                                    onClick={() => setShowQualities(false)}
                                                >
                                                    ← Quality
                                                </div>
                                                {qualities.map((quality) => (
                                                    <div
                                                        key={quality.id}
                                                        className={styles.settingsItem}
                                                        onClick={() => handleQualityChange(quality)}
                                                    >
                                                        <span>{quality.label}</span>
                                                        {selectedQuality?.id === quality.id && <FaCheck />}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Fullscreen Button */}
                            <FullscreenButton
                                isFullscreen={isFullscreen}
                                onToggle={toggleFullscreen}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Keyboard Shortcuts Help */}
            <KeyboardShortcuts
                show={showKeyboardShortcuts}
                onClose={() => setShowKeyboardShortcuts(false)}
            />
        </>
    );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;

