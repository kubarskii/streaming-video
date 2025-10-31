// Shared UI: Video Player Component
import React, { useEffect, useState, useRef, useImperativeHandle } from 'react';
import {
    FaPlay,
    FaPause,
    FaVolumeUp,
    FaVolumeDown,
    FaVolumeMute,
    FaExpand,
    FaCompress,
    FaCog,
    FaCheck,
    FaStepBackward,
    FaStepForward,
} from 'react-icons/fa';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import './VideoPlayer.css';

export const VideoPlayer = React.forwardRef(({
    src,
    poster,
    title,
    videoId,
    autoPlay = false,
    onTimeUpdate,
    onEnded,
    onError,
    primaryColor = '#ff0000',
    qualities = [],
    onQualityChange,
    className = '',
    mimeType,
    onAmbientUpdate,
    onNext,
    onPrevious,
    canPlayNext = true,
    canPlayPrevious = true,
}, ref) => {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const controlsTimeoutRef = useRef(null);
    const progressBarRef = useRef(null);
    const ambientIntervalRef = useRef(null);
    const lastSavedTimeRef = useRef(0);
    const hasRestoredPositionRef = useRef(false);
    const saveIntervalRef = useRef(null);
    const pendingRestorePositionRef = useRef(null);
    const tapTimeoutRef = useRef(null);
    const lastTouchTimeRef = useRef(0);
    const lastTapTimeRef = useRef(0);

    // Constants
    const DOUBLE_CLICK_DELAY = 50; // ms to wait for double-click/tap detection
    const DOUBLE_TAP_THRESHOLD = 300; // ms window for detecting second tap
    const GHOST_CLICK_THRESHOLD = 300; // ms to ignore click after touch

    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(100);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [isBuffering, setIsBuffering] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [showPlaybackRates, setShowPlaybackRates] = useState(false);
    const [showQualities, setShowQualities] = useState(false);
    const [selectedQuality, setSelectedQuality] = useState(null);
    const [isReady, setIsReady] = useState(false);
    const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [hoverTime, setHoverTime] = useState(null);
    const [hoverPosition, setHoverPosition] = useState(0);
    const [wasPlayingBeforeDrag, setWasPlayingBeforeDrag] = useState(false);

    const playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

    // Debug: Log videoId changes
    useEffect(() => {
        console.log('[VideoPlayer] videoId changed to:', videoId);
    }, [videoId]);

    // Save/restore video position functions
    const getStorageKey = () => videoId ? `video_position_${videoId}` : null;

    const saveVideoPosition = (time) => {
        const key = getStorageKey();
        // if (!key || !time || time < 5) return; // Don't save if less than 5 seconds

        // Only save if at least 1 second has passed since last save (throttle)
        if (Math.abs(time - lastSavedTimeRef.current) < 1) return;

        lastSavedTimeRef.current = time;
        try {
            localStorage.setItem(key, time.toString());
        } catch (err) {
            console.error('Failed to save video position:', err);
        }
    };

    const restoreVideoPosition = () => {
        const key = getStorageKey();
        console.log('[VideoPlayer] Attempting to restore position, key:', key, 'hasRestored:', hasRestoredPositionRef.current);

        if (!key) {
            console.log('[VideoPlayer] No storage key - videoId missing?');
            return null;
        }

        if (hasRestoredPositionRef.current) {
            console.log('[VideoPlayer] Already restored, skipping');
            return null;
        }

        try {
            const savedPosition = localStorage.getItem(key);
            console.log('[VideoPlayer] Saved position from storage:', savedPosition);

            if (savedPosition) {
                const position = parseFloat(savedPosition);
                if (!isNaN(position) && position > 0) {
                    hasRestoredPositionRef.current = true;
                    console.log('[VideoPlayer] Will restore position:', position);
                    return position;
                }
            }
        } catch (err) {
            console.error('Failed to restore video position:', err);
        }

        console.log('[VideoPlayer] No valid position to restore');
        return null;
    };

    const clearVideoPosition = () => {
        const key = getStorageKey();
        if (!key) return;

        try {
            localStorage.removeItem(key);
        } catch (err) {
            console.error('Failed to clear video position:', err);
        }
    };

    // Load saved position when videoId changes
    useEffect(() => {
        console.log('[VideoPlayer] videoId changed, loading saved position for:', videoId);
        hasRestoredPositionRef.current = false;
        pendingRestorePositionRef.current = null;

        if (videoId) {
            const key = `video_position_${videoId}`;
            try {
                const savedPosition = localStorage.getItem(key);
                if (savedPosition) {
                    const position = parseFloat(savedPosition);
                    if (!isNaN(position) && position > 5) {
                        pendingRestorePositionRef.current = position;
                        console.log('[VideoPlayer] Pending restore position:', position);
                    }
                }
            } catch (err) {
                console.error('Failed to load saved position:', err);
            }
        }
    }, [videoId]);

    // Aggressive position saving - update every second while playing
    useEffect(() => {
        if (!videoId) return;

        // Clear any existing interval
        if (saveIntervalRef.current) {
            clearInterval(saveIntervalRef.current);
            saveIntervalRef.current = null;
        }

        // Start interval if playing
        if (isPlaying && videoRef.current) {
            console.log('[VideoPlayer] Starting save interval');
            saveIntervalRef.current = setInterval(() => {
                if (videoRef.current && videoId) {
                    const time = videoRef.current.currentTime;
                    // if (time > 5) {
                    const key = `video_position_${videoId}`;
                    try {
                        localStorage.setItem(key, time.toString());
                        console.log(`[VideoPlayer] Auto-saved position: ${time.toFixed(1)}s`);
                    } catch (err) {
                        console.error('Failed to save position:', err);
                    }
                    // }
                }
            }, 1000); // Save every second
        } else if (!isPlaying) {
            console.log('[VideoPlayer] Stopped save interval (paused)');
        }

        return () => {
            if (saveIntervalRef.current) {
                clearInterval(saveIntervalRef.current);
                saveIntervalRef.current = null;
            }
        };
    }, [isPlaying, videoId]);

    // Save position on page unload (refresh/close) or component unmount
    useEffect(() => {
        if (!videoId) return;

        const storageKey = `video_position_${videoId}`;

        const saveOnUnload = () => {
            const video = videoRef.current;
            if (video) {
                const time = video.currentTime;
                // if (time > 5) {
                try {
                    localStorage.setItem(storageKey, time.toString());
                } catch (err) {
                    // Silent fail on unload to not block
                }
                // }
            }
        };

        // beforeunload for desktop browsers
        window.addEventListener('beforeunload', saveOnUnload);
        // pagehide for mobile browsers (more reliable on iOS/Safari)
        window.addEventListener('pagehide', saveOnUnload);
        // visibilitychange as backup
        document.addEventListener('visibilitychange', saveOnUnload);

        return () => {
            // Save on unmount (when navigating away within the app)
            saveOnUnload();
            window.removeEventListener('beforeunload', saveOnUnload);
            window.removeEventListener('pagehide', saveOnUnload);
            document.removeEventListener('visibilitychange', saveOnUnload);
        };
    }, [videoId]);

    useEffect(() => {
        if (videoRef.current && autoPlay) {
            videoRef.current.play().catch(err => {
                console.log('Autoplay prevented:', err);
                setIsPlaying(false);
            });
        }
    }, [autoPlay]);

    // Handle src changes (for quality switching)
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        console.log('[VideoPlayer] Source changed, reloading video');
        // When src changes, reload the video and optionally auto-play
        video.load();

        if (autoPlay) {
            const playPromise = video.play();
            if (playPromise && typeof playPromise.then === 'function') {
                playPromise
                    .then(() => {
                        setIsPlaying(true);
                    })
                    .catch(err => {
                        console.log('Autoplay prevented after source change:', err);
                        setIsPlaying(false);
                    });
            }
        } else {
            setIsPlaying(false);
        }
    }, [src, autoPlay]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleLoadedMetadata = () => {
            console.log('[VideoPlayer] Loaded metadata, duration:', video.duration, 'videoId:', videoId);
            setDuration(video.duration);
            setIsReady(true);

            // Try to restore position
            tryRestorePosition();
        };

        const tryRestorePosition = () => {
            // Restore pending position if available
            const pendingPosition = pendingRestorePositionRef.current;
            console.log('[VideoPlayer] tryRestorePosition - pending:', pendingPosition, 'duration:', video.duration, 'hasRestored:', hasRestoredPositionRef.current);

            if (pendingPosition && video.duration && pendingPosition < video.duration - 5 && !hasRestoredPositionRef.current) {
                console.log(`[VideoPlayer] Restoring to ${pendingPosition.toFixed(1)}s`);
                video.currentTime = pendingPosition;
                hasRestoredPositionRef.current = true;
                pendingRestorePositionRef.current = null;
                console.log(`[VideoPlayer] ✅ Successfully restored to ${pendingPosition.toFixed(1)}s`);
            } else if (pendingPosition) {
                console.log('[VideoPlayer] ❌ Cannot restore - duration:', video.duration, 'tooCloseToEnd:', pendingPosition >= video.duration - 5, 'alreadyRestored:', hasRestoredPositionRef.current);
            } else {
                console.log('[VideoPlayer] ℹ️ No pending position to restore');
            }
        };

        const handleLoadedData = () => {
            console.log('[VideoPlayer] Loaded data (backup restore attempt)');
            // Backup: try to restore again if it didn't work in loadedmetadata
            if (pendingRestorePositionRef.current && !hasRestoredPositionRef.current) {
                console.log('[VideoPlayer] Metadata restore missed, trying again in loadeddata');
                tryRestorePosition();
            }
        };

        const handleTimeUpdate = () => {
            const time = video.currentTime;
            setCurrentTime(time);
            setIsBuffering(false);

            // Try to restore position on first timeupdate if not done yet
            if (pendingRestorePositionRef.current && !hasRestoredPositionRef.current && video.duration) {
                const pendingPosition = pendingRestorePositionRef.current;
                if (pendingPosition < video.duration - 5) {
                    console.log('[VideoPlayer] Restoring on timeupdate:', pendingPosition);
                    video.currentTime = pendingPosition;
                    hasRestoredPositionRef.current = true;
                    pendingRestorePositionRef.current = null;
                }
            }

            // Save position periodically
            saveVideoPosition(time);

            if (onTimeUpdate) {
                onTimeUpdate(time);
            }
        };

        const handleWaiting = () => {
            setIsBuffering(true);
        };

        const handlePlaying = () => {
            setIsBuffering(false);
        };

        const handleEnded = () => {
            setIsPlaying(false);
            // Clear saved position when video completes
            clearVideoPosition();
            if (onEnded) {
                onEnded();
            }
        };

        const handleError = () => {
            if (onError) {
                onError();
            }
        };

        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('loadeddata', handleLoadedData);
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('waiting', handleWaiting);
        video.addEventListener('playing', handlePlaying);
        video.addEventListener('ended', handleEnded);
        video.addEventListener('error', handleError);

        return () => {
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('loadeddata', handleLoadedData);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('waiting', handleWaiting);
            video.removeEventListener('playing', handlePlaying);
            video.removeEventListener('ended', handleEnded);
            video.removeEventListener('error', handleError);
        };
    }, [onTimeUpdate, onEnded, onError, videoId]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            // Cleanup tap timeout on unmount
            if (tapTimeoutRef.current) {
                clearTimeout(tapTimeoutRef.current);
            }
        };
    }, []);

    const togglePlayPause = () => {
        if (!videoRef.current) return;

        if (videoRef.current.paused) {
            videoRef.current.play();
            setIsPlaying(true);
        } else {
            // Save position immediately when pausing
            if (videoId) {
                const key = `video_position_${videoId}`;
                try {
                    localStorage.setItem(key, videoRef.current.currentTime.toString());
                } catch (err) {
                    console.error('Failed to save on pause:', err);
                }
            }
            videoRef.current.pause();
            setIsPlaying(false);
        }
        showControlsTemporarily();
    };

    const handleVideoTouch = (e) => {
        const now = Date.now();
        const timeSinceLastTap = now - lastTapTimeRef.current;

        // Set timestamp for ghost click prevention
        lastTouchTimeRef.current = now;

        // Check for double-tap (within 300ms window)
        if (timeSinceLastTap < DOUBLE_TAP_THRESHOLD && timeSinceLastTap > 0) {
            // Double-tap detected → go fullscreen immediately
            if (tapTimeoutRef.current) {
                clearTimeout(tapTimeoutRef.current);
                tapTimeoutRef.current = null;
            }
            toggleFullscreen();
            lastTapTimeRef.current = 0; // Reset to prevent triple-tap issues
            return;
        }

        // Single tap → wait briefly (50ms) to see if a second tap is coming
        lastTapTimeRef.current = now;

        if (tapTimeoutRef.current) {
            clearTimeout(tapTimeoutRef.current);
        }

        tapTimeoutRef.current = setTimeout(() => {
            // Single tap confirmed → show controls (if hidden)
            // If controls are visible, do nothing (they'll auto-hide)
            if (!showControls) {
                showControlsTemporarily();
            }
            tapTimeoutRef.current = null;
        }, DOUBLE_CLICK_DELAY); // Use 50ms delay for execution
    };

    const handleVideoClick = (e) => {
        // Prevent ghost clicks from touch events
        const timeSinceTouch = Date.now() - lastTouchTimeRef.current;
        if (timeSinceTouch < GHOST_CLICK_THRESHOLD) {
            return;
        }

        // Mouse click: wait briefly to detect double-click
        if (tapTimeoutRef.current) {
            clearTimeout(tapTimeoutRef.current);
            tapTimeoutRef.current = null;
        }

        tapTimeoutRef.current = setTimeout(() => {
            togglePlayPause();
            tapTimeoutRef.current = null;
        }, DOUBLE_CLICK_DELAY);
    };

    const handleVideoDoubleClick = (e) => {
        // Cancel pending single-click action
        if (tapTimeoutRef.current) {
            clearTimeout(tapTimeoutRef.current);
            tapTimeoutRef.current = null;
        }
        // Toggle fullscreen immediately
        toggleFullscreen();
    };

    const handleNextVideo = () => {
        if (onNext && canPlayNext) {
            onNext();
            showControlsTemporarily();
        }
    };

    const handlePreviousVideo = () => {
        if (onPrevious && canPlayPrevious) {
            onPrevious();
            showControlsTemporarily();
        }
    };

    const seekTo = (time) => {
        if (!videoRef.current) return;
        videoRef.current.currentTime = time;
        setCurrentTime(time);
    };

    const seekForward = (seconds = 5) => {
        if (!videoRef.current) return;
        const newTime = Math.min(videoRef.current.currentTime + seconds, duration);
        seekTo(newTime);
        showControlsTemporarily();
    };

    const seekBackward = (seconds = 5) => {
        if (!videoRef.current) return;
        const newTime = Math.max(videoRef.current.currentTime - seconds, 0);
        seekTo(newTime);
        showControlsTemporarily();
    };

    const calculateTimeFromPosition = (clientX) => {
        if (!progressBarRef.current || !duration) return 0;
        const rect = progressBarRef.current.getBoundingClientRect();
        const padding = 12; // padding from CSS
        const effectiveWidth = rect.width - (padding * 2);
        const pos = Math.max(0, Math.min(1, (clientX - rect.left - padding) / effectiveWidth));
        return pos * duration;
    };

    const handleProgressMouseMove = (e) => {
        if (!progressBarRef.current || !duration) return;
        const time = calculateTimeFromPosition(e.clientX);
        setHoverTime(time);

        const rect = progressBarRef.current.getBoundingClientRect();
        const padding = 12; // padding from CSS
        // Calculate position relative to container (raw mouse position)
        // debugger
        const pixelPos = Math.max(padding, Math.min(rect.width - padding, e.clientX - rect.left - padding));
        setHoverPosition(pixelPos);
    };

    const handleProgressMouseLeave = () => {
        if (!isDragging) {
            setHoverTime(null);
            setHoverPosition(0);
        }
    };

    const handleProgressMouseDown = (e) => {
        if (!videoRef.current || !duration) return;
        e.preventDefault();
        setIsDragging(true);
        setWasPlayingBeforeDrag(!videoRef.current.paused);

        const time = calculateTimeFromPosition(e.clientX);
        setHoverTime(time);

        const rect = progressBarRef.current.getBoundingClientRect();
        const padding = 12; // padding from CSS
        const pixelPos = Math.max(padding, Math.min(rect.width - padding, e.clientX - rect.left - padding));
        setHoverPosition(pixelPos);

        // Update video time immediately
        seekTo(time);
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging || !progressBarRef.current || !duration) return;

            const time = calculateTimeFromPosition(e.clientX);
            setHoverTime(time);

            const rect = progressBarRef.current.getBoundingClientRect();
            const padding = 12; // padding from CSS
            const pixelPos = Math.max(padding, Math.min(rect.width - padding, e.clientX - rect.left - padding));
            setHoverPosition(pixelPos);

            // Update video time while dragging
            if (videoRef.current) {
                const wasPlaying = !videoRef.current.paused;
                seekTo(time);

                // Resume playback if it was playing before (video continues during drag)
                if (wasPlaying && videoRef.current.paused) {
                    videoRef.current.play().catch(() => {
                        setIsPlaying(false);
                    });
                }
            }
        };

        const handleMouseUp = () => {
            if (!isDragging) return;

            setIsDragging(false);

            // Keep video playing if it was playing before drag (video continues during drag)

            // Clear hover immediately
            setHoverTime(null);
            setHoverPosition(0);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, duration, wasPlayingBeforeDrag]);

    const handleProgressChange = (e) => {
        // Only handle click if not dragging
        if (isDragging) return;

        const time = calculateTimeFromPosition(e.clientX);
        seekTo(time);
    };

    const handleVolumeChange = (newVolume) => {
        if (!videoRef.current) return;
        const vol = Math.max(0, Math.min(100, newVolume));
        setVolume(vol);
        videoRef.current.volume = vol / 100;
        if (vol > 0 && isMuted) {
            setIsMuted(false);
            videoRef.current.muted = false;
        }
    };

    const increaseVolume = () => {
        handleVolumeChange(volume + 5);
    };

    const decreaseVolume = () => {
        handleVolumeChange(volume - 5);
    };

    const toggleMute = () => {
        if (!videoRef.current) return;
        const newMuted = !isMuted;
        setIsMuted(newMuted);
        videoRef.current.muted = newMuted;
        showControlsTemporarily();
    };

    const toggleFullscreen = () => {
        if (!containerRef.current) return;

        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
        showControlsTemporarily();
    };

    const handlePlaybackRateChange = (rate) => {
        if (!videoRef.current) return;
        videoRef.current.playbackRate = rate;
        setPlaybackRate(rate);
        setShowPlaybackRates(false);
        setShowSettings(false);
    };

    const handleQualityChange = (quality) => {
        if (!videoRef.current) return;

        // Store current playback state
        const currentTimeBeforeSwitch = videoRef.current.currentTime;
        const wasPlaying = !videoRef.current.paused;

        setSelectedQuality(quality);
        setShowQualities(false);
        setShowSettings(false);

        if (onQualityChange) {
            // Set up one-time event listener for when new quality loads
            const handleLoadedData = () => {
                if (videoRef.current) {
                    // Seek to the same position
                    videoRef.current.currentTime = currentTimeBeforeSwitch;

                    // Resume playback if it was playing
                    if (wasPlaying) {
                        videoRef.current.play().catch(err => {
                            console.log('Failed to resume playback:', err);
                            setIsPlaying(false);
                        });
                    } else {
                        setIsPlaying(false);
                    }
                }
                videoRef.current?.removeEventListener('loadeddata', handleLoadedData);
            };

            videoRef.current.addEventListener('loadeddata', handleLoadedData);

            // Trigger the quality change (which will update src and reload video)
            onQualityChange(quality);
        }
    };

    const showControlsTemporarily = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying) {
                setShowControls(false);
            }
        }, 3000);
    };

    const handleMouseMove = () => {
        showControlsTemporarily();
    };

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
        showControls: showControlsTemporarily,
    }));

    // Keyboard shortcuts handler
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (!videoRef.current) return;

            // Don't handle keyboard shortcuts when typing in input fields or when dragging
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
                return;
            }

            // Don't handle shortcuts while dragging
            if (isDragging) {
                return;
            }

            const key = e.key.toLowerCase();
            const code = e.code.toLowerCase();

            // Handle arrow keys by code (more reliable)
            if (code === 'arrowleft' || key === 'arrowleft') {
                e.preventDefault();
                seekBackward();
                return;
            }
            if (code === 'arrowright' || key === 'arrowright') {
                e.preventDefault();
                seekForward();
                return;
            }
            if (code === 'arrowup' || key === 'arrowup') {
                e.preventDefault();
                increaseVolume();
                return;
            }
            if (code === 'arrowdown' || key === 'arrowdown') {
                e.preventDefault();
                decreaseVolume();
                return;
            }

            switch (key) {
                case ' ':
                    e.preventDefault();
                    togglePlayPause();
                    break;
                case 'k':
                    e.preventDefault();
                    togglePlayPause();
                    break;
                case 'f':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case 'm':
                    e.preventDefault();
                    toggleMute();
                    break;
                case 'j':
                    e.preventDefault();
                    seekBackward(10);
                    break;
                case 'l':
                    e.preventDefault();
                    seekForward(10);
                    break;
                case 'n':
                    if (onNext && canPlayNext) {
                        e.preventDefault();
                        handleNextVideo();
                    }
                    break;
                case 'p':
                    if (onPrevious && canPlayPrevious) {
                        e.preventDefault();
                        handlePreviousVideo();
                    }
                    break;
                case '?':
                    e.preventDefault();
                    setShowKeyboardShortcuts(!showKeyboardShortcuts);
                    break;
                case 'escape':
                    if (showKeyboardShortcuts) {
                        e.preventDefault();
                        setShowKeyboardShortcuts(false);
                    }
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => {
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, [showKeyboardShortcuts, onNext, onPrevious, canPlayNext, canPlayPrevious, isDragging, togglePlayPause, seekBackward, seekForward, increaseVolume, decreaseVolume, toggleMute, toggleFullscreen, handleNextVideo, handlePreviousVideo]);

    const formatTime = (seconds) => {
        if (isNaN(seconds)) return '0:00';
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getVolumeIcon = () => {
        if (isMuted || volume === 0) return <FaVolumeMute />;
        if (volume < 50) return <FaVolumeDown />;
        return <FaVolumeUp />;
    };

    const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

    // Detect MIME type from file extension if not provided
    const detectMimeType = (url) => {
        if (!url) return 'video/mp4';
        const ext = url.split('.').pop()?.toLowerCase();
        const mimeTypes = {
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'ogg': 'video/ogg',
            'mov': 'video/quicktime',
            'avi': 'video/x-msvideo',
            'mkv': 'video/x-matroska',
        };
        return mimeTypes[ext] || 'video/mp4';
    };

    const videoMimeType = mimeType || detectMimeType(src);

    // Ambient light effect
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !onAmbientUpdate) return;

        let animationFrameId = null;
        let intervalId = null;
        let isRunning = false;

        const updateAmbient = () => {
            try {
                // Check if video is ready and playing
                if (video.readyState >= 2 && !video.paused && !video.ended) {
                    onAmbientUpdate(video);
                    return true;
                }
                return false;
            } catch (err) {
                // Silent fail for CORS or other errors
                console.debug('Ambient update error:', err);
                return false;
            }
        };

        const startAmbientUpdates = () => {
            if (isRunning) return;
            isRunning = true;

            // Use requestAnimationFrame for smooth updates
            const frameUpdate = () => {
                if (!video || video.paused || video.ended) {
                    isRunning = false;
                    if (animationFrameId) {
                        cancelAnimationFrame(animationFrameId);
                        animationFrameId = null;
                    }
                    return;
                }

                // Update if video is ready
                if (video.readyState >= 2) {
                    updateAmbient();
                }

                animationFrameId = requestAnimationFrame(frameUpdate);
            };

            // Also use interval as fallback to ensure it keeps running
            // This monitors and restarts the animation frame loop if it stops
            intervalId = setInterval(() => {
                if (video && !video.paused && !video.ended && video.readyState >= 2) {
                    // Force update in case animation frame stopped
                    updateAmbient();

                    // If animation frame stopped but video is playing, restart it
                    if (animationFrameId === null && isRunning) {
                        // Animation frame loop somehow stopped, restart it
                        const restartFrameUpdate = () => {
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
                            animationFrameId = requestAnimationFrame(restartFrameUpdate);
                        };
                        animationFrameId = requestAnimationFrame(restartFrameUpdate);
                    }
                }
            }, 100);

            // Start animation frame loop
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
            startAmbientUpdates();
        };

        const handlePause = () => {
            stopAmbientUpdates();
        };

        const handleEnded = () => {
            stopAmbientUpdates();
        };

        const handleLoadedData = () => {
            // Restart updates when new data loads (e.g., quality change)
            if (!video.paused && !video.ended) {
                startAmbientUpdates();
            }
        };

        const handleTimeUpdate = () => {
            // Ensure updates are running during playback
            if (!video.paused && !video.ended && !isRunning && video.readyState >= 2) {
                startAmbientUpdates();
            }
        };

        // Add event listeners
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('ended', handleEnded);
        video.addEventListener('loadeddata', handleLoadedData);
        video.addEventListener('timeupdate', handleTimeUpdate);

        // Start if already playing
        if (!video.paused && !video.ended && video.readyState >= 2) {
            startAmbientUpdates();
        }

        return () => {
            stopAmbientUpdates();
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('ended', handleEnded);
            video.removeEventListener('loadeddata', handleLoadedData);
            video.removeEventListener('timeupdate', handleTimeUpdate);
        };
    }, [src, onAmbientUpdate]);

    return (
        <>
            <div
                ref={containerRef}
                className={`youtube-video-player ${className} ${isFullscreen ? 'fullscreen' : ''}`}
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
                    className="video-element"
                    poster={poster}
                    onTouchEnd={handleVideoTouch}
                    onClick={handleVideoClick}
                    onDoubleClick={handleVideoDoubleClick}
                    preload="metadata"
                    playsInline
                    webkit-playsinline="true"
                >
                    {src && <source src={src} type={videoMimeType} />}
                    <p>
                        Your browser doesn't support HTML5 video.
                        You can <a href={src} download>download the video</a> instead.
                    </p>
                </video>

                {isBuffering && (
                    <div className="buffering-indicator">
                        <div className="spinner"></div>
                    </div>
                )}

                {!isPlaying && !isBuffering && isReady && (
                    <div
                        className="play-overlay"
                        onTouchEnd={(e) => {
                            e.stopPropagation();
                            lastTouchTimeRef.current = Date.now();
                            togglePlayPause();
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            // Prevent ghost clicks
                            const timeSinceTouch = Date.now() - lastTouchTimeRef.current;
                            if (timeSinceTouch < GHOST_CLICK_THRESHOLD) {
                                return;
                            }
                            togglePlayPause();
                        }}
                    >
                        <div className="play-button-large">
                            <FaPlay />
                        </div>
                    </div>
                )}

                <div className={`video-controls ${showControls ? 'show' : ''}`}>
                    <div
                        className={`progress-bar-container ${isDragging ? 'dragging' : ''}`}
                        ref={progressBarRef}
                        onClick={handleProgressChange}
                        onMouseMove={handleProgressMouseMove}
                        onMouseLeave={handleProgressMouseLeave}
                        onMouseDown={handleProgressMouseDown}
                    >
                        {/* Time preview tooltip */}
                        {(hoverTime !== null || isDragging) && (
                            <div
                                className="progress-bar-tooltip"
                                style={{ left: `${hoverPosition}px` }}
                            >
                                {formatTime(hoverTime || 0)}
                            </div>
                        )}
                        <div className="progress-bar-background">
                            <div
                                className="progress-bar-fill"
                                style={{
                                    width: `${progressPercentage}%`,
                                    backgroundColor: primaryColor,
                                }}
                            />
                            {/* Preview indicator while hovering/dragging */}
                            {(hoverTime !== null || isDragging) && (
                                <div
                                    className="progress-bar-preview"
                                    style={{
                                        left: `${hoverPosition}px`,
                                        backgroundColor: primaryColor,
                                    }}
                                />
                            )}
                        </div>
                    </div>

                    <div className="controls-row">
                        <div className="controls-left">
                            {onPrevious && (
                                <button
                                    className="control-button"
                                    onClick={handlePreviousVideo}
                                    disabled={!canPlayPrevious}
                                    title="Previous video (p)"
                                    type="button"
                                >
                                    <FaStepBackward />
                                </button>
                            )}

                            <button className="control-button" onClick={togglePlayPause} title="Play/Pause (k)">
                                {isPlaying ? <FaPause /> : <FaPlay />}
                            </button>

                            {onNext && (
                                <button
                                    className="control-button"
                                    onClick={handleNextVideo}
                                    disabled={!canPlayNext}
                                    title="Next video (n)"
                                    type="button"
                                >
                                    <FaStepForward />
                                </button>
                            )}

                            <div className="volume-control">
                                <button className="control-button" onClick={toggleMute} title="Mute (m)">
                                    {getVolumeIcon()}
                                </button>
                                <div className="volume-slider-container">
                                    <input
                                        type="range"
                                        className="volume-slider"
                                        min="0"
                                        max="100"
                                        value={volume}
                                        onChange={(e) => handleVolumeChange(Number(e.target.value))}
                                        style={{
                                            '--volume-width': `${volume}%`
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="time-display">
                                {formatTime(currentTime)} / {formatTime(duration)}
                            </div>
                        </div>

                        <div className="controls-right">
                            {title && <div className="video-title-overlay">{title}</div>}

                            <div className="settings-menu">
                                <button
                                    className="control-button"
                                    onClick={() => setShowSettings(!showSettings)}
                                >
                                    <FaCog />
                                </button>

                                {showSettings && (
                                    <div className="settings-dropdown">
                                        {!showPlaybackRates && !showQualities && (
                                            <>
                                                <div
                                                    className="settings-item"
                                                    onClick={() => setShowPlaybackRates(true)}
                                                >
                                                    <span>Playback speed</span>
                                                    <span>{playbackRate === 1 ? 'Normal' : `${playbackRate}x`}</span>
                                                </div>
                                                {qualities && qualities.length > 0 && (
                                                    <div
                                                        className="settings-item"
                                                        onClick={() => setShowQualities(true)}
                                                    >
                                                        <span>Quality</span>
                                                        <span>{selectedQuality?.label || 'Auto'}</span>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {showPlaybackRates && (
                                            <div className="settings-submenu">
                                                <div
                                                    className="settings-back"
                                                    onClick={() => setShowPlaybackRates(false)}
                                                >
                                                    ← Playback speed
                                                </div>
                                                {playbackRates.map((rate) => (
                                                    <div
                                                        key={rate}
                                                        className="settings-item"
                                                        onClick={() => handlePlaybackRateChange(rate)}
                                                    >
                                                        <span>{rate === 1 ? 'Normal' : `${rate}x`}</span>
                                                        {playbackRate === rate && <FaCheck />}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {showQualities && (
                                            <div className="settings-submenu">
                                                <div
                                                    className="settings-back"
                                                    onClick={() => setShowQualities(false)}
                                                >
                                                    ← Quality
                                                </div>
                                                {qualities.map((quality) => (
                                                    <div
                                                        key={quality.id}
                                                        className="settings-item"
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

                            <button className="control-button" onClick={toggleFullscreen}>
                                {isFullscreen ? <FaCompress /> : <FaExpand />}
                            </button>
                        </div>
                    </div>
                </div>

                {!isReady && (
                    <div className="loading-indicator">
                        <div className="spinner"></div>
                    </div>
                )}
            </div>

            <KeyboardShortcuts
                show={showKeyboardShortcuts}
                onClose={() => setShowKeyboardShortcuts(false)}
            />
        </>
    );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;

