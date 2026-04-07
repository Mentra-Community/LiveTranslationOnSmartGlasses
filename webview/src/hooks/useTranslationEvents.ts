import { useEffect, useCallback } from 'react';
import api from '../Api';
import { TranslationEntry } from '../types';

export function useTranslationEvents(
  callback: (data: TranslationEntry) => void
) {
  const handleEvent = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      callback(data);
    } catch (error) {
      console.error('Error parsing translation event data:', error);
    }
  }, [callback]);

  useEffect(() => {
    // Connect to SSE
    api.events.connect();
    
    // Add event listener for translation events
    api.events.addEventListener('translation', handleEvent);
    
    // Clean up
    return () => {
      api.events.removeEventListener('translation', handleEvent);
    };
  }, [handleEvent]);
}