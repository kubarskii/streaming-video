/**
 * Video events hook
 */
import { useEffect } from 'react';

/**
 * Hook to handle video element events
 * @param {React.RefObject} videoRef - Reference to video element
 * @param {Object} callbacks - Event callbacks
 * @param {Function} callbacks.onPlay - Called when video starts playing
 * @param {Function} callbacks.onPause - Called when video pauses
 * @param {Function} callbacks.onEnded - Called when video ends
 * @param {Function} callbacks.onTimeUpdate - Called on time update
 * @param {Function} callbacks.onLoadedMetadata - Called when metadata loaded
 * @param {Function} callbacks.onLoadedData - Called when data loaded
 * @param {Function} callbacks.onWaiting - Called when buffering
 * @param {Function} callbacks.onCanPlay - Called when can play
 * @param {Function} callbacks.onSeeking - Called when seeking
 * @param {Function} callbacks.onSeeked - Called when seek complete
 * @param {Function} callbacks.onError - Called on error
 * @param {Function} callbacks.onVolumeChange - Called on volume change
 * @param {Function} callbacks.onRateChange - Called on playback rate change
 */
export const useVideoEvents = (videoRef, callbacks) => {
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const {
            onPlay,
            onPause,
            onEnded,
            onTimeUpdate,
            onLoadedMetadata,
            onLoadedData,
            onWaiting,
            onCanPlay,
            onCanPlayThrough,
            onSeeking,
            onSeeked,
            onError,
            onVolumeChange,
            onRateChange,
            onProgress,
            onDurationChange,
        } = callbacks;

        // Event handlers
        const handlers = {
            play: onPlay,
            pause: onPause,
            ended: onEnded,
            timeupdate: onTimeUpdate,
            loadedmetadata: onLoadedMetadata,
            loadeddata: onLoadedData,
            waiting: onWaiting,
            canplay: onCanPlay,
            canplaythrough: onCanPlayThrough,
            seeking: onSeeking,
            seeked: onSeeked,
            error: onError,
            volumechange: onVolumeChange,
            ratechange: onRateChange,
            progress: onProgress,
            durationchange: onDurationChange,
        };

        // Add event listeners
        Object.entries(handlers).forEach(([event, handler]) => {
            if (handler && typeof handler === 'function') {
                video.addEventListener(event, handler);
            }
        });

        // Cleanup
        return () => {
            Object.entries(handlers).forEach(([event, handler]) => {
                if (handler && typeof handler === 'function') {
                    video.removeEventListener(event, handler);
                }
            });
        };
    }, [videoRef, callbacks]);
};

/**
 * Hook for single video event
 * @param {React.RefObject} videoRef - Reference to video element
 * @param {string} eventName - Event name
 * @param {Function} handler - Event handler
 */
export const useVideoEvent = (videoRef, eventName, handler) => {
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !handler) return;

        video.addEventListener(eventName, handler);

        return () => {
            video.removeEventListener(eventName, handler);
        };
    }, [videoRef, eventName, handler]);
};

