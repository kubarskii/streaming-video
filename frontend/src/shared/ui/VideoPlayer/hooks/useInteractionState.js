/**
 * Interaction State Hook
 * Manages user interaction state (dragging, hover, seek overlay)
 */
import { useReducer } from 'react';

const initialState = {
    isDragging: false,
    hoverTime: null,
    hoverPosition: 0,
    wasPlayingBeforeDrag: false,
    seekOverlay: {
        visible: false,
        direction: 'forward',
        count: 1,
        x: 0,
        y: 0,
    },
};

const actions = {
    SET_DRAGGING: 'SET_DRAGGING',
    SET_HOVER_TIME: 'SET_HOVER_TIME',
    SET_HOVER_POSITION: 'SET_HOVER_POSITION',
    SET_WAS_PLAYING_BEFORE_DRAG: 'SET_WAS_PLAYING_BEFORE_DRAG',
    SET_SEEK_OVERLAY: 'SET_SEEK_OVERLAY',
    CLEAR_HOVER: 'CLEAR_HOVER',
    START_DRAG: 'START_DRAG',
    END_DRAG: 'END_DRAG',
};

function interactionReducer(state, action) {
    switch (action.type) {
        case actions.SET_DRAGGING:
            return { ...state, isDragging: action.payload };
        case actions.SET_HOVER_TIME:
            return { ...state, hoverTime: action.payload };
        case actions.SET_HOVER_POSITION:
            return { ...state, hoverPosition: action.payload };
        case actions.SET_WAS_PLAYING_BEFORE_DRAG:
            return { ...state, wasPlayingBeforeDrag: action.payload };
        case actions.SET_SEEK_OVERLAY:
            return { ...state, seekOverlay: { ...state.seekOverlay, ...action.payload } };
        case actions.CLEAR_HOVER:
            return {
                ...state,
                hoverTime: null,
                hoverPosition: 0,
            };
        case actions.START_DRAG:
            return {
                ...state,
                isDragging: true,
                wasPlayingBeforeDrag: action.payload.wasPlaying,
            };
        case actions.END_DRAG:
            return {
                ...state,
                isDragging: false,
                hoverTime: null,
                hoverPosition: 0,
            };
        default:
            return state;
    }
}

export function useInteractionState() {
    const [state, dispatch] = useReducer(interactionReducer, initialState);

    return {
        ...state,
        setIsDragging: (dragging) => dispatch({ type: actions.SET_DRAGGING, payload: dragging }),
        setHoverTime: (time) => dispatch({ type: actions.SET_HOVER_TIME, payload: time }),
        setHoverPosition: (position) => dispatch({ type: actions.SET_HOVER_POSITION, payload: position }),
        setWasPlayingBeforeDrag: (wasPlaying) => dispatch({ type: actions.SET_WAS_PLAYING_BEFORE_DRAG, payload: wasPlaying }),
        setSeekOverlay: (overlay) => dispatch({ type: actions.SET_SEEK_OVERLAY, payload: overlay }),
        clearHover: () => dispatch({ type: actions.CLEAR_HOVER }),
        startDrag: (wasPlaying) => dispatch({ type: actions.START_DRAG, payload: { wasPlaying } }),
        endDrag: () => dispatch({ type: actions.END_DRAG }),
    };
}

