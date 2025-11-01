/**
 * Position calculation utilities for video player
 */

import { PLAYER_CONSTANTS } from '../../config/videoPlayer.constants';

/**
 * Calculate time from click position on progress bar
 * @param {number} clientX - Click X coordinate
 * @param {DOMRect} rect - Progress bar bounding rect
 * @param {number} duration - Video duration in seconds
 * @param {number} padding - Progress bar padding
 * @returns {number} Time in seconds
 */
export const calculateTimeFromPosition = (clientX, rect, duration, padding = 0) => {
    if (!duration || duration <= 0) {
        return 0;
    }

    const effectiveWidth = rect.width - (padding * 2);
    const relativeX = Math.max(0, Math.min(effectiveWidth, clientX - rect.left - padding));
    const percentage = relativeX / effectiveWidth;

    return Math.max(0, Math.min(duration, percentage * duration));
};

/**
 * Calculate pixel position from time
 * @param {number} time - Time in seconds
 * @param {number} duration - Total duration in seconds
 * @param {number} width - Progress bar width
 * @param {number} padding - Progress bar padding
 * @returns {number} Pixel position
 */
export const calculatePositionFromTime = (time, duration, width, padding = 0) => {
    if (!duration || duration <= 0) {
        return padding;
    }

    const effectiveWidth = width - (padding * 2);
    const percentage = Math.max(0, Math.min(1, time / duration));

    return padding + (percentage * effectiveWidth);
};

/**
 * Determine which touch zone was tapped
 * @param {number} x - Touch X coordinate relative to container
 * @param {number} width - Container width
 * @returns {string} Zone identifier ('left', 'center', 'right')
 */
export const getTouchZone = (x, width) => {
    const leftZone = width * PLAYER_CONSTANTS.DOUBLE_TAP_ZONE_SIDE;
    const rightZone = width * (1 - PLAYER_CONSTANTS.DOUBLE_TAP_ZONE_SIDE);

    if (x < leftZone) {
        return 'left';
    }
    if (x > rightZone) {
        return 'right';
    }
    return 'center';
};

/**
 * Calculate volume from slider position
 * @param {number} value - Slider value (0-100)
 * @returns {number} Volume level (0-1)
 */
export const calculateVolumeFromSlider = (value) => {
    return Math.max(0, Math.min(1, value / 100));
};

/**
 * Calculate slider position from volume
 * @param {number} volume - Volume level (0-1)
 * @returns {number} Slider value (0-100)
 */
export const calculateSliderFromVolume = (volume) => {
    return Math.round(Math.max(0, Math.min(1, volume)) * 100);
};

/**
 * Clamp value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export const clamp = (value, min, max) => {
    return Math.max(min, Math.min(max, value));
};

/**
 * Calculate progress percentage
 * @param {number} current - Current value
 * @param {number} total - Total value
 * @returns {number} Percentage (0-100)
 */
export const calculatePercentage = (current, total) => {
    if (!total || total <= 0) {
        return 0;
    }

    return clamp((current / total) * 100, 0, 100);
};

/**
 * Detect video aspect ratio
 * @param {number} width - Video width
 * @param {number} height - Video height
 * @returns {number} Aspect ratio
 */
export const calculateAspectRatio = (width, height) => {
    if (!height || height === 0) {
        return 16 / 9; // Default to 16:9
    }

    return width / height;
};

/**
 * Calculate buffered percentage
 * @param {TimeRanges} buffered - Video buffered time ranges
 * @param {number} duration - Video duration
 * @returns {Array<{start: number, end: number}>} Array of buffered segments
 */
export const calculateBufferedSegments = (buffered, duration) => {
    if (!buffered || !duration) {
        return [];
    }

    const segments = [];

    for (let i = 0; i < buffered.length; i++) {
        const start = (buffered.start(i) / duration) * 100;
        const end = (buffered.end(i) / duration) * 100;
        segments.push({ start, end });
    }

    return segments;
};

/**
 * Calculate time and pixel position from mouse event on progress bar
 * @param {MouseEvent} event - Mouse event
 * @param {DOMRect} rect - Progress bar bounding rect
 * @param {number} duration - Video duration in seconds
 * @param {number} padding - Progress bar padding
 * @returns {{time: number, pixelPosition: number}} Time in seconds and pixel position
 */
export const getProgressBarPosition = (event, rect, duration, padding = 0) => {
    const time = calculateTimeFromPosition(event.clientX, rect, duration, padding);
    const pixelPos = clamp(event.clientX - rect.left, padding, rect.width - padding);

    return { time, pixelPosition: pixelPos };
};

/**
 * Update hover state for progress bar
 * @param {MouseEvent} event - Mouse event
 * @param {DOMRect} rect - Progress bar bounding rect
 * @param {number} duration - Video duration in seconds
 * @param {number} padding - Progress bar padding
 * @param {Function} setHoverTime - Set hover time callback
 * @param {Function} setHoverPosition - Set hover position callback
 */
export const updateProgressBarHover = (event, rect, duration, padding, setHoverTime, setHoverPosition) => {
    const { time, pixelPosition } = getProgressBarPosition(event, rect, duration, padding);
    setHoverTime(time);
    setHoverPosition(pixelPosition);
    return time;
};

