/**
 * API service for the Translation webview
 */
import { LanguagePair } from './types';
import { terminal } from 'virtual:terminal';

// Use environment variable for API URL, fallback to relative URLs in production
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Handler for SSE connections
let eventSourceInstance: EventSource | null = null;
const eventListeners: Record<string, ((event: MessageEvent) => void)[]> = {};

const api = {
  // Fetch language settings
  async getLanguageSettings(headers?: HeadersInit): Promise<LanguagePair> {
    try {
      const url = `${API_BASE_URL}/api/language-settings`;
      terminal.log('Fetching language settings from:', url);
      terminal.log('Headers:', headers);
      const response = await fetch(url, {
        headers: headers || {},
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      return response.json();
    } catch (error) {
      terminal.error('Error fetching language settings:', error);
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
        terminal.log('✅ SSE connection established with translation server');
      };
      
      eventSourceInstance.onerror = (error) => {
        terminal.error('❌ SSE connection error:', error);
        
        // Auto-reconnect if closed
        if (eventSourceInstance?.readyState === EventSource.CLOSED) {
          terminal.log('🔄 Attempting to reconnect to translation server...');
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