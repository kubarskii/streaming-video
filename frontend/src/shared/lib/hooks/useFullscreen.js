/**
 * Fullscreen hook for video player
 * Makes the entire browser window fullscreen (like F11)
 */
import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to manage fullscreen state
 * @param {React.RefObject} elementRef - Reference to element (unused, for API compatibility)
 * @returns {Object} Fullscreen controls
 */
export const useFullscreen = (elementRef) => {
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Check if fullscreen API is available
    const isAvailable = () => {
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

    // Request fullscreen on entire document (like F11)
    const enterFullscreen = useCallback(async () => {
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
    }, []);

    // Exit fullscreen
    const exitFullscreen = useCallback(async () => {
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
    }, []);

    // Toggle fullscreen
    const toggleFullscreen = useCallback(async () => {
        if (isFullscreen) {
            return await exitFullscreen();
        } else {
            return await enterFullscreen();
        }
    }, [isFullscreen, enterFullscreen, exitFullscreen]);

    // Listen for fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            const fullscreenElement = getFullscreenElement();
            const isNowFullscreen = !!fullscreenElement;
            setIsFullscreen(isNowFullscreen);

            // Don't lock scroll - allow custom scrollbar to be visible
            // The video player container itself prevents unwanted scrolling
        };

        // Add event listeners for different browsers
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
            document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
        };
    }, []);

    return {
        isFullscreen,
        isAvailable: isAvailable(),
        enterFullscreen,
        exitFullscreen,
        toggleFullscreen,
    };
};

