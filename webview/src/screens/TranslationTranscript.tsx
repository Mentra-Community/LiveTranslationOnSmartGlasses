import React, { useState, useEffect, useRef } from 'react';
import { TranslationEntry, LanguagePair } from '../types';
import { useAuthenticatedApi } from '../hooks/useAuthenticatedApi';
import api from '../Api';
import { terminal } from 'virtual:terminal';
import { ArrowLeftRight, Languages, Mic, MoveRight, ScrollText } from 'lucide-react';
import { Switch } from '../components/ui/switch';
import SplashScreen from './SplashScreen';
import Select from "react-select";
import languages from "../soniox/Languages.json"
import { motion } from 'framer-motion';

export const TranslationTranscript: React.FC = () => {
  const [entries, setEntries] = useState<TranslationEntry[]>([]);
  const [autoscrollEnabled, setAutoscrollEnabled] = useState(true);
  const [listening, setListening] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [targetLangAvailable, setTargetLangAvailable] = useState<string[]>([]);
  
  // Prepare options for React Select dropdowns
  const sourceLanguageOptions = Object.entries(languages).map(([code, lang]) => {
    const displayName = (Object.values((lang as any).source_language)[0] as string).charAt(0).toUpperCase() + (Object.values((lang as any).source_language)[0] as string).slice(1);
    return {
      value: code,
      label: displayName
    };
  });

  const targetLanguageOptions = [
    { value: "pick a language", label: "Pick a language" },
    ...targetLangAvailable.map(lang => ({
      value: lang.toLowerCase(),
      label: lang.charAt(0).toUpperCase() + lang.slice(1)
    }))
  ];





  const [languagePair, setLanguagePair] = useState<LanguagePair>({
    from: 'English',
    to: 'Pick a language'
  });

  // Helper function to convert display name back to language code for dropdown
  const getLanguageCodeFromDisplayName = (displayName: string): string => {
    // Handle special cases
    if (displayName === 'Unknown' || displayName === 'Pick a language') {
      return 'en'; // Default to English
    }
    
    for (const [code, lang] of Object.entries(languages as any)) {
      const langDisplayName = Object.values((lang as any).source_language)[0] as string;
      const formattedDisplayName = langDisplayName.charAt(0).toUpperCase() + langDisplayName.slice(1);
      if (formattedDisplayName === displayName) {
        return code;
      }
    }
    return 'en'; // fallback to English if not found
  };

  const transcriptRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const { getHeaders, getAuthQuery, isAuthenticated, isLoading, token } = useAuthenticatedApi();

  // Check if splash should be shown based on 10-minute timer
  useEffect(() => {
    const SPLASH_INTERVAL = 10 * 60 * 1000; // 10 minutes in milliseconds
    // const SPLASH_INTERVAL = 20000; // 10 minutes in milliseconds

    const SPLASH_DURATION = 3000; // 3 seconds
    const lastSplashTime = localStorage.getItem('lastSplashTime');
    const currentTime = Date.now();

    if (!lastSplashTime || (currentTime - parseInt(lastSplashTime)) >= SPLASH_INTERVAL) {
      // Show splash screen
      setShowSplash(true);
      localStorage.setItem('lastSplashTime', currentTime.toString());
      
      // Hide splash after 3 seconds
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, SPLASH_DURATION);

      return () => clearTimeout(timer);
    }
  }, []);

  // Separate useEffect to handle hiding splash after it's shown
  useEffect(() => {
    if (showSplash) {
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [showSplash]);

  // Initialize target languages when languagePair.from changes
  useEffect(() => {
    if (languagePair.from && languagePair.from !== 'Unknown') {
      const sourceCode = getLanguageCodeFromDisplayName(languagePair.from);
      handleAvailableTargetLang(sourceCode);
    }
  }, [languagePair.from]);

  // Initialize with English on component mount
  useEffect(() => {
    handleAvailableTargetLang('en'); // Set up English target options on load
  }, []);

  const handleAvailableTargetLang = (lang: string) => {
    const langEntry = (languages as any)[lang];
    if (!langEntry) return [];

    const targets = langEntry.supported_target_languages.map(
      (obj: any) => Object.values(obj)[0] as string
    );
    
    setTargetLangAvailable(targets); // update state
    return targets; // return fresh list
  };

  const handleSourceLanguageChange = async (selectedOption: any) => {
    if (!selectedOption) return;
    
    handleAvailableTargetLang(selectedOption.value);
    const newSourceLangCode = selectedOption.value;
    
    // Convert language code to display name for backend
    const langEntry = (languages as any)[newSourceLangCode];
    const newSourceLangDisplayName = langEntry ? 
      Object.values(langEntry.source_language)[0] as string : 
      newSourceLangCode;
    
    // Capitalize the first letter to match backend expectations
    const formattedSourceLang = typeof newSourceLangDisplayName === 'string' ? 
      newSourceLangDisplayName.charAt(0).toUpperCase() + newSourceLangDisplayName.slice(1) : 
      newSourceLangCode;
    
    terminal.log('Source language changed to:', formattedSourceLang);
    
    try {
      // Get available target languages and set to first available option
      const availableTargets = handleAvailableTargetLang(newSourceLangCode);
      const defaultTarget = availableTargets.length > 0 ? 
        availableTargets[0].charAt(0).toUpperCase() + availableTargets[0].slice(1) : 
        'Pick a language';
      
      const updatedPair = await api.updateLanguageSettings(
        { from: formattedSourceLang, to: defaultTarget },
        getHeaders()
      );
      setLanguagePair(updatedPair);
    } catch (error) {
      terminal.error('Failed to update source language:', error);
    }
  };

  const handleTargetLanguageChange = async (selectedOption: any) => {
    if (!selectedOption) return;
    
    const targetLangName = selectedOption.value;
    
    // Skip if user selected "Pick a language"
    if (targetLangName === "pick a language") {
      return;
    }
    
    // Capitalize the first letter to match backend expectations
    const formattedTargetLang = targetLangName.charAt(0).toUpperCase() + targetLangName.slice(1);

    terminal.log('Target language changed to:', formattedTargetLang);
    console.log("target lang changed to", formattedTargetLang);
    
    try {
      const updatedPair = await api.updateLanguageSettings(
        { to: formattedTargetLang },
        getHeaders()
      );
      setLanguagePair(updatedPair);
    } catch (error) {
      terminal.error('Failed to update target language:', error);
    }
  };

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
        // Set default language pair if API fails - default to English
        setLanguagePair({
          from: 'English',
          to: 'Pick a language'
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
      {!showSplash ? 
            <>
       <header className="flex flex-row  border-b border-gray-200 p-4 w-full  bg-[#202020]  justify-center items-center ">
          <h1 className='text-white font-bold text-xl flex items-center gap-2 flex-1'>
            <Languages className="w-6 h-6" />
            Translation
          </h1>
          <div className="status-indicator">
            <div className="text-xs text-white mt-1">
              <span className={`inline-block h-2 w-2 rounded-full mr-1.5 ${listening ? 'bg-[#ffffff]' : 'bg-gray-300'}`}></span>
              {listening ? 'Listening...' : 'Not connected'}
            </div>
          </div>
      </header>

      <div className=" flex flex-row pt-[10px] pb-[10px] border-b border-gray-200 justify-center items-center gap-3 pr-[15px] pl-[15px] ">
        <Select
          options={sourceLanguageOptions}
          value={sourceLanguageOptions.find(option => option.value === getLanguageCodeFromDisplayName(languagePair.from))}
          onChange={handleSourceLanguageChange}
          isSearchable={true}
          placeholder="Select source language..."
          className="w-full text-[13px]"
          styles={{
            control: (base) => ({
              ...base,
              height: '40px',
              minHeight: '40px',
              border: '1px solid rgb(209 213 219)',
              borderRadius: '6px',
              fontSize: '13px'
            }),
            valueContainer: (base) => ({
              ...base,
              height: '40px',
              padding: '0 8px'
            }),
            input: (base) => ({
              ...base,
              margin: '0px'
            }),
            indicatorSeparator: () => ({
              display: 'none'
            }),
            indicatorsContainer: (base) => ({
              ...base,
              height: '40px'
            })
          }}
        />

        <div className='flex flex-col w-[40px] h-[40px]  justify-center items-center rounded-full bg-[#303030] p-[12px] text-[white]'>
          <MoveRight size={40} className='' />
          <p className=' absolute text-[5px] mt-[-3px] font-bold mb-[-20px]'> TO</p>

        </div>

        <Select
          options={targetLanguageOptions}
          value={targetLanguageOptions.find(option => option.value === languagePair.to.toLowerCase())}
          onChange={handleTargetLanguageChange}
          isSearchable={true}
          placeholder="Pick a language..."
          className="w-full text-[13px]"
          styles={{
            control: (base) => ({
              ...base,
              height: '40px',
              minHeight: '40px',
              border: '1px solid rgb(209 213 219)',
              borderRadius: '6px',
              fontSize: '13px'
            }),
            valueContainer: (base) => ({
              ...base,
              height: '40px',
              padding: '0 8px'
            }),
            input: (base) => ({
              ...base,
              margin: '0px'
            }),
            indicatorSeparator: () => ({
              display: 'none'
            }),
            indicatorsContainer: (base) => ({
              ...base,
              height: '40px'
            })
          }}
        />
      </div>

      <div className='border-b border-gray-200 p-4 flex items-center gap-2'>
        <ScrollText color='#374151' />
        <p color='#374151' className='flex-1'>Auto-scroll</p>
        <Switch 
          checked={autoscrollEnabled} 
          onCheckedChange={setAutoscrollEnabled}
          className="data-[state=checked]:bg-[#303030]"
        />
      </div>
      



      <div
        className="bg-white flex-1 overflow-y-auto gap-[10px] flex flex-col p-4"
        ref={transcriptRef}
        onScroll={handleScroll}
        style={{ paddingBottom: '100px' }}
      >
        {entries.length === 0 ? (
          <div className="text-center text-gray-400 py-10 flex flex-col h-full justify-center items-center">
            <motion.div 
              className='flex justify-center items-center p-[15px] rounded-full mb-[10px]'
              animate={{
                scale: [1, 1.05, 1],
                backgroundColor: ['#000000', '#4d4e50', '#000000']
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <Mic color='white' size={40}/>
            </motion.div>
            <div className='flex flex-col text-[15px] font-bold'>
              <span>Start speaking to see live translations</span>
              <span>appear here. We're ready to translate</span>
              <span>your conversation!</span>
            </div>
            
          </div>
        ) : (
          entries.map(entry => (
            <div className='bg-[#8b8b8b] rounded-[20px] shadow-md'>
              <div key={entry.id} className={` pb-4 rounded-[20px] ml-[5px]  ${
                // Use different shades based on translation direction
                // Compare just the first few characters to handle variations
                entry.originalLanguage === languagePair.from || 
                entry.originalLanguage.toLowerCase() === languagePair.from.toLowerCase() ? 
                  'bg-white' : 'bg-gray-100'
              } p-4`}>
                <div className="text-sm font-medium text-white mb-2 flex items-center">
                  <span className="bg-gray-400 px-2 py-0.5 rounded">
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
            </div>
            
          ))
        )}
      </div>

      {/* <div className="fixed bottom-0 left-0 right-0 bg-gray-100 py-2.5 px-4 text-sm text-gray-500 border-t border-gray-200 text-center">
        <span className={`inline-block h-2 w-2 rounded-full mr-1.5 ${listening ? 'bg-green-500' : 'bg-gray-300'}`}></span>
        {listening ? 'Listening...' : 'Not connected'}
      </div> */}
      </>
      
      : <SplashScreen/>}

     
    </div>
  );
};