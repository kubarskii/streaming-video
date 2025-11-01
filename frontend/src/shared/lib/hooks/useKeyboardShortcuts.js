/**
 * Keyboard shortcuts hook for video player
 */
import { useEffect, useCallback } from 'react';
import { KEYBOARD_SHORTCUTS } from '../../config/videoPlayer.constants';

/**
 * Hook to handle keyboard shortcuts
 * @param {Object} handlers - Shortcut handlers
 * @param {Function} handlers.onPlayPause - Play/pause handler
 * @param {Function} handlers.onSeekForward - Seek forward handler
 * @param {Function} handlers.onSeekBackward - Seek backward handler
 * @param {Function} handlers.onSeekForwardLong - Seek forward long handler
 * @param {Function} handlers.onSeekBackwardLong - Seek backward long handler
 * @param {Function} handlers.onVolumeUp - Volume up handler
 * @param {Function} handlers.onVolumeDown - Volume down handler
 * @param {Function} handlers.onMute - Mute toggle handler
 * @param {Function} handlers.onFullscreen - Fullscreen toggle handler
 * @param {Function} handlers.onNextVideo - Next video handler
 * @param {Function} handlers.onPreviousVideo - Previous video handler
 * @param {Function} handlers.onShowHelp - Show help handler
 * @param {boolean} enabled - Whether shortcuts are enabled
 */
export const useKeyboardShortcuts = (handlers, enabled = true) => {
    const handleKeyPress = useCallback((e) => {
        if (!enabled) return;

        // Don't handle keyboard shortcuts when typing in input fields
        if (
            e.target.tagName === 'INPUT' ||
            e.target.tagName === 'TEXTAREA' ||
            e.target.isContentEditable
        ) {
            return;
        }

        const key = e.key.toLowerCase();
        const code = e.code.toLowerCase();

        // Check for exact key matches
        if (KEYBOARD_SHORTCUTS.PLAY_PAUSE.includes(key)) {
            e.preventDefault();
            handlers.onPlayPause?.();
            return;
        }

        if (KEYBOARD_SHORTCUTS.FULLSCREEN.includes(key)) {
            e.preventDefault();
            handlers.onFullscreen?.();
            return;
        }

        if (KEYBOARD_SHORTCUTS.MUTE.includes(key)) {
            e.preventDefault();
            handlers.onMute?.();
            return;
        }

        if (KEYBOARD_SHORTCUTS.HELP.includes(key)) {
            e.preventDefault();
            handlers.onShowHelp?.();
            return;
        }

        if (KEYBOARD_SHORTCUTS.ESCAPE.includes(key)) {
            e.preventDefault();
            handlers.onEscape?.();
            return;
        }

        // Arrow keys - check by code for reliability
        if (code === 'arrowleft' || key === 'arrowleft') {
            e.preventDefault();
            handlers.onSeekBackward?.();
            return;
        }

        if (code === 'arrowright' || key === 'arrowright') {
            e.preventDefault();
            handlers.onSeekForward?.();
            return;
        }

        if (code === 'arrowup' || key === 'arrowup') {
            e.preventDefault();
            handlers.onVolumeUp?.();
            return;
        }

        if (code === 'arrowdown' || key === 'arrowdown') {
            e.preventDefault();
            handlers.onVolumeDown?.();
            return;
        }

        // Long seek keys
        if (KEYBOARD_SHORTCUTS.SEEK_BACKWARD_LONG.includes(key)) {
            e.preventDefault();
            handlers.onSeekBackwardLong?.();
            return;
        }

        if (KEYBOARD_SHORTCUTS.SEEK_FORWARD_LONG.includes(key)) {
            e.preventDefault();
            handlers.onSeekForwardLong?.();
            return;
        }

        // Next/Previous video (with shift modifier for uppercase)
        if (KEYBOARD_SHORTCUTS.NEXT_VIDEO.includes(key.toUpperCase())) {
            e.preventDefault();
            handlers.onNextVideo?.();
            return;
        }

        if (KEYBOARD_SHORTCUTS.PREV_VIDEO.includes(key.toUpperCase())) {
            e.preventDefault();
            handlers.onPreviousVideo?.();
            return;
        }

        // Number keys (0-9) for seeking to percentage
        if (key >= '0' && key <= '9') {
            e.preventDefault();
            const percentage = parseInt(key, 10);
            handlers.onSeekToPercentage?.(percentage * 10);
            return;
        }
    }, [handlers, enabled]);

    useEffect(() => {
        if (!enabled) return;

        window.addEventListener('keydown', handleKeyPress);

        return () => {
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, [handleKeyPress, enabled]);
};

/**
 * Get formatted keyboard shortcuts for display
 * @returns {Array<{key: string, action: string}>}
 */
export const getKeyboardShortcutsList = () => {
    return [
        { key: 'Space / K', action: 'Play/Pause' },
        { key: 'F', action: 'Fullscreen' },
        { key: 'M', action: 'Mute' },
        { key: '←', action: 'Seek backward 5s' },
        { key: '→', action: 'Seek forward 5s' },
        { key: 'J', action: 'Seek backward 10s' },
        { key: 'L', action: 'Seek forward 10s' },
        { key: '↑', action: 'Volume up' },
        { key: '↓', action: 'Volume down' },
        { key: 'N', action: 'Next video' },
        { key: 'P', action: 'Previous video' },
        { key: '0-9', action: 'Jump to 0%-90%' },
        { key: '?', action: 'Show shortcuts' },
    ];
};

