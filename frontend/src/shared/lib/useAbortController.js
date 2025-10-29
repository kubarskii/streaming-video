/**
 * Custom hook for managing AbortController lifecycle
 * Automatically cleans up pending requests when component unmounts or dependencies change
 * 
 * @returns {AbortSignal} signal - The abort signal to pass to API calls
 * 
 * @example
 * const signal = useAbortController();
 * 
 * useEffect(() => {
 *   const fetchData = async () => {
 *     const data = await api.getData({ signal });
 *   };
 *   fetchData();
 * }, [signal]);
 */
import { useEffect, useRef } from 'react';

export const useAbortController = () => {
    const abortControllerRef = useRef(null);

    useEffect(() => {
        // Create new AbortController on mount
        abortControllerRef.current = new AbortController();

        // Cleanup function: abort all pending requests
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    return abortControllerRef.current?.signal;
};

