/**
 * Time formatting utilities for video player
 */

/**
 * Format seconds to time string (M:SS or H:MM:SS)
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
export const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) {
        return '0:00';
    }

    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Format duration from milliseconds to time string
 * @param {number} durationMs - Duration in milliseconds
 * @returns {string} Formatted time string
 */
export const formatDurationMs = (durationMs) => {
    if (!durationMs || durationMs < 0) {
        return '0:00';
    }

    return formatTime(durationMs / 1000);
};

/**
 * Parse time string to seconds
 * @param {string} timeStr - Time string (M:SS or H:MM:SS)
 * @returns {number} Time in seconds
 */
export const parseTime = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') {
        return 0;
    }

    const parts = timeStr.split(':').map(part => parseInt(part, 10));

    if (parts.length === 2) {
        // M:SS format
        const [mins, secs] = parts;
        return (mins * 60) + secs;
    } else if (parts.length === 3) {
        // H:MM:SS format
        const [hours, mins, secs] = parts;
        return (hours * 3600) + (mins * 60) + secs;
    }

    return 0;
};

/**
 * Format views count (1K, 1M, etc.)
 * @param {number} views - View count
 * @returns {string} Formatted views string
 */
export const formatViews = (views) => {
    if (views >= 1000000) {
        return `${(views / 1000000).toFixed(1)}M`;
    }
    if (views >= 1000) {
        return `${(views / 1000).toFixed(1)}K`;
    }
    return views.toString();
};

/**
 * Format date to readable string
 * @param {string|Date} dateString - Date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

