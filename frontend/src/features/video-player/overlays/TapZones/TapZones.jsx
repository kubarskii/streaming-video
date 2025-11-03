/**
 * TapZones Component
 * Three-zone tap overlay for video player interactions
 * Left: Seek backward, Center: Play/Pause + Fullscreen, Right: Seek forward
 */
import { useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { PLAYER_CONSTANTS } from '../../../../shared/config/videoPlayer.constants';
import './TapZones.css';

/**
 * TapZones component - handles tap gestures on video
 * @param {Object} props - Component props
 * @param {Function} props.onSeekBackward - Backward seek handler
 * @param {Function} props.onSeekForward - Forward seek handler
 * @param {Function} props.onTogglePlay - Play/pause toggle handler
 * @param {Function} props.onToggleFullscreen - Fullscreen toggle handler
 * @param {boolean} props.showControls - Whether controls are visible
 * @param {Function} props.onShowControls - Show controls handler
 * @param {Function} props.onSeekFeedback - Seek feedback handler (for visual overlay)
 */
export const TapZones = ({
    onSeekBackward,
    onSeekForward,
    onTogglePlay,
    onToggleFullscreen,
    showControls,
    onShowControls,
    onSeekFeedback,
}) => {
    const lastTapTimeRef = useRef({ left: 0, center: 0, right: 0 });
    const tapTimeoutRef = useRef({ left: null, center: null, right: null });
    const tapCountRef = useRef({ left: 0, center: 0, right: 0 });
    const countResetTimeoutRef = useRef({ left: null, center: null, right: null });

    const handleZoneTap = useCallback((zone, event) => {
        // Don't prevent default if controls are visible - allow buttons to work
        if (showControls) {
            // Only prevent default for zones, not for controls
            const target = event.target;
            const controlsElement = target.closest('.videoControls');
            if (controlsElement) {
                // Let controls handle the event
                return;
            }
        }

        event.preventDefault();
        event.stopPropagation();

        const now = Date.now();
        const lastTap = lastTapTimeRef.current[zone];
        const timeDiff = now - lastTap;

        // Get tap position for feedback overlay
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX || (event.touches && event.touches[0]?.clientX) || (event.changedTouches && event.changedTouches[0]?.clientX) || rect.left + rect.width / 2;
        const y = event.clientY || (event.touches && event.touches[0]?.clientY) || (event.changedTouches && event.changedTouches[0]?.clientY) || rect.top + rect.height / 2;

        // Clear any pending single tap timeout for this zone
        if (tapTimeoutRef.current[zone]) {
            clearTimeout(tapTimeoutRef.current[zone]);
            tapTimeoutRef.current[zone] = null;
        }

        // Double tap detected (within threshold)
        if (timeDiff < PLAYER_CONSTANTS.DOUBLE_TAP_THRESHOLD && timeDiff > 0) {
            lastTapTimeRef.current[zone] = now;

            // Increment tap count
            tapCountRef.current[zone]++;

            // Reset count after a delay
            if (countResetTimeoutRef.current[zone]) {
                clearTimeout(countResetTimeoutRef.current[zone]);
            }
            countResetTimeoutRef.current[zone] = setTimeout(() => {
                tapCountRef.current[zone] = 0;
            }, 1000);

            switch (zone) {
                case 'left':
                    onSeekBackward();
                    if (onSeekFeedback) {
                        onSeekFeedback('backward', tapCountRef.current[zone], x, y);
                    }
                    break;
                case 'right':
                    onSeekForward();
                    if (onSeekFeedback) {
                        onSeekFeedback('forward', tapCountRef.current[zone], x, y);
                    }
                    break;
                case 'center':
                    onToggleFullscreen();
                    tapCountRef.current[zone] = 0; // Reset count for center
                    break;
            }
        } else {
            // First tap or single tap after delay
            lastTapTimeRef.current[zone] = now;
            tapCountRef.current[zone] = 1;

            // Reset count after a delay
            if (countResetTimeoutRef.current[zone]) {
                clearTimeout(countResetTimeoutRef.current[zone]);
            }
            countResetTimeoutRef.current[zone] = setTimeout(() => {
                tapCountRef.current[zone] = 0;
            }, 1000);

            tapTimeoutRef.current[zone] = setTimeout(() => {
                // Single tap confirmed
                if (zone === 'center') {
                    if (!showControls) {
                        // If controls are hidden, show them first
                        onShowControls();
                    } else {
                        // If controls are visible, toggle play/pause
                        onTogglePlay();
                    }
                } else {
                    // For side zones, single tap shows controls
                    if (!showControls) {
                        onShowControls();
                    }
                }
                tapTimeoutRef.current[zone] = null;
                tapCountRef.current[zone] = 0;
            }, PLAYER_CONSTANTS.DOUBLE_TAP_THRESHOLD);
        }
    }, [onSeekBackward, onSeekForward, onTogglePlay, onToggleFullscreen, showControls, onShowControls, onSeekFeedback]);

    return (
        <div className="tap-zones">
            {/* Left Zone - Seek Backward */}
            <div
                className="tap-zone tap-zone--left"
                onClick={(e) => handleZoneTap('left', e)}
                onTouchEnd={(e) => handleZoneTap('left', e)}
                aria-label="Double tap to seek backward"
            >
                <div className="tap-zone__ripple" />
            </div>

            {/* Center Zone - Play/Pause & Fullscreen */}
            <div
                className="tap-zone tap-zone--center"
                onClick={(e) => {
                    // Don't handle if clicking a control button
                    const target = e.target;
                    if (target.closest('.videoControls') || target.closest('button') || target.closest('.icon-btn')) {
                        return;
                    }
                    handleZoneTap('center', e);
                }}
                onTouchStart={(e) => {
                    // Don't handle if touching a control button
                    const target = e.target;
                    if (target.closest('.videoControls') || target.closest('button') || target.closest('.icon-btn')) {
                        return;
                    }
                }}
                onTouchEnd={(e) => {
                    // Don't handle if touching a control button
                    const target = e.target;
                    if (target.closest('.videoControls') || target.closest('button') || target.closest('.icon-btn')) {
                        return;
                    }
                    handleZoneTap('center', e);
                }}
                aria-label="Tap to play/pause, double tap for fullscreen"
            >
                <div className="tap-zone__ripple" />
            </div>

            {/* Right Zone - Seek Forward */}
            <div
                className="tap-zone tap-zone--right"
                onClick={(e) => handleZoneTap('right', e)}
                onTouchEnd={(e) => handleZoneTap('right', e)}
                aria-label="Double tap to seek forward"
            >
                <div className="tap-zone__ripple" />
            </div>
        </div>
    );
};

TapZones.propTypes = {
    onSeekBackward: PropTypes.func.isRequired,
    onSeekForward: PropTypes.func.isRequired,
    onTogglePlay: PropTypes.func.isRequired,
    onToggleFullscreen: PropTypes.func.isRequired,
    showControls: PropTypes.bool.isRequired,
    onShowControls: PropTypes.func.isRequired,
    onSeekFeedback: PropTypes.func,
};

