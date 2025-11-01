/**
 * React Hook for Finite State Machine
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { createStateMachine } from './createStateMachine';

/**
 * React Hook for using a state machine
 * @param {Object} machineConfig - Machine configuration
 * @returns {Array} [currentState, send, machine]
 */
export const useStateMachine = (machineConfig) => {
    const [currentState, setCurrentState] = useState(machineConfig.initial);
    const machineRef = useRef(null);

    if (!machineRef.current) {
        machineRef.current = createStateMachine(machineConfig);
    }

    useEffect(() => {
        const machine = machineRef.current;

        const unsubscribe = machine.subscribe((transition) => {
            setCurrentState(transition.to);
        });

        return unsubscribe;
    }, []);

    const send = useCallback((event) => {
        return machineRef.current.send(event);
    }, []);

    const can = useCallback((event) => {
        return machineRef.current.can(event);
    }, []);

    const reset = useCallback(() => {
        machineRef.current.reset();
    }, []);

    return [currentState, send, { can, reset, machine: machineRef.current }];
};

