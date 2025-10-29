import React, { useEffect, useState, useRef } from 'react';
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
} from 'react-icons/fa';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import './VideoPlayer.css';

export const VideoPlayer = ({
    src,
    poster,
    title,
    autoPlay = false,
    onTimeUpdate,
    onEnded,
    onError,
    primaryColor = '#ff0000',
    qualities = [],
    onQualityChange,
    className = '',
}) => {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const controlsTimeoutRef = useRef(null);
    const progressBarRef = useRef(null);

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

    const playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

    useEffect(() => {
        if (videoRef.current && autoPlay) {
            videoRef.current.play().catch(err => {
                console.log('Autoplay prevented:', err);
                setIsPlaying(false);
            });
        }
    }, [autoPlay]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleLoadedMetadata = () => {
            setDuration(video.duration);
            setIsReady(true);
        };

        const handleTimeUpdate = () => {
            setCurrentTime(video.currentTime);
            setIsBuffering(false);
            if (onTimeUpdate) {
                onTimeUpdate(video.currentTime);
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
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('waiting', handleWaiting);
        video.addEventListener('playing', handlePlaying);
        video.addEventListener('ended', handleEnded);
        video.addEventListener('error', handleError);

        return () => {
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('waiting', handleWaiting);
            video.removeEventListener('playing', handlePlaying);
            video.removeEventListener('ended', handleEnded);
            video.removeEventListener('error', handleError);
        };
    }, [onTimeUpdate, onEnded, onError]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    useEffect(() => {
        const handleKeyPress = (e) => {
            if (!videoRef.current) return;

            // Don't handle keyboard shortcuts when typing in input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch (e.key.toLowerCase()) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    togglePlayPause();
                    break;
                case 'arrowleft':
                    e.preventDefault();
                    seekBackward();
                    break;
                case 'arrowright':
                    e.preventDefault();
                    seekForward();
                    break;
                case 'arrowup':
                    e.preventDefault();
                    increaseVolume();
                    break;
                case 'arrowdown':
                    e.preventDefault();
                    decreaseVolume();
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
    }, [showKeyboardShortcuts]);

    const togglePlayPause = () => {
        if (!videoRef.current) return;

        if (videoRef.current.paused) {
            videoRef.current.play();
            setIsPlaying(true);
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
        }
        showControlsTemporarily();
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

    const handleProgressChange = (e) => {
        const rect = progressBarRef.current.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        const newTime = pos * duration;
        seekTo(newTime);
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
        setSelectedQuality(quality);
        setShowQualities(false);
        setShowSettings(false);
        if (onQualityChange) {
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

    return (
        <>
            <div
                ref={containerRef}
                className={`youtube-video-player ${className} ${isFullscreen ? 'fullscreen' : ''}`}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => isPlaying && setShowControls(false)}
            >
                <video
                    ref={videoRef}
                    className="video-element"
                    src={src}
                    poster={poster}
                    onClick={togglePlayPause}
                    onDoubleClick={toggleFullscreen}
                />

                {isBuffering && (
                    <div className="buffering-indicator">
                        <div className="spinner"></div>
                    </div>
                )}

                {!isPlaying && !isBuffering && isReady && (
                    <div className="play-overlay" onClick={togglePlayPause}>
                        <div className="play-button-large">
                            <FaPlay />
                        </div>
                    </div>
                )}

                <div className={`video-controls ${showControls ? 'show' : ''}`}>
                    <div
                        className="progress-bar-container"
                        ref={progressBarRef}
                        onClick={handleProgressChange}
                    >
                        <div className="progress-bar-background">
                            <div
                                className="progress-bar-fill"
                                style={{
                                    width: `${progressPercentage}%`,
                                    backgroundColor: primaryColor,
                                }}
                            />
                        </div>
                    </div>

                    <div className="controls-row">
                        <div className="controls-left">
                            <button className="control-button" onClick={togglePlayPause} title="Play/Pause (k)">
                                {isPlaying ? <FaPause /> : <FaPlay />}
                            </button>

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
                                            background: `linear-gradient(to right, #fff 0%, #fff ${volume}%, rgba(255, 255, 255, 0.3) ${volume}%, rgba(255, 255, 255, 0.3) 100%)`
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
};

export default VideoPlayer;

