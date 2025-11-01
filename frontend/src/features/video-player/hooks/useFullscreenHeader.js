/**
 * Feature: Fullscreen Header Management Hook
 * Automatically hides/shows header based on fullscreen state
 * (Feature layer - combines entity logic with use case)
 */
import { useEffect } from 'react';
import { useHeaderVisibility } from '../../../entities/layout/model';

/**
 * Hook to manage header visibility during fullscreen video playback
 * Automatically hides header when entering fullscreen, shows when exiting
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} options.isFullscreen - Current fullscreen state
 * @param {boolean} options.autoHide - Whether to auto-hide header in fullscreen (default: true)
 * @param {boolean} options.restoreOnExit - Whether to restore header on fullscreen exit (default: true)
 * @param {Function} options.onVisibilityChange - Callback when visibility changes
 * @returns {Object} Header visibility controls
 */
export const useFullscreenHeader = (options = {}) => {
    const {
        isFullscreen = false,
        autoHide = true,
        restoreOnExit = true,
        onVisibilityChange = null,
    } = options;

    // Use entity hook for header visibility
    const headerControls = useHeaderVisibility({
        initialVisible: true,
        persistState: false,
    });

    const { isVisible, hide, show } = headerControls;

    // Handle fullscreen state changes
    useEffect(() => {
        if (!autoHide) return;

        if (isFullscreen) {
            // Hide header when entering fullscreen
            hide();
        } else if (restoreOnExit) {
            // Restore header when exiting fullscreen
            show();
        }
    }, [isFullscreen, autoHide, restoreOnExit, hide, show]);

    // Notify parent of visibility changes
    useEffect(() => {
        if (onVisibilityChange) {
            onVisibilityChange(isVisible);
        }
    }, [isVisible, onVisibilityChange]);

    // Apply CSS class to document body for global styling
    useEffect(() => {
        const className = 'header-hidden';
        
        if (!isVisible) {
            document.body.classList.add(className);
        } else {
            document.body.classList.remove(className);
        }

        return () => {
            document.body.classList.remove(className);
        };
    }, [isVisible]);

    return {
        ...headerControls,
        isFullscreen,
    };
};

