/**
 * Video Player Component (FSD Architecture)
 * Complete YouTube-like video player with Feature-Sliced Design
 */
import React, { useEffect, useState, useRef, useImperativeHandle, useCallback } from 'react';
import { FaCog, FaCheck } from 'react-icons/fa';
import { useFloating, offset, flip, shift, size, limitShift, autoUpdate } from '@floating-ui/react';
import Hls from 'hls.js';

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
    useVideoPlaybackState,
    useUIVisibilityState,
    useUserPreferencesState,
    useInteractionState,
    useUpNextState,
} from './hooks';
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

    // Grouped state management hooks
    const playback = useVideoPlaybackState();
    const ui = useUIVisibilityState(!autoPlay);
    const preferences = useUserPreferencesState();
    const interaction = useInteractionState();
    const upNext = useUpNextState();
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
        ui.setShowControls(true);
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying) {
                ui.setShowControls(false);
            }
        }, PLAYER_CONSTANTS.CONTROLS_AUTO_HIDE_DELAY);
    }, [isPlaying, ui]);

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
        playback.setCurrentTime(time);
    }, [playback]);

    const seekForward = useCallback((seconds = PLAYER_CONSTANTS.SEEK_SHORT) => {
        if (!videoRef.current) return;
        const newTime = Math.min(videoRef.current.currentTime + seconds, playback.duration);
        seekTo(newTime);
        showControlsTemporarily();
    }, [playback.duration, seekTo, showControlsTemporarily]);

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
        preferences.setVolume(vol);
        videoRef.current.volume = vol / 100;

        if (vol > 0 && preferences.isMuted) {
            preferences.setMuted(false);
            videoRef.current.muted = false;
        }

        // Show indicator immediately - the indicator will handle its own hide timer
        ui.setVolumeIndicatorVisible(true);
    }, [preferences, ui]);

    const increaseVolume = useCallback(() => {
        handleVolumeChange(preferences.volume + PLAYER_CONSTANTS.VOLUME_STEP);
    }, [preferences.volume, handleVolumeChange]);

    const decreaseVolume = useCallback(() => {
        handleVolumeChange(preferences.volume - PLAYER_CONSTANTS.VOLUME_STEP);
    }, [preferences.volume, handleVolumeChange]);

    const toggleMute = useCallback(() => {
        if (!videoRef.current) return;
        const newMuted = !preferences.isMuted;
        preferences.setMuted(newMuted);
        videoRef.current.muted = newMuted;
        showControlsTemporarily();
        ui.setVolumeIndicatorVisible(true);
    }, [preferences, ui, showControlsTemporarily]);

    // Playback rate
    const handlePlaybackRateChange = useCallback((rate) => {
        if (!videoRef.current) return;
        videoRef.current.playbackRate = rate;
        preferences.setPlaybackRate(rate);
        ui.setShowPlaybackRates(false);
        ui.setShowSettings(false);
    }, [preferences, ui]);

    // Quality switching
    const handleQualityChange = useCallback((quality) => {
        if (!videoRef.current) return;

        const currentTimeBeforeSwitch = videoRef.current.currentTime;
        const wasPlaying = !videoRef.current.paused;

        preferences.setSelectedQuality(quality);
        ui.setShowQualities(false);
        ui.setShowSettings(false);

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
        if (!progressBarRef.current || !playback.duration) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        updateProgressBarHover(e, rect, playback.duration, PLAYER_CONSTANTS.PROGRESS_BAR_PADDING, interaction.setHoverTime, interaction.setHoverPosition);
    }, [playback.duration, interaction]);

    const handleProgressMouseLeave = useCallback(() => {
        if (!interaction.isDragging) {
            interaction.clearHover();
        }
    }, [interaction]);

    const handleProgressMouseDown = useCallback((e) => {
        if (!videoRef.current || !playback.duration || !progressBarRef.current) return;
        e.preventDefault();
        interaction.startDrag(!videoRef.current.paused);
        isDraggingRef.current = true;

        const rect = progressBarRef.current.getBoundingClientRect();
        const { time } = getProgressBarPosition(e, rect, playback.duration, PLAYER_CONSTANTS.PROGRESS_BAR_PADDING);
        seekTo(time);
    }, [playback.duration, seekTo, interaction]);

    const handleProgressChange = useCallback((e) => {
        if (interaction.isDragging || !progressBarRef.current) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const { time } = getProgressBarPosition(e, rect, playback.duration, PLAYER_CONSTANTS.PROGRESS_BAR_PADDING);
        seekTo(time);
    }, [interaction.isDragging, playback.duration, seekTo]);

    // Touch handlers for progress bar (mobile support)
    const handleProgressTouchStart = useCallback((e) => {
        if (!videoRef.current || !playback.duration || !progressBarRef.current) return;
        // Note: Don't preventDefault here - React's onTouchStart is passive
        interaction.startDrag(!videoRef.current.paused);
        isDraggingRef.current = true;

        const touch = e.touches[0];
        const rect = progressBarRef.current.getBoundingClientRect();
        const touchEvent = { clientX: touch.clientX, clientY: touch.clientY };
        const { time } = getProgressBarPosition(touchEvent, rect, playback.duration, PLAYER_CONSTANTS.PROGRESS_BAR_PADDING);
        seekTo(time);
    }, [playback.duration, seekTo, interaction]);

    const handleProgressTouchMove = useCallback((e) => {
        if (!interaction.isDragging || !progressBarRef.current || !playback.duration) return;
        e.preventDefault();

        const touch = e.touches[0];
        const rect = progressBarRef.current.getBoundingClientRect();
        const touchEvent = { clientX: touch.clientX, clientY: touch.clientY };
        const time = updateProgressBarHover(touchEvent, rect, playback.duration, PLAYER_CONSTANTS.PROGRESS_BAR_PADDING, interaction.setHoverTime, interaction.setHoverPosition);

        if (videoRef.current) {
            seekTo(time);
        }
    }, [interaction, playback.duration, seekTo]);

    const handleProgressTouchEnd = useCallback(() => {
        if (!interaction.isDragging) return;
        interaction.endDrag();
        isDraggingRef.current = false;
    }, [interaction]);


    // Handle seek overlay animation end
    const handleSeekOverlayEnd = useCallback(() => {
        interaction.setSeekOverlay({ visible: false });
    }, [interaction]);

    // Handle volume indicator hide
    const handleVolumeIndicatorHide = useCallback(() => {
        ui.setVolumeIndicatorVisible(false);
    }, [ui]);


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
        onShowHelp: () => ui.setShowKeyboardShortcuts(!ui.showKeyboardShortcuts),
        onEscape: () => ui.setShowKeyboardShortcuts(false),
    }, true);

    // Video events
    useVideoEvents(videoRef, {
        onLoadedMetadata: () => {
            const video = videoRef.current;
            if (!video) return;

            playback.setDuration(video.duration);
            playback.setIsVideoLoading(false);
            sendPlayerEvent(PLAYER_EVENTS.LOADED_METADATA);

            // Show controls once metadata is loaded (only if NOT autoPlay)
            // If autoPlay, controls will show on mouse move or when user interacts
            if (!autoPlay) {
                ui.setShowControls(true);
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
            playback.setIsVideoLoading(false);
            playback.setIsVideoBuffering(false);
        },
        onTimeUpdate: () => {
            const video = videoRef.current;
            if (!video) return;

            const time = video.currentTime;
            playback.setCurrentTime(time);

            // Don't save position while dragging - only during normal playback
            // Use ref to avoid recreating this callback on every drag state change
            if (!isDraggingRef.current) {
                saveVideoPosition(time);
            }

            // If we're getting time updates, we're not buffering
            if (playback.isVideoBuffering) {
                playback.setIsVideoBuffering(false);
            }

            if (onTimeUpdate) {
                onTimeUpdate(time);
            }
        },
        onPlay: () => {
            playback.setIsVideoPlaying(true);
            playback.setIsVideoBuffering(false);
            sendPlayerEvent(PLAYER_EVENTS.PLAY);
        },
        onPause: () => {
            playback.setIsVideoPlaying(false);
            sendPlayerEvent(PLAYER_EVENTS.PAUSE);
        },
        onWaiting: () => {
            playback.setIsVideoBuffering(true);
            sendPlayerEvent(PLAYER_EVENTS.WAITING);
        },
        onCanPlay: () => {
            playback.setIsVideoBuffering(false);
            playback.setIsVideoLoading(false);
            sendPlayerEvent(PLAYER_EVENTS.CAN_PLAY);
        },
        onCanPlayThrough: () => {
            playback.setIsVideoBuffering(false);
            playback.setIsVideoLoading(false);
        },
        onSeeking: () => {
            playback.setIsVideoBuffering(true);
            sendPlayerEvent(PLAYER_EVENTS.SEEK);
        },
        onSeeked: () => {
            playback.setIsVideoBuffering(false);
            sendPlayerEvent(PLAYER_EVENTS.SEEKED);
        },
        onEnded: () => {
            playback.setIsVideoPlaying(false);
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
            playback.setIsVideoLoading(false);
            playback.setIsVideoBuffering(false);
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

    // HLS instance ref
    const hlsRef = useRef(null);

    // Source changes with HLS.js support
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Reset loading states when source changes
        playback.setIsVideoLoading(true);
        playback.setIsVideoBuffering(false);
        playback.setIsVideoPlaying(false);

        // Cleanup previous HLS instance
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        // Check if source is HLS (.m3u8)
        const isHLS = src && (src.endsWith('.m3u8') || src.includes('.m3u8'));

        if (isHLS && Hls.isSupported()) {
            // Convert relative URL to absolute if needed
            let hlsSrc = src;
            if (src.startsWith('/')) {
                // Use current origin for relative URLs
                hlsSrc = `${window.location.origin}${src}`;
            }

            // Use HLS.js for HLS streams
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: false,
                backBufferLength: 90,
                maxBufferLength: 30,
                maxMaxBufferLength: 600,
                maxBufferSize: 60 * 1000 * 1000, // 60MB
                maxBufferHole: 0.5,
                highBufferWatchdogPeriod: 2,
                nudgeOffset: 0.1,
                nudgeMaxRetry: 3,
                maxFragLoadingTimeOut: 20000,
                startFragPrefetch: true,
                testBandwidth: true,
                progressive: false,
                debug: false,
                // Custom loader to proxy all requests through our server
                loader: class CustomLoader extends Hls.DefaultConfig.loader {
                    constructor(config) {
                        super(config);
                    }

                    load(context, config, callbacks) {
                        // If the URL is from Backblaze B2, proxy it through our server
                        if (context.url && context.url.includes('backblazeb2.com')) {
                            // Extract the storage key from the B2 URL
                            const urlMatch = context.url.match(/\/file\/[^/]+\/(.+)$/);
                            if (urlMatch) {
                                const storageKey = urlMatch[1];
                                // Use our streaming endpoint
                                context.url = `${window.location.origin}/video?file=${encodeURIComponent(storageKey)}`;
                            }
                        } else if (context.url && !context.url.startsWith('http')) {
                            // Handle relative URLs in playlist - resolve them relative to the current playlist URL
                            if (context.url.includes('.ts') || context.url.includes('.m3u8')) {
                                // If it's a relative path (starts with ./ or just a filename)
                                if (context.url.startsWith('./') || (!context.url.startsWith('/') && !context.url.startsWith('http'))) {
                                    // Get the current playlist URL from the response URL or referrer
                                    const currentUrl = context.responseURL || hlsSrc || window.location.href;

                                    // Extract the file parameter from the current URL
                                    const currentUrlObj = new URL(currentUrl);
                                    const currentFile = currentUrlObj.searchParams.get('file');

                                    if (currentFile) {
                                        // Remove ./ prefix if present
                                        let segmentName = context.url;
                                        if (segmentName.startsWith('./')) {
                                            segmentName = segmentName.substring(2);
                                        }

                                        // Construct the storage key based on the current playlist's directory
                                        const currentDir = currentFile.includes('/')
                                            ? currentFile.substring(0, currentFile.lastIndexOf('/'))
                                            : '';

                                        const segmentKey = currentDir
                                            ? `${currentDir}/${segmentName}`
                                            : segmentName;

                                        // Use our streaming endpoint
                                        context.url = `${window.location.origin}/video?file=${encodeURIComponent(segmentKey)}`;
                                    } else {
                                        // Fallback: try to resolve as absolute path
                                        const urlObj = new URL(context.url, currentUrl);
                                        if (urlObj.hostname === window.location.hostname) {
                                            context.url = urlObj.pathname + urlObj.search;
                                        }
                                    }
                                } else if (context.url.startsWith('/')) {
                                    // Absolute path on our server
                                    context.url = `${window.location.origin}${context.url}`;
                                }
                            }
                        }
                        // Call parent loader
                        return super.load(context, config, callbacks);
                    }
                }
            });

            hlsRef.current = hls;

            hls.loadSource(hlsSrc);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                playback.setIsVideoLoading(false);
                if (autoPlay) {
                    const playPromise = video.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(() => {
                            // Autoplay was prevented
                        });
                    }
                }
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.error('HLS network error, trying to recover...');
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.error('HLS media error, trying to recover...');
                            hls.recoverMediaError();
                            break;
                        default:
                            console.error('HLS fatal error, destroying instance');
                            hls.destroy();
                            hlsRef.current = null;
                            playback.setIsVideoLoading(false);
                            if (onError) {
                                onError();
                            }
                            break;
                    }
                }
            });

            // Cleanup on unmount
            return () => {
                if (hlsRef.current) {
                    hlsRef.current.destroy();
                    hlsRef.current = null;
                }
            };
        } else if (isHLS && video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            video.src = src;
            video.load();
            if (autoPlay) {
                const playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(() => {
                        // Autoplay was prevented
                    });
                }
            }
        } else {
            // Standard MP4 or other formats
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
        }
    }, [src, autoPlay, onError]);

    // Drag handling (mouse and touch)
    useEffect(() => {
        if (!interaction.isDragging) return;

        const handleMouseMove = (e) => {
            if (!progressBarRef.current || !playback.duration) return;

            const rect = progressBarRef.current.getBoundingClientRect();
            const time = updateProgressBarHover(e, rect, playback.duration, PLAYER_CONSTANTS.PROGRESS_BAR_PADDING, interaction.setHoverTime, interaction.setHoverPosition);

            if (videoRef.current) {
                seekTo(time);
            }
        };

        const handleTouchMove = (e) => {
            if (!progressBarRef.current || !playback.duration) return;

            const touch = e.touches[0];
            const rect = progressBarRef.current.getBoundingClientRect();
            const touchEvent = { clientX: touch.clientX, clientY: touch.clientY };
            const time = updateProgressBarHover(touchEvent, rect, playback.duration, PLAYER_CONSTANTS.PROGRESS_BAR_PADDING, interaction.setHoverTime, interaction.setHoverPosition);

            if (videoRef.current) {
                seekTo(time);
            }
        };

        const handleMouseUp = () => {
            interaction.endDrag();
            isDraggingRef.current = false;
        };

        const handleTouchEnd = () => {
            interaction.endDrag();
            isDraggingRef.current = false;
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
    }, [interaction.isDragging, playback.duration, seekTo, interaction]);

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
            upNext.startCountdown(countdown);

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
                    upNext.stopCountdown();
                    if (onNext) {
                        onNext();
                    }
                } else {
                    upNext.setCountdown(countdown);
                }
            }, 1000);
        }
    }, [nextVideo, onNext, isFullscreen, canPlayNext, upNext]);

    // Handle Up Next actions
    const handleUpNextPlayNow = useCallback(() => {
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
        upNext.stopCountdown();
        if (onNext) {
            onNext();
        }
    }, [onNext, upNext]);

    const handleUpNextCancel = useCallback(() => {
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
        upNext.stopCountdown();
    }, [upNext]);

    // Close settings dropdown when clicking outside
    useEffect(() => {
        if (!ui.showSettings) return;

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
                ui.closeSettings();
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
    }, [ui.showSettings, floatingRefs, ui]);

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
    const progressPercentage = playback.duration > 0 ? (playback.currentTime / playback.duration) * 100 : 0;


    return (
        <>
            <div
                ref={containerRef}
                className={`${styles.player} video-player-substrate ${isFullscreen ? 'fullscreen' : ''} ${className}`}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => {
                    if (isPlaying) ui.setShowControls(false);
                    ui.closeAll();
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
                    showControls={ui.showControls}
                    onShowControls={showControlsTemporarily}
                    onSeekFeedback={(direction, count, x, y) => {
                        interaction.setSeekOverlay({
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
                    direction={interaction.seekOverlay.direction}
                    amount={PLAYER_CONSTANTS.SEEK_LONG}
                    count={interaction.seekOverlay.count}
                    visible={interaction.seekOverlay.visible}
                    x={interaction.seekOverlay.x}
                    y={interaction.seekOverlay.y}
                    onAnimationEnd={handleSeekOverlayEnd}
                />

                {/* Buffering Overlay */}
                <BufferingOverlay visible={playback.isVideoBuffering} />

                {/* Volume Indicator */}
                <VolumeIndicator
                    volume={preferences.volume}
                    muted={preferences.isMuted}
                    visible={ui.volumeIndicatorVisible}
                    onHide={handleVolumeIndicatorHide}
                />

                {/* Up Next Overlay (only in fullscreen with countdown) */}
                {upNext.upNextCountdown !== null && upNext.showUpNext && isFullscreen && (
                    <UpNextOverlay
                        visible={true}
                        countdown={upNext.upNextCountdown}
                        nextVideo={nextVideo}
                        onCancel={handleUpNextCancel}
                        onPlayNow={handleUpNextPlayNow}
                    />
                )}

                {/* Large Play Button Overlay - Show when paused and not buffering/loading */}
                {!playback.isVideoPlaying && !playback.isVideoBuffering && !playback.isVideoLoading && (
                    <div className={styles.playOverlay}>
                        <div className={styles.playButtonLarge}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        </div>
                    </div>
                )}

                {/* Loading Indicator - Show only during initial load */}
                {playback.isVideoLoading && (
                    <div className={styles.loadingIndicator}>
                        <Spinner />
                    </div>
                )}

                {/* Controls */}
                <div className={`${styles.videoControls} ${ui.showControls ? styles.show : ''}`}>
                    {/* Progress Bar */}
                    <div
                        className={`${styles.progressBarContainer} ${interaction.isDragging ? styles.dragging : ''}`}
                        ref={progressBarRef}
                        onClick={handleProgressChange}
                        onMouseMove={handleProgressMouseMove}
                        onMouseLeave={handleProgressMouseLeave}
                        onMouseDown={handleProgressMouseDown}
                        onTouchStart={handleProgressTouchStart}
                        onTouchEnd={handleProgressTouchEnd}
                    >
                        {/* Time preview tooltip */}
                        {(interaction.hoverTime !== null || interaction.isDragging) && (
                            <Tooltip x={interaction.hoverPosition} y={32} visible={true}>
                                {formatTime(interaction.hoverTime || 0)}
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
                            {(interaction.hoverTime !== null || interaction.isDragging) && (
                                <div
                                    className={styles.progressBarPreview}
                                    style={{
                                        left: `${interaction.hoverPosition}px`,
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
                                volume={preferences.volume}
                                muted={preferences.isMuted}
                                onVolumeChange={handleVolumeChange}
                                onMuteToggle={toggleMute}
                                onExpandChange={ui.setVolumeSliderExpanded}
                            />

                            {/* Time Display */}
                            <TimeDisplay
                                currentTime={playback.currentTime}
                                duration={playback.duration}
                                collapsed={ui.volumeSliderExpanded}
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
                                        ui.setShowSettings(!ui.showSettings);
                                    }}
                                    type="button"
                                >
                                    <FaCog />
                                </button>

                                {ui.showSettings && (
                                    <div
                                        ref={floatingRefs.setFloating}
                                        className={styles.settingsDropdown}
                                        style={floatingStyles}
                                        onClick={(e) => e.stopPropagation()}
                                        onTouchStart={(e) => e.stopPropagation()}
                                    >
                                        {!ui.showPlaybackRates && !ui.showQualities && (
                                            <>
                                                <div
                                                    className={styles.settingsItem}
                                                    onClick={() => ui.setShowPlaybackRates(true)}
                                                >
                                                    <span>Playback speed</span>
                                                    <span>{preferences.playbackRate === 1 ? 'Normal' : `${preferences.playbackRate}x`}</span>
                                                </div>
                                                {qualities && qualities.length > 0 && (
                                                    <div
                                                        className={styles.settingsItem}
                                                        onClick={() => ui.setShowQualities(true)}
                                                    >
                                                        <span>Quality</span>
                                                        <span>{preferences.selectedQuality?.label || 'Auto'}</span>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {ui.showPlaybackRates && (
                                            <div className={styles.settingsSubmenu}>
                                                <div
                                                    className={styles.settingsBack}
                                                    onClick={() => ui.setShowPlaybackRates(false)}
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
                                                        {preferences.playbackRate === rate && <FaCheck />}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {ui.showQualities && (
                                            <div className={styles.settingsSubmenu}>
                                                <div
                                                    className={styles.settingsBack}
                                                    onClick={() => ui.setShowQualities(false)}
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
                                                        {preferences.selectedQuality?.id === quality.id && <FaCheck />}
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
                show={ui.showKeyboardShortcuts}
                onClose={() => ui.setShowKeyboardShortcuts(false)}
            />
        </>
    );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;

