/**
 * Video Playback State Hook
 * Manages video playback-related state (time, duration, loading, buffering)
 */
import { useReducer } from 'react';

const initialState = {
    currentTime: 0,
    duration: 0,
    isVideoPlaying: false,
    isVideoBuffering: false,
    isVideoLoading: true,
};

const actions = {
    SET_CURRENT_TIME: 'SET_CURRENT_TIME',
    SET_DURATION: 'SET_DURATION',
    SET_VIDEO_PLAYING: 'SET_VIDEO_PLAYING',
    SET_VIDEO_BUFFERING: 'SET_VIDEO_BUFFERING',
    SET_VIDEO_LOADING: 'SET_VIDEO_LOADING',
    RESET: 'RESET',
};

function playbackReducer(state, action) {
    switch (action.type) {
        case actions.SET_CURRENT_TIME:
            return { ...state, currentTime: action.payload };
        case actions.SET_DURATION:
            return { ...state, duration: action.payload };
        case actions.SET_VIDEO_PLAYING:
            return { ...state, isVideoPlaying: action.payload };
        case actions.SET_VIDEO_BUFFERING:
            return { ...state, isVideoBuffering: action.payload };
        case actions.SET_VIDEO_LOADING:
            return { ...state, isVideoLoading: action.payload };
        case actions.RESET:
            return initialState;
        default:
            return state;
    }
}

export function useVideoPlaybackState() {
    const [state, dispatch] = useReducer(playbackReducer, initialState);

    return {
        ...state,
        setCurrentTime: (time) => dispatch({ type: actions.SET_CURRENT_TIME, payload: time }),
        setDuration: (duration) => dispatch({ type: actions.SET_DURATION, payload: duration }),
        setIsVideoPlaying: (playing) => dispatch({ type: actions.SET_VIDEO_PLAYING, payload: playing }),
        setIsVideoBuffering: (buffering) => dispatch({ type: actions.SET_VIDEO_BUFFERING, payload: buffering }),
        setIsVideoLoading: (loading) => dispatch({ type: actions.SET_VIDEO_LOADING, payload: loading }),
        reset: () => dispatch({ type: actions.RESET }),
    };
}

