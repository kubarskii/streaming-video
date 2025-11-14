/**
 * Up Next State Hook
 * Manages the "Up Next" overlay and countdown state
 */
import { useReducer } from 'react';

const initialState = {
    showUpNext: false,
    upNextCountdown: null,
};

const actions = {
    SET_SHOW_UP_NEXT: 'SET_SHOW_UP_NEXT',
    SET_COUNTDOWN: 'SET_COUNTDOWN',
    START_COUNTDOWN: 'START_COUNTDOWN',
    STOP_COUNTDOWN: 'STOP_COUNTDOWN',
};

function upNextReducer(state, action) {
    switch (action.type) {
        case actions.SET_SHOW_UP_NEXT:
            return { ...state, showUpNext: action.payload };
        case actions.SET_COUNTDOWN:
            return { ...state, upNextCountdown: action.payload };
        case actions.START_COUNTDOWN:
            return {
                ...state,
                showUpNext: true,
                upNextCountdown: action.payload,
            };
        case actions.STOP_COUNTDOWN:
            return {
                ...state,
                showUpNext: false,
                upNextCountdown: null,
            };
        default:
            return state;
    }
}

export function useUpNextState() {
    const [state, dispatch] = useReducer(upNextReducer, initialState);

    return {
        ...state,
        setShowUpNext: (show) => dispatch({ type: actions.SET_SHOW_UP_NEXT, payload: show }),
        setCountdown: (countdown) => dispatch({ type: actions.SET_COUNTDOWN, payload: countdown }),
        startCountdown: (initialCountdown) => dispatch({ type: actions.START_COUNTDOWN, payload: initialCountdown }),
        stopCountdown: () => dispatch({ type: actions.STOP_COUNTDOWN }),
    };
}

