/**
 * Entity: Layout Header Visibility Hook
 * Manages header visibility state and behavior
 * (Domain logic layer - no UI dependencies)
 */
import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to manage header visibility state
 * @param {Object} options - Configuration options
 * @param {boolean} options.initialVisible - Initial visibility state (default: true)
 * @param {boolean} options.persistState - Whether to persist state in sessionStorage (default: false)
 * @param {string} options.storageKey - Storage key for persistence (default: 'headerVisible')
 * @returns {Object} Header visibility controls
 */
export const useHeaderVisibility = (options = {}) => {
    const {
        initialVisible = true,
        persistState = false,
        storageKey = 'headerVisible'
    } = options;

    // Initialize state from storage if persistence enabled
    const getInitialState = () => {
        if (!persistState) return initialVisible;
        
        try {
            const stored = sessionStorage.getItem(storageKey);
            return stored !== null ? JSON.parse(stored) : initialVisible;
        } catch (err) {
            console.error('Failed to read header visibility from storage:', err);
            return initialVisible;
        }
    };

    const [isVisible, setIsVisible] = useState(getInitialState);

    // Persist state changes if enabled
    useEffect(() => {
        if (!persistState) return;

        try {
            sessionStorage.setItem(storageKey, JSON.stringify(isVisible));
        } catch (err) {
            console.error('Failed to persist header visibility:', err);
        }
    }, [isVisible, persistState, storageKey]);

    /**
     * Show the header
     */
    const show = useCallback(() => {
        setIsVisible(true);
    }, []);

    /**
     * Hide the header
     */
    const hide = useCallback(() => {
        setIsVisible(false);
    }, []);

    /**
     * Toggle header visibility
     */
    const toggle = useCallback(() => {
        setIsVisible(prev => !prev);
    }, []);

    /**
     * Set visibility explicitly
     * @param {boolean} visible - Desired visibility state
     */
    const setVisibility = useCallback((visible) => {
        setIsVisible(Boolean(visible));
    }, []);

    return {
        isVisible,
        show,
        hide,
        toggle,
        setVisibility,
    };
};

