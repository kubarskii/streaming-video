/**
 * UI Visibility State Hook
 * Manages visibility of controls, settings, and overlays
 */
import { useReducer } from 'react';

const initialState = {
    showControls: false,
    showSettings: false,
    showPlaybackRates: false,
    showQualities: false,
    showKeyboardShortcuts: false,
    volumeIndicatorVisible: false,
    volumeSliderExpanded: false,
};

const actions = {
    SET_SHOW_CONTROLS: 'SET_SHOW_CONTROLS',
    SET_SHOW_SETTINGS: 'SET_SHOW_SETTINGS',
    SET_SHOW_PLAYBACK_RATES: 'SET_SHOW_PLAYBACK_RATES',
    SET_SHOW_QUALITIES: 'SET_SHOW_QUALITIES',
    SET_SHOW_KEYBOARD_SHORTCUTS: 'SET_SHOW_KEYBOARD_SHORTCUTS',
    SET_VOLUME_INDICATOR_VISIBLE: 'SET_VOLUME_INDICATOR_VISIBLE',
    SET_VOLUME_SLIDER_EXPANDED: 'SET_VOLUME_SLIDER_EXPANDED',
    CLOSE_SETTINGS: 'CLOSE_SETTINGS',
    CLOSE_ALL: 'CLOSE_ALL',
};

function visibilityReducer(state, action) {
    switch (action.type) {
        case actions.SET_SHOW_CONTROLS:
            return { ...state, showControls: action.payload };
        case actions.SET_SHOW_SETTINGS:
            return { ...state, showSettings: action.payload };
        case actions.SET_SHOW_PLAYBACK_RATES:
            return { ...state, showPlaybackRates: action.payload };
        case actions.SET_SHOW_QUALITIES:
            return { ...state, showQualities: action.payload };
        case actions.SET_SHOW_KEYBOARD_SHORTCUTS:
            return { ...state, showKeyboardShortcuts: action.payload };
        case actions.SET_VOLUME_INDICATOR_VISIBLE:
            return { ...state, volumeIndicatorVisible: action.payload };
        case actions.SET_VOLUME_SLIDER_EXPANDED:
            return { ...state, volumeSliderExpanded: action.payload };
        case actions.CLOSE_SETTINGS:
            return {
                ...state,
                showSettings: false,
                showPlaybackRates: false,
                showQualities: false,
            };
        case actions.CLOSE_ALL:
            return {
                ...state,
                showSettings: false,
                showPlaybackRates: false,
                showQualities: false,
                showKeyboardShortcuts: false,
            };
        default:
            return state;
    }
}

export function useUIVisibilityState(initialShowControls = false) {
    const [state, dispatch] = useReducer(visibilityReducer, {
        ...initialState,
        showControls: initialShowControls,
    });

    return {
        ...state,
        setShowControls: (show) => dispatch({ type: actions.SET_SHOW_CONTROLS, payload: show }),
        setShowSettings: (show) => dispatch({ type: actions.SET_SHOW_SETTINGS, payload: show }),
        setShowPlaybackRates: (show) => dispatch({ type: actions.SET_SHOW_PLAYBACK_RATES, payload: show }),
        setShowQualities: (show) => dispatch({ type: actions.SET_SHOW_QUALITIES, payload: show }),
        setShowKeyboardShortcuts: (show) => dispatch({ type: actions.SET_SHOW_KEYBOARD_SHORTCUTS, payload: show }),
        setVolumeIndicatorVisible: (visible) => dispatch({ type: actions.SET_VOLUME_INDICATOR_VISIBLE, payload: visible }),
        setVolumeSliderExpanded: (expanded) => dispatch({ type: actions.SET_VOLUME_SLIDER_EXPANDED, payload: expanded }),
        closeSettings: () => dispatch({ type: actions.CLOSE_SETTINGS }),
        closeAll: () => dispatch({ type: actions.CLOSE_ALL }),
    };
}

