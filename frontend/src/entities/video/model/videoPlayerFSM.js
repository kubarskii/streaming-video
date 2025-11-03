/**
 * Video Player Finite State Machine
 * Manages the core playback states and transitions
 */
import { createStateMachine } from '../../../shared/lib/fsm';
import { PLAYER_STATES, PLAYER_EVENTS } from '../../../shared/config/videoPlayer.constants';

/**
 * Video Player State Machine Configuration
 */
export const videoPlayerFSMConfig = {
    id: 'videoPlayer',
    initial: PLAYER_STATES.IDLE,

    states: {
        [PLAYER_STATES.IDLE]: {
            on: {
                [PLAYER_EVENTS.PLAY]: PLAYER_STATES.LOADING,
                [PLAYER_EVENTS.LOADED_METADATA]: PLAYER_STATES.READY,
                [PLAYER_EVENTS.WAITING]: PLAYER_STATES.LOADING, // Start loading if buffering begins
            },
        },

        [PLAYER_STATES.LOADING]: {
            on: {
                [PLAYER_EVENTS.LOADED_METADATA]: PLAYER_STATES.READY,
                [PLAYER_EVENTS.WAITING]: PLAYER_STATES.LOADING, // Stay in loading while buffering initial data
                [PLAYER_EVENTS.CAN_PLAY]: PLAYER_STATES.READY, // Can transition to ready when enough data is loaded
                [PLAYER_EVENTS.ERROR]: PLAYER_STATES.ERROR,
            },
        },

        [PLAYER_STATES.READY]: {
            on: {
                [PLAYER_EVENTS.PLAY]: PLAYER_STATES.PLAYING,
                [PLAYER_EVENTS.SEEK]: PLAYER_STATES.SEEKING,
                [PLAYER_EVENTS.WAITING]: PLAYER_STATES.BUFFERING, // Can start buffering from ready state
                [PLAYER_EVENTS.ERROR]: PLAYER_STATES.ERROR,
            },
        },

        [PLAYER_STATES.PLAYING]: {
            on: {
                [PLAYER_EVENTS.PAUSE]: PLAYER_STATES.PAUSED,
                [PLAYER_EVENTS.SEEK]: PLAYER_STATES.SEEKING,
                [PLAYER_EVENTS.WAITING]: PLAYER_STATES.BUFFERING,
                [PLAYER_EVENTS.ENDED]: PLAYER_STATES.ENDED,
                [PLAYER_EVENTS.ERROR]: PLAYER_STATES.ERROR,
                [PLAYER_EVENTS.CAN_PLAY]: PLAYER_STATES.PLAYING, // Stay in playing if already playing
            },
        },

        [PLAYER_STATES.PAUSED]: {
            on: {
                [PLAYER_EVENTS.PLAY]: PLAYER_STATES.PLAYING,
                [PLAYER_EVENTS.SEEK]: PLAYER_STATES.SEEKING,
                [PLAYER_EVENTS.WAITING]: PLAYER_STATES.BUFFERING, // Can start buffering from paused state
                [PLAYER_EVENTS.ENDED]: PLAYER_STATES.ENDED,
                [PLAYER_EVENTS.ERROR]: PLAYER_STATES.ERROR,
            },
        },

        [PLAYER_STATES.BUFFERING]: {
            on: {
                [PLAYER_EVENTS.CAN_PLAY]: PLAYER_STATES.PLAYING,
                [PLAYER_EVENTS.PAUSE]: PLAYER_STATES.PAUSED,
                [PLAYER_EVENTS.ERROR]: PLAYER_STATES.ERROR,
                [PLAYER_EVENTS.SEEK]: PLAYER_STATES.SEEKING, // Allow seeking while buffering
                [PLAYER_EVENTS.SEEKED]: PLAYER_STATES.BUFFERING, // Stay buffering after seek completes
            },
        },

        [PLAYER_STATES.SEEKING]: {
            on: {
                [PLAYER_EVENTS.SEEKED]: PLAYER_STATES.PLAYING,
                [PLAYER_EVENTS.PAUSE]: PLAYER_STATES.PAUSED,
                [PLAYER_EVENTS.ERROR]: PLAYER_STATES.ERROR,
                [PLAYER_EVENTS.SEEK]: PLAYER_STATES.SEEKING, // Allow multiple seeks while seeking
                [PLAYER_EVENTS.WAITING]: PLAYER_STATES.BUFFERING, // Can buffer while seeking
            },
        },

        [PLAYER_STATES.ENDED]: {
            on: {
                [PLAYER_EVENTS.PLAY]: PLAYER_STATES.PLAYING,
                [PLAYER_EVENTS.SEEK]: PLAYER_STATES.SEEKING,
                [PLAYER_EVENTS.LOADED_METADATA]: PLAYER_STATES.READY,
            },
        },

        [PLAYER_STATES.ERROR]: {
            on: {
                [PLAYER_EVENTS.RETRY]: PLAYER_STATES.LOADING,
                [PLAYER_EVENTS.LOADED_METADATA]: PLAYER_STATES.READY,
            },
        },
    },
};

/**
 * Create video player state machine instance
 * @returns {Object} State machine instance
 */
export const createVideoPlayerFSM = () => {
    return createStateMachine(videoPlayerFSMConfig);
};

/**
 * Helper to check if state is playable
 * @param {string} state - Current state
 * @returns {boolean}
 */
export const isPlayableState = (state) => {
    return [
        PLAYER_STATES.READY,
        PLAYER_STATES.PLAYING,
        PLAYER_STATES.PAUSED,
        PLAYER_STATES.BUFFERING,
        PLAYER_STATES.SEEKING,
    ].includes(state);
};

/**
 * Helper to check if state is playing
 * @param {string} state - Current state
 * @returns {boolean}
 */
export const isPlayingState = (state) => {
    return state === PLAYER_STATES.PLAYING;
};

/**
 * Helper to check if state is loading
 * @param {string} state - Current state
 * @returns {boolean}
 */
export const isLoadingState = (state) => {
    return [
        PLAYER_STATES.IDLE,
        PLAYER_STATES.LOADING,
        PLAYER_STATES.BUFFERING,
    ].includes(state);
};

/**
 * Helper to check if state has error
 * @param {string} state - Current state
 * @returns {boolean}
 */
export const isErrorState = (state) => {
    return state === PLAYER_STATES.ERROR;
};

