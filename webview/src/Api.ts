/**
 * API service for the Translation webview
 */
import { LanguagePair } from './types';

// Use relative URLs for our API endpoints since we're serving from the same origin
const API_BASE_URL = '';

// Handler for SSE connections
let eventSourceInstance: EventSource | null = null;
const eventListeners: Record<string, ((event: MessageEvent) => void)[]> = {};

const api = {
  // Fetch language settings
  async getLanguageSettings(): Promise<LanguagePair> {
    try {
      const response = await fetch(`${API_BASE_URL}/language-settings`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('Error fetching language settings:', error);
      return { from: 'Unknown', to: 'Unknown' };
    }
  },
  
  // Events (SSE) endpoints
  events: {
    connect: (): EventSource | null => {
      if (eventSourceInstance && eventSourceInstance.readyState !== EventSource.CLOSED) {
        return eventSourceInstance;
      }
      
      const eventUrl = `${API_BASE_URL}/translation-events`;
      
      eventSourceInstance = new EventSource(eventUrl);
      
      // Handle connection events
      eventSourceInstance.onopen = () => {
        console.log('SSE connection established with translation server');
      };
      
      eventSourceInstance.onerror = (error) => {
        console.error('SSE connection error:', error);
        
        // Auto-reconnect if closed
        if (eventSourceInstance?.readyState === EventSource.CLOSED) {
          console.log('Attempting to reconnect to translation server...');
          eventSourceInstance = null;
          setTimeout(() => api.events.connect(), 3000);
        }
      };
      
      // Re-attach any existing listeners
      Object.entries(eventListeners).forEach(([eventName, listeners]) => {
        listeners.forEach(listener => {
          eventSourceInstance?.addEventListener(eventName, listener as EventListener);
        });
      });
      
      return eventSourceInstance;
    },
    
    addEventListener: (eventName: string, callback: (event: MessageEvent) => void): void => {
      if (!eventListeners[eventName]) {
        eventListeners[eventName] = [];
      }
      
      eventListeners[eventName].push(callback);
      
      // Make sure we have a connection
      const source = api.events.connect();
      source?.addEventListener(eventName, callback as EventListener);
    },
    
    removeEventListener: (eventName: string, callback: (event: MessageEvent) => void): void => {
      if (eventListeners[eventName]) {
        eventListeners[eventName] = eventListeners[eventName].filter(cb => cb !== callback);
      }
      
      eventSourceInstance?.removeEventListener(eventName, callback as EventListener);
    },
    
    close: (): void => {
      if (eventSourceInstance) {
        eventSourceInstance.close();
        eventSourceInstance = null;
      }
      
      // Clear listeners
      Object.keys(eventListeners).forEach(key => {
        eventListeners[key] = [];
      });
    }
  }
};

export default api;