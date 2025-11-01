/**
 * Simple Finite State Machine (FSM) Implementation
 * 
 * Creates a state machine that ensures valid state transitions
 * and provides predictable behavior for complex state logic.
 * 
 * @example
 * const machine = createStateMachine({
 *   id: 'toggle',
 *   initial: 'off',
 *   states: {
 *     off: { on: { TOGGLE: 'on' } },
 *     on: { on: { TOGGLE: 'off' } }
 *   }
 * });
 */

/**
 * Creates a finite state machine
 * @param {Object} config - Machine configuration
 * @param {string} config.id - Unique identifier for the machine
 * @param {string} config.initial - Initial state
 * @param {Object} config.states - State definitions with transitions
 * @returns {Object} State machine instance
 */
export const createStateMachine = (config) => {
    const { id, initial, states } = config;

    if (!id) {
        throw new Error('State machine must have an id');
    }

    if (!initial) {
        throw new Error('State machine must have an initial state');
    }

    if (!states || typeof states !== 'object') {
        throw new Error('State machine must have states defined');
    }

    if (!states[initial]) {
        throw new Error(`Initial state "${initial}" not found in states`);
    }

    let currentState = initial;
    const listeners = new Set();

    /**
     * Get current state
     */
    const getState = () => currentState;

    /**
     * Send an event to trigger a transition
     * @param {string} event - Event name
     * @returns {boolean} - Whether transition occurred
     */
    const send = (event) => {
        const stateConfig = states[currentState];

        if (!stateConfig || !stateConfig.on) {
            console.warn(`No transitions defined for state "${currentState}"`);
            return false;
        }

        const nextState = stateConfig.on[event];

        if (!nextState) {
            console.warn(`No transition for event "${event}" in state "${currentState}"`);
            return false;
        }

        if (!states[nextState]) {
            console.error(`Target state "${nextState}" not found in state machine`);
            return false;
        }

        const previousState = currentState;
        currentState = nextState;

        // Notify all listeners
        listeners.forEach(listener => {
            listener({
                from: previousState,
                to: nextState,
                event,
            });
        });

        return true;
    };

    /**
     * Check if a transition is possible
     * @param {string} event - Event name
     * @returns {boolean}
     */
    const can = (event) => {
        const stateConfig = states[currentState];
        return !!(stateConfig?.on?.[event]);
    };

    /**
     * Subscribe to state changes
     * @param {Function} listener - Callback function
     * @returns {Function} Unsubscribe function
     */
    const subscribe = (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };

    /**
     * Reset to initial state
     */
    const reset = () => {
        const previousState = currentState;
        currentState = initial;

        listeners.forEach(listener => {
            listener({
                from: previousState,
                to: initial,
                event: 'RESET',
            });
        });
    };

    /**
     * Get all possible transitions from current state
     * @returns {string[]} Array of event names
     */
    const getPossibleTransitions = () => {
        const stateConfig = states[currentState];
        return stateConfig?.on ? Object.keys(stateConfig.on) : [];
    };

    return {
        id,
        getState,
        send,
        can,
        subscribe,
        reset,
        getPossibleTransitions,
    };
};

// For backwards compatibility
export const createMachine = createStateMachine;

