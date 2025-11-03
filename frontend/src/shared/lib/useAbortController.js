/**
 * Custom hook for managing AbortController lifecycle
 * Automatically cleans up pending requests when component unmounts
 * 
 * @returns {AbortSignal} signal - The abort signal to pass to API calls
 * 
 * Note: Do NOT include the signal in useEffect dependency arrays.
 * The signal is only for cleanup purposes and should not trigger re-fetches.
 * 
 * @example
 * const signal = useAbortController();
 * 
 * useEffect(() => {
 *   const fetchData = async () => {
 *     const data = await api.getData({ signal });
 *   };
 *   fetchData();
 * }, [videoId]); // Only include actual dependencies, NOT signal
 */
import { useEffect, useRef } from 'react';

export const useAbortController = () => {
    // Initialize with AbortController immediately to avoid undefined
    const abortControllerRef = useRef(new AbortController());

    useEffect(() => {
        // Cleanup function: abort all pending requests
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    return abortControllerRef.current.signal;
};

