/**
 * Touch gesture hooks for mobile video player
 */
import { useEffect, useRef, useCallback } from 'react';
import { PLAYER_CONSTANTS, TOUCH_ZONES } from '../../config/videoPlayer.constants';
import { getTouchZone } from '../utils/calculatePosition';

/**
 * Hook to handle double-tap gestures for seeking
 * @param {React.RefObject} containerRef - Reference to container element
 * @param {Object} options - Configuration options
 * @param {Function} options.onDoubleTap - Called on double tap with zone and position
 * @param {boolean} options.enabled - Whether gestures are enabled
 * @returns {Object} Gesture state
 */
export const useDoubleTapGesture = (containerRef, { onDoubleTap, enabled = true }) => {
    const lastTapTime = useRef(0);
    const lastTapPosition = useRef({ x: 0, y: 0 });
    const tapCount = useRef(0);
    const tapTimeout = useRef(null);

    const handleTouchStart = useCallback((e) => {
        if (!enabled) return;

        const now = Date.now();
        const timeSinceLastTap = now - lastTapTime.current;
        const touch = e.touches[0];
        const { clientX, clientY } = touch;

        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const x = clientX - rect.left;
        const zone = getTouchZone(x, rect.width);

        // Check if this is a double tap
        if (timeSinceLastTap < PLAYER_CONSTANTS.DOUBLE_TAP_THRESHOLD && timeSinceLastTap > 0) {
            // Double tap detected
            tapCount.current += 1;

            if (tapTimeout.current) {
                clearTimeout(tapTimeout.current);
            }

            // Allow stacking (triple tap = 2x seek, etc.)
            tapTimeout.current = setTimeout(() => {
                if (onDoubleTap) {
                    onDoubleTap(zone, { x: clientX, y: clientY }, tapCount.current);
                }
                tapCount.current = 0;
            }, PLAYER_CONSTANTS.DOUBLE_CLICK_DELAY);

        } else {
            // First tap
            tapCount.current = 1;
        }

        lastTapTime.current = now;
        lastTapPosition.current = { x: clientX, y: clientY };
    }, [containerRef, onDoubleTap, enabled]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !enabled) return;

        container.addEventListener('touchstart', handleTouchStart, { passive: true });

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            if (tapTimeout.current) {
                clearTimeout(tapTimeout.current);
            }
        };
    }, [containerRef, handleTouchStart, enabled]);

    return {
        lastTapTime: lastTapTime.current,
        tapCount: tapCount.current,
    };
};

/**
 * Hook to handle swipe gestures for volume/brightness
 * @param {React.RefObject} containerRef - Reference to container element
 * @param {Object} options - Configuration options
 * @param {Function} options.onSwipeUp - Called on swipe up
 * @param {Function} options.onSwipeDown - Called on swipe down
 * @param {Function} options.onSwipeLeft - Called on swipe left
 * @param {Function} options.onSwipeRight - Called on swipe right
 * @param {number} options.threshold - Minimum distance for swipe (default: 50)
 * @param {boolean} options.enabled - Whether gestures are enabled
 */
export const useSwipeGesture = (containerRef, {
    onSwipeUp,
    onSwipeDown,
    onSwipeLeft,
    onSwipeRight,
    threshold = 50,
    enabled = true
}) => {
    const touchStart = useRef({ x: 0, y: 0, time: 0 });
    const touchEnd = useRef({ x: 0, y: 0, time: 0 });
    const isSwiping = useRef(false);

    const handleTouchStart = useCallback((e) => {
        if (!enabled) return;

        const touch = e.touches[0];
        touchStart.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now(),
        };
        isSwiping.current = false;
    }, [enabled]);

    const handleTouchMove = useCallback((e) => {
        if (!enabled) return;

        const touch = e.touches[0];
        touchEnd.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now(),
        };

        const deltaX = touchEnd.current.x - touchStart.current.x;
        const deltaY = touchEnd.current.y - touchStart.current.y;

        // Determine if swipe threshold is met
        if (Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold) {
            isSwiping.current = true;
        }
    }, [enabled, threshold]);

    const handleTouchEnd = useCallback(() => {
        if (!enabled || !isSwiping.current) return;

        const deltaX = touchEnd.current.x - touchStart.current.x;
        const deltaY = touchEnd.current.y - touchStart.current.y;
        const deltaTime = touchEnd.current.time - touchStart.current.time;

        // Ignore slow swipes (> 300ms)
        if (deltaTime > 300) {
            isSwiping.current = false;
            return;
        }

        // Determine swipe direction
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);

        if (absDeltaY > absDeltaX) {
            // Vertical swipe
            if (deltaY < 0 && onSwipeUp) {
                onSwipeUp(absDeltaY);
            } else if (deltaY > 0 && onSwipeDown) {
                onSwipeDown(absDeltaY);
            }
        } else {
            // Horizontal swipe
            if (deltaX < 0 && onSwipeLeft) {
                onSwipeLeft(absDeltaX);
            } else if (deltaX > 0 && onSwipeRight) {
                onSwipeRight(absDeltaX);
            }
        }

        isSwiping.current = false;
    }, [enabled, onSwipeUp, onSwipeDown, onSwipeLeft, onSwipeRight]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !enabled) return;

        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: true });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [containerRef, handleTouchStart, handleTouchMove, handleTouchEnd, enabled]);

    return {
        isSwiping: isSwiping.current,
    };
};

/**
 * Hook to handle pinch-to-zoom gesture
 * @param {React.RefObject} containerRef - Reference to container element
 * @param {Object} options - Configuration options
 * @param {Function} options.onPinch - Called on pinch with scale factor
 * @param {boolean} options.enabled - Whether gestures are enabled
 */
export const usePinchGesture = (containerRef, { onPinch, enabled = true }) => {
    const initialDistance = useRef(0);
    const currentScale = useRef(1);

    const getDistance = (touch1, touch2) => {
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = useCallback((e) => {
        if (!enabled || e.touches.length !== 2) return;

        initialDistance.current = getDistance(e.touches[0], e.touches[1]);
    }, [enabled]);

    const handleTouchMove = useCallback((e) => {
        if (!enabled || e.touches.length !== 2) return;

        const currentDistance = getDistance(e.touches[0], e.touches[1]);
        const scale = currentDistance / initialDistance.current;

        currentScale.current = scale;

        if (onPinch) {
            onPinch(scale);
        }
    }, [enabled, onPinch]);

    const handleTouchEnd = useCallback(() => {
        initialDistance.current = 0;
        currentScale.current = 1;
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !enabled) return;

        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [containerRef, handleTouchStart, handleTouchMove, handleTouchEnd, enabled]);

    return {
        scale: currentScale.current,
    };
};

