import React, { useState, useEffect, useRef } from 'react';
import { TranslationEntry, LanguagePair } from '../types';
import { useAuthenticatedApi } from '../hooks/useAuthenticatedApi';
import api from '../Api';
import { terminal } from 'virtual:terminal';

export const TranslationTranscript: React.FC = () => {
  const [entries, setEntries] = useState<TranslationEntry[]>([]);
  const [autoscrollEnabled, setAutoscrollEnabled] = useState(true);
  const [listening, setListening] = useState(false);
  const [languagePair, setLanguagePair] = useState<LanguagePair>({
    from: 'Unknown',
    to: 'Unknown'
  });

  const transcriptRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const { getHeaders, getAuthQuery, isAuthenticated, isLoading, token } = useAuthenticatedApi();

  // Set up SSE connection for real-time translations
  useEffect(() => {
    // Don't connect if auth is still loading
    if (isLoading) return;

    terminal.log('Connecting to backend translation events...');
    terminal.log('Auth state:', { isAuthenticated, hasToken: !!token, tokenPreview: token?.substring(0, 10) + '...' });

    // Fetch language settings first
    api.getLanguageSettings(getHeaders())
      .then(data => {
        setLanguagePair({
          from: data.from,
          to: data.to
        });
      })
      .catch(error => {
        console.error('Error fetching language settings:', error);
        // Set default language pair if API fails
        setLanguagePair({
          from: 'Unknown',
          to: 'Unknown'
        });
      });

    // Connect to SSE using environment variable and auth token
    const baseUrl = import.meta.env.VITE_API_URL || '';
    const authQuery = getAuthQuery();
    const sseUrl = `${baseUrl}/translation-events${authQuery}`;
    terminal.log('SSE URL:', sseUrl);
    terminal.log('Auth query:', authQuery);
    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setListening(true);
      terminal.log('✅ Connected to translation events');
    };

    eventSource.onerror = (error) => {
      setListening(false);
      terminal.error('❌ SSE connection error:', error);
    };

    // Listen for the connected event
    eventSource.addEventListener('connected', (event) => {
      terminal.log('SSE connected event received:', event.data);
    });

    // Listen for the clear event (when conversation is cleared due to inactivity)
    eventSource.addEventListener('clear', () => {
      terminal.log('SSE clear event received - resetting conversation');
      setEntries([]);
    });

    // Listen for language change events
    eventSource.addEventListener('languageChange', (event) => {
      try {
        const data = JSON.parse(event.data) as LanguagePair;
        terminal.log('SSE language change event received:', data);
        setLanguagePair({
          from: data.from,
          to: data.to
        });
      } catch (error) {
        terminal.error('Error parsing language change event:', error);
      }
    });

    eventSource.addEventListener('translation', (event) => {
      try {
        const data = JSON.parse(event.data) as TranslationEntry;
        terminal.log('Received translation event:', {
          id: data.id,
          isFinal: data.isFinal,
          originalLang: data.originalLanguage,
          translatedLang: data.translatedLanguage
        });

        // Update entries based on the entry ID
        setEntries(prev => {
          // If we have no entries yet, just add this one
          if (prev.length === 0) {
            return [data];
          }

          // Look for an existing entry with the same ID
          const existingIndex = prev.findIndex(entry => entry.id === data.id);

          if (existingIndex >= 0) {
            // This is an update to an existing entry
            const updatedEntries = [...prev];
            // If this is a final entry without originalText, preserve it from the interim
            if (data.isFinal && !data.originalText && updatedEntries[existingIndex].originalText) {
              data.originalText = updatedEntries[existingIndex].originalText;
            }
            updatedEntries[existingIndex] = data;
            return updatedEntries;
          } else {
            // This is a new entry - only add if it has originalText or is interim
            if (data.originalText || !data.isFinal) {
              return [...prev, data];
            }
            // Skip finals without originalText that aren't updates
            return prev;
          }
        });
      } catch (error) {
        terminal.error('Error parsing translation event:', error, 'Raw data:', event.data);
      }
    });

    // Clean up on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      setListening(false);
    };
  }, [isLoading, getHeaders, getAuthQuery, isAuthenticated, token]); // Dependencies for API calls

  // Handle autoscroll
  useEffect(() => {
    if (autoscrollEnabled && transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [entries, autoscrollEnabled]);

  // Detect manual scrolling to temporarily disable autoscroll
  const handleScroll = () => {
    if (!transcriptRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = transcriptRef.current;
    const isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 20;

    // Only change state if needed (avoid unnecessary renders)
    if (autoscrollEnabled && !isScrolledToBottom) {
      setAutoscrollEnabled(false);
    } else if (!autoscrollEnabled && isScrolledToBottom) {
      // Re-enable autoscroll when user scrolls back to bottom
      setAutoscrollEnabled(true);
    }
  };

  // Show loading state while authentication is loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-600">Loading authentication...</p>
        </div>
      </div>
    );
  }

  // Show authentication status if not authenticated in production
  if (!isAuthenticated && process.env.NODE_ENV === 'production') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-600">Please open this page from the MentraOS app.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full mx-auto bg-gray-50">
      <header className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-medium m-0">Live Translation</h1>
          <div className="text-sm text-gray-500 mt-1">
            <span className={`inline-block h-2 w-2 rounded-full mr-1.5 ${listening ? 'bg-green-500' : 'bg-gray-300'}`}></span>
            {listening ? 'Listening...' : 'Not connected'}
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {languagePair.from} ↔ {languagePair.to}
        </p>
        <div className="mt-2 flex items-center">
          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              className="mr-2"
              checked={autoscrollEnabled}
              onChange={() => setAutoscrollEnabled(!autoscrollEnabled)}
            />
            Auto-scroll
          </label>
        </div>
      </header>

      <div
        className="bg-white flex-1 overflow-y-auto"
        ref={transcriptRef}
        onScroll={handleScroll}
        style={{ paddingBottom: '100px' }}
      >
        {entries.length === 0 ? (
          <div className="text-center text-gray-400 py-10">
            No translations yet. Start speaking to see translations appear here.
          </div>
        ) : (
          entries.map(entry => (
            <div key={entry.id} className={` pb-4 border-b border-gray-100 ${
              // Use different shades based on translation direction
              // Compare just the first few characters to handle variations
              entry.originalLanguage === languagePair.from || 
              entry.originalLanguage.toLowerCase() === languagePair.from.toLowerCase() ? 
                'bg-white' : 'bg-gray-100'
            } p-4`}>
              <div className="text-sm font-medium text-blue-600 mb-2 flex items-center">
                <span className="bg-blue-100 px-2 py-0.5 rounded">
                  {entry.originalLanguage} → {entry.translatedLanguage}
                </span>
              </div>
              <div className="text-sm text-gray-600 mb-1.5">
                {entry.originalText}
              </div>
              <div className="text-lg text-gray-900 font-medium">
                {entry.translatedText}
              </div>
              <div className="text-xs text-gray-400 mt-2 text-right">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>

      {/* <div className="fixed bottom-0 left-0 right-0 bg-gray-100 py-2.5 px-4 text-sm text-gray-500 border-t border-gray-200 text-center">
        <span className={`inline-block h-2 w-2 rounded-full mr-1.5 ${listening ? 'bg-green-500' : 'bg-gray-300'}`}></span>
        {listening ? 'Listening...' : 'Not connected'}
      </div> */}
    </div>
  );
};