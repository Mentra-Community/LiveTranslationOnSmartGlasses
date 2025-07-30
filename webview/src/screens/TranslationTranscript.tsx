import React, { useState, useEffect, useRef } from 'react';
import { TranslationEntry, LanguagePair } from '../types';
import { simulateTranslationStream } from '../utils/mockData';
import api from '../Api';

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
  
  // Set up SSE connection for real-time translations
  useEffect(() => {
    // Check if we're in development mode
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      console.log('Running in development mode - using mock data');
      
      // Set some mock language pair
      setLanguagePair({
        from: 'English',
        to: 'Chinese (Hanzi)'
      });
      
      // Simulate SSE connection
      setListening(true);
      
      // Start mock data stream
      const stopSimulation = simulateTranslationStream(
        (newEntry: TranslationEntry) => {
          // Update entries with the new data
          setEntries(prev => {
            // If we have no entries yet, just add this one
            if (prev.length === 0) {
              return [newEntry];
            }
            
            // Check if this is an update to an existing entry
            const existingIndex = prev.findIndex(entry => entry.id === newEntry.id);
            
            if (existingIndex >= 0) {
              // Update existing entry
              const updatedEntries = [...prev];
              updatedEntries[existingIndex] = newEntry;
              return updatedEntries;
            } else {
              // Add as new entry
              return [...prev, newEntry];
            }
          });
        },
        3000 // New entry every 3 seconds for faster testing
      );
      
      // Clean up simulation on unmount
      return () => {
        stopSimulation();
        setListening(false);
      };
    } else {
      // Production mode - connect to real API
      
      // Fetch language settings first
      api.getLanguageSettings()
        .then(data => {
          setLanguagePair({
            from: data.from,
            to: data.to
          });
        })
        .catch(error => {
          console.error('Error fetching language settings:', error);
        });
      
      // Connect to SSE
      const eventSource = new EventSource('/translation-events');
      eventSourceRef.current = eventSource;
      
      eventSource.onopen = () => {
        setListening(true);
        console.log('Connected to translation events');
      };
      
      eventSource.onerror = (error) => {
        setListening(false);
        console.error('SSE connection error:', error);
      };
      
      eventSource.addEventListener('translation', (event) => {
        try {
          const data = JSON.parse(event.data) as TranslationEntry;
          
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
              updatedEntries[existingIndex] = data;
              return updatedEntries;
            } else {
              // This is a new entry
              return [...prev, data];
            }
          });
        } catch (error) {
          console.error('Error parsing translation event:', error);
        }
      });
      
      // Clean up on unmount
      return () => {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        setListening(false);
      };
    }
  }, []);
  
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
    }
  };
  
  return (
    <div className="flex flex-col h-screen w-full mx-auto bg-gray-50">
      <header className="border-b border-gray-200 p-4">
        <h1 className="text-xl font-medium m-0">Live Translation</h1>
        <p className="text-sm text-gray-500 mt-1">
          <span className="font-medium">Bilingual Conversation:</span> {languagePair.from} ↔ {languagePair.to}
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
        className="bg-white rounded-lg m-4 p-5 shadow-sm flex-1 overflow-y-auto"
        ref={transcriptRef}
        onScroll={handleScroll}
      >
        {entries.length === 0 ? (
          <div className="text-center text-gray-400 py-10">
            No translations yet. Start speaking to see translations appear here.
          </div>
        ) : (
          entries.map(entry => (
            <div key={entry.id} className="mb-6 pb-4 border-b border-gray-100">
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
      
      <div className="fixed bottom-0 left-0 right-0 bg-gray-100 py-2.5 px-4 text-sm text-gray-500 border-t border-gray-200 text-center">
        <span className={`inline-block h-2 w-2 rounded-full mr-1.5 ${listening ? 'bg-green-500' : 'bg-gray-300'}`}></span>
        {listening ? 'Listening...' : 'Not connected'}
      </div>
    </div>
  );
};