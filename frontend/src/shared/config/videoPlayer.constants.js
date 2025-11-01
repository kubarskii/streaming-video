/**
 * Video Player Constants
 * Centralized configuration for all video player magic numbers and strings
 */

export const PLAYER_CONSTANTS = {
    // Timing (milliseconds)
    CONTROLS_AUTO_HIDE_DELAY: 3000,
    DOUBLE_TAP_THRESHOLD: 300,
    GHOST_CLICK_THRESHOLD: 300,
    SEEK_ANIMATION_DURATION: 400,
    CONTROL_FADE_DURATION: 200,
    DOUBLE_CLICK_DELAY: 10,

    // Dimensions (pixels)
    TOUCH_TARGET_MIN_SIZE: 48,
    PROGRESS_BAR_HEIGHT: {
        DEFAULT: 4,
        HOVER: 6,
        MOBILE: 24,
    },
    PROGRESS_BAR_PADDING: 12, // Matches CSS padding: 8px 12px
    SCRUBBER_SIZE: 14,
    SPINNER_SIZE: 60,
    PLAY_BUTTON_LARGE: {
        WIDTH: 80,
        HEIGHT: 56,
    },

    // Seek amounts (seconds)
    SEEK_SHORT: 5,
    SEEK_LONG: 10,

    // Volume
    VOLUME_STEP: 5,
    VOLUME_DEFAULT: 100,
    VOLUME_MIN: 0,
    VOLUME_MAX: 100,

    // Playback rates
    PLAYBACK_RATES: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
    PLAYBACK_RATE_DEFAULT: 1,

    // Zones (percentages of screen width)
    DOUBLE_TAP_ZONE_SIDE: 0.3,
    DOUBLE_TAP_ZONE_CENTER: 0.4,

    // Position saving
    POSITION_SAVE_INTERVAL: 1000,
    POSITION_SAVE_MIN_TIME: 5,

    // Ambient light effect
    AMBIENT_UPDATE_INTERVAL: 100,
    AMBIENT_CANVAS_WIDTH: 1280,

    // Up Next overlay
    UP_NEXT_SHOW_BEFORE_END: 10, // Show "Up Next" 10 seconds before video ends
    UP_NEXT_AUTOPLAY_COUNTDOWN: 5, // Start countdown 5 seconds before end

    // Storage keys
    STORAGE_KEYS: {
        VOLUME: 'videoPlayer_volume',
        PLAYBACK_RATE: 'videoPlayer_playbackRate',
        POSITION: (videoId) => `video_position_${videoId}`,
        QUALITY: 'videoPlayer_quality',
        MUTED: 'videoPlayer_muted',
    },

    // ARIA labels
    ARIA_LABELS: {
        PLAY: 'Play',
        PAUSE: 'Pause',
        MUTE: 'Mute',
        UNMUTE: 'Unmute',
        FULLSCREEN: 'Fullscreen',
        EXIT_FULLSCREEN: 'Exit fullscreen',
        SETTINGS: 'Settings',
        NEXT_VIDEO: 'Next video',
        PREVIOUS_VIDEO: 'Previous video',
        VOLUME_SLIDER: 'Volume slider',
        PROGRESS_BAR: 'Video progress',
    },

    // Colors
    COLORS: {
        PRIMARY: '#ff0000',
    },
};

/**
 * Player State Machine States
 */
export const PLAYER_STATES = {
    IDLE: 'idle',
    LOADING: 'loading',
    READY: 'ready',
    PLAYING: 'playing',
    PAUSED: 'paused',
    BUFFERING: 'buffering',
    SEEKING: 'seeking',
    ENDED: 'ended',
    ERROR: 'error',
};

/**
 * Player Events
 */
export const PLAYER_EVENTS = {
    PLAY: 'play',
    PAUSE: 'pause',
    SEEK: 'seek',
    VOLUME_CHANGE: 'volumeChange',
    QUALITY_CHANGE: 'qualityChange',
    RATE_CHANGE: 'rateChange',
    ERROR: 'error',
    ENDED: 'ended',
    LOADED_METADATA: 'loadedMetadata',
    LOADED_DATA: 'loadedData',
    WAITING: 'waiting',
    CAN_PLAY: 'canPlay',
    TIME_UPDATE: 'timeUpdate',
    SEEKED: 'seeked',
    RETRY: 'retry',
};

/**
 * Keyboard Shortcuts Configuration
 */
export const KEYBOARD_SHORTCUTS = {
    PLAY_PAUSE: [' ', 'k'],
    FULLSCREEN: ['f'],
    MUTE: ['m'],
    SEEK_BACKWARD_SHORT: ['ArrowLeft'],
    SEEK_FORWARD_SHORT: ['ArrowRight'],
    SEEK_BACKWARD_LONG: ['j'],
    SEEK_FORWARD_LONG: ['l'],
    VOLUME_UP: ['ArrowUp'],
    VOLUME_DOWN: ['ArrowDown'],
    NEXT_VIDEO: ['n'],
    PREV_VIDEO: ['p'],
    HELP: ['?'],
    ESCAPE: ['Escape'],
};

/**
 * Touch Zones for Mobile Gestures
 */
export const TOUCH_ZONES = {
    LEFT: 'left',
    CENTER: 'center',
    RIGHT: 'right',
};

/**
 * Seek Directions
 */
export const SEEK_DIRECTION = {
    FORWARD: 'forward',
    BACKWARD: 'backward',
};

/**
 * Quality Labels
 */
export const QUALITY_LABELS = {
    AUTO: 'Auto',
    '144': '144p',
    '240': '240p',
    '360': '360p',
    '480': '480p',
    '720': '720p',
    '1080': '1080p',
    '1440': '1440p',
    '2160': '4K',
};

/**
 * MIME Types
 */
export const MIME_TYPES = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogg: 'video/ogg',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
};

/**
 * Error Messages
 */
export const ERROR_MESSAGES = {
    VIDEO_NOT_FOUND: 'Video not found',
    LOAD_FAILED: 'Failed to load video',
    PLAYBACK_ERROR: 'An error occurred during playback',
    NETWORK_ERROR: 'Network error occurred',
    UNSUPPORTED_FORMAT: 'Video format not supported',
};

/**
 * Button Sizes
 */
export const BUTTON_SIZES = {
    SMALL: 'small',
    MEDIUM: 'medium',
    LARGE: 'large',
};

/**
 * Animation Durations (milliseconds)
 */
export const ANIMATION_DURATION = {
    FADE: 200,
    SLIDE: 150,
    SCALE: 100,
    SEEK_OVERLAY: 600,
};

