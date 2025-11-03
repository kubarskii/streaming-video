/**
 * Fullscreen hook for video player
 * Makes the entire browser window fullscreen (like F11)
 * Includes iOS-specific support using webkitEnterFullscreen
 */
import { useState, useEffect, useCallback } from 'react';

/**
 * Detect if running on iOS
 */
const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

/**
 * Detect if running on mobile device
 */
const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 1);
};

/**
 * Hook to manage fullscreen state
 * @param {React.RefObject} elementRef - Reference to element (unused, for API compatibility)
 * @param {React.RefObject} videoRef - Reference to video element (for iOS fullscreen)
 * @returns {Object} Fullscreen controls
 */
export const useFullscreen = (elementRef, videoRef = null) => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isIOSFullscreen, setIsIOSFullscreen] = useState(false);

    // Check if fullscreen API is available
    const isAvailable = () => {
        if (isIOS()) {
            // On iOS, we can use webkitEnterFullscreen on video element
            return !!videoRef?.current;
        }
        return !!(
            document.fullscreenEnabled ||
            document.webkitFullscreenEnabled ||
            document.mozFullScreenEnabled ||
            document.msFullscreenEnabled
        );
    };

    // Get fullscreen element
    const getFullscreenElement = () => {
        return (
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        );
    };

    // Request fullscreen on iOS using webkitEnterFullscreen
    const enterIOSFullscreen = useCallback(async () => {
        if (!videoRef?.current) {
            console.warn('Video ref not available for iOS fullscreen');
            return false;
        }

        const video = videoRef.current;

        try {
            // iOS-specific: use webkitEnterFullscreen on video element (native video player)
            if (video.webkitEnterFullscreen) {
                video.webkitEnterFullscreen();
                // Don't set state here - let the webkitbeginfullscreen event handler do it
                // This ensures state stays in sync with actual fullscreen state
                return true;
            }

            // Fallback: Try standard fullscreen API on video element
            if (video.requestFullscreen) {
                await video.requestFullscreen();
                return true;
            } else if (video.webkitRequestFullscreen) {
                await video.webkitRequestFullscreen();
                return true;
            } else if (video.mozRequestFullScreen) {
                await video.mozRequestFullScreen();
                return true;
            } else if (video.msRequestFullscreen) {
                await video.msRequestFullscreen();
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error entering iOS fullscreen:', error);
            return false;
        }
    }, [videoRef]);

    // Exit iOS fullscreen
    const exitIOSFullscreen = useCallback(async () => {
        if (!videoRef?.current) {
            return false;
        }

        try {
            // On iOS, we can't programmatically exit fullscreen
            // User must tap the "Done" button
            // But we can listen for the exit event
            setIsIOSFullscreen(false);
            return true;
        } catch (error) {
            console.error('Error exiting iOS fullscreen:', error);
            return false;
        }
    }, [videoRef]);

    // Request fullscreen on entire document (like F11)
    const enterFullscreen = useCallback(async () => {
        // On iOS, use native video fullscreen
        if (isIOS() && videoRef?.current) {
            return await enterIOSFullscreen();
        }

        const element = document.documentElement; // Entire page, not just video player

        try {
            if (element.requestFullscreen) {
                await element.requestFullscreen();
            } else if (element.webkitRequestFullscreen) {
                await element.webkitRequestFullscreen();
            } else if (element.mozRequestFullScreen) {
                await element.mozRequestFullScreen();
            } else if (element.msRequestFullscreen) {
                await element.msRequestFullscreen();
            }
            return true;
        } catch (error) {
            console.error('Error entering fullscreen:', error);
            return false;
        }
    }, [videoRef, enterIOSFullscreen]);

    // Exit fullscreen
    const exitFullscreen = useCallback(async () => {
        // On iOS, we can't programmatically exit, but we can update state
        if (isIOS() && isIOSFullscreen) {
            return await exitIOSFullscreen();
        }

        try {
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                await document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                await document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                await document.msExitFullscreen();
            }
            return true;
        } catch (error) {
            console.error('Error exiting fullscreen:', error);
            return false;
        }
    }, [isIOSFullscreen, exitIOSFullscreen]);

    // Toggle fullscreen
    const toggleFullscreen = useCallback(async () => {
        if (isFullscreen || isIOSFullscreen) {
            return await exitFullscreen();
        } else {
            return await enterFullscreen();
        }
    }, [isFullscreen, isIOSFullscreen, enterFullscreen, exitFullscreen]);

    // Listen for fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            const fullscreenElement = getFullscreenElement();
            const isNowFullscreen = !!fullscreenElement;
            setIsFullscreen(isNowFullscreen);
        };

        // Handle iOS video fullscreen events
        const handleIOSFullscreenChange = () => {
            if (videoRef?.current) {
                // Check if video is in fullscreen by checking if it has webkitDisplayingFullscreen property
                // or by checking if video is playing fullscreen
                const isIOSFullscreenNow = videoRef.current.webkitDisplayingFullscreen || false;
                setIsIOSFullscreen(isIOSFullscreenNow);
            }
        };

        // Add event listeners for different browsers
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);

        // iOS-specific video fullscreen events
        if (videoRef?.current) {
            videoRef.current.addEventListener('webkitbeginfullscreen', handleIOSFullscreenChange);
            videoRef.current.addEventListener('webkitendfullscreen', handleIOSFullscreenChange);
        }

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
            document.removeEventListener('MSFullscreenChange', handleFullscreenChange);

            if (videoRef?.current) {
                videoRef.current.removeEventListener('webkitbeginfullscreen', handleIOSFullscreenChange);
                videoRef.current.removeEventListener('webkitendfullscreen', handleIOSFullscreenChange);
            }
        };
    }, [videoRef]);

    return {
        isFullscreen: isFullscreen || isIOSFullscreen,
        isAvailable: isAvailable(),
        enterFullscreen,
        exitFullscreen,
        toggleFullscreen,
    };
};

