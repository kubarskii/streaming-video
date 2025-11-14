/**
 * User Preferences State Hook
 * Manages user preferences (volume, muted, playback rate, quality)
 */
import { useReducer } from 'react';
import { getStorageNumber, setStorageItem } from '../../../../shared/lib/utils';
import { PLAYER_CONSTANTS } from '../../../../shared/config/videoPlayer.constants';

const initialState = {
    volume: getStorageNumber(PLAYER_CONSTANTS.STORAGE_KEYS.VOLUME, PLAYER_CONSTANTS.VOLUME_DEFAULT),
    isMuted: false,
    playbackRate: PLAYER_CONSTANTS.PLAYBACK_RATE_DEFAULT,
    selectedQuality: null,
};

const actions = {
    SET_VOLUME: 'SET_VOLUME',
    SET_MUTED: 'SET_MUTED',
    TOGGLE_MUTE: 'TOGGLE_MUTE',
    SET_PLAYBACK_RATE: 'SET_PLAYBACK_RATE',
    SET_SELECTED_QUALITY: 'SET_SELECTED_QUALITY',
};

function preferencesReducer(state, action) {
    switch (action.type) {
        case actions.SET_VOLUME: {
            const volume = Math.max(
                PLAYER_CONSTANTS.VOLUME_MIN,
                Math.min(PLAYER_CONSTANTS.VOLUME_MAX, action.payload)
            );
            setStorageItem(PLAYER_CONSTANTS.STORAGE_KEYS.VOLUME, volume);
            return {
                ...state,
                volume,
                // Auto-unmute when volume is set above 0
                isMuted: volume > 0 && state.isMuted ? false : state.isMuted,
            };
        }
        case actions.SET_MUTED:
            return { ...state, isMuted: action.payload };
        case actions.TOGGLE_MUTE:
            return { ...state, isMuted: !state.isMuted };
        case actions.SET_PLAYBACK_RATE:
            return { ...state, playbackRate: action.payload };
        case actions.SET_SELECTED_QUALITY:
            return { ...state, selectedQuality: action.payload };
        default:
            return state;
    }
}

export function useUserPreferencesState() {
    const [state, dispatch] = useReducer(preferencesReducer, initialState);

    return {
        ...state,
        setVolume: (volume) => dispatch({ type: actions.SET_VOLUME, payload: volume }),
        setMuted: (muted) => dispatch({ type: actions.SET_MUTED, payload: muted }),
        toggleMute: () => dispatch({ type: actions.TOGGLE_MUTE }),
        setPlaybackRate: (rate) => dispatch({ type: actions.SET_PLAYBACK_RATE, payload: rate }),
        setSelectedQuality: (quality) => dispatch({ type: actions.SET_SELECTED_QUALITY, payload: quality }),
    };
}

