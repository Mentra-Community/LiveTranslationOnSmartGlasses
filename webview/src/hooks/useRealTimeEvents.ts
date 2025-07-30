/**
 * Hook for subscribing to SSE events
 */

import { useEffect, useCallback } from 'react';
import api from '../Api';

/**
 * Subscribe to SSE events
 * @param eventName The name of the event to subscribe to
 * @param callback The callback to execute when the event is received
 */
export function useRealTimeEvents<T>(
  eventName: string,
  callback: (data: T) => void
) {
  // Wrap callback in useCallback to avoid unnecessary re-renders
  const stableCallback = useCallback((data: T) => {
    callback(data);
  }, [callback]);

  useEffect(() => {
    // Ensure connection
    api.events.connect();
    
    // Create handler
    const handleEvent = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        stableCallback(data);
      } catch (error) {
        console.error(`Error parsing SSE event data for ${eventName}:`, error);
      }
    };
    
    // Register
    api.events.addEventListener(eventName, handleEvent);
    
    // Clean up on unmount
    return () => {
      api.events.removeEventListener(eventName, handleEvent);
    };
  }, [eventName, stableCallback]);
}