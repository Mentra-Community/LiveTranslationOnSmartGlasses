import React, { useState, useEffect, useRef } from 'react';
import { TranslationEntry, LanguagePair } from '../types';
import { useAuthenticatedApi } from '../hooks/useAuthenticatedApi';
import api from '../Api';
import { terminal } from 'virtual:terminal';
import { ArrowLeftRight, Mic, ArrowDown } from 'lucide-react';
import languages from "../soniox/Languages.json"
import { motion, AnimatePresence } from 'framer-motion';
import SplashScreen from './SplashScreen';
import Select from 'react-select';


export const TranslationTranscript: React.FC = () => {
  const [entries, setEntries] = useState<TranslationEntry[]>([]);
  const [autoscrollEnabled, setAutoscrollEnabled] = useState(true);
  const [listening, setListening] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [isCheckingUserSession, setIsCheckingUserSession] = useState(false);
  const [isUserIdAppSession, setIsUserIdAppSession] = useState(false);
  const [targetLangAvailable, setTargetLangAvailable] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLanguageLoading, setIsLanguageLoading] = useState(false);
  const [languagePair, setLanguagePair] = useState<LanguagePair>({
    from: 'English',
    to: 'Pick a language'
  });

  // Create dropdown options from languages
  const sourceLanguageOptions = Object.entries(languages as any).map(([code, lang]) => {
    const langName = Object.values((lang as any).source_language)[0] as string;
    return {
      value: code,
      label: langName.charAt(0).toUpperCase() + langName.slice(1)
    };
  });

  const targetLanguageOptions = targetLangAvailable.map(lang => ({
    value: lang.toLowerCase(),
    label: lang.charAt(0).toUpperCase() + lang.slice(1)
  }));

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

  // Helper function to capitalize first letter for display only
  const capitalizeForDisplay = (text: string): string => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  // Custom styles for React Select to match app theme
  const customSelectStyles = {
    control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
      ...base,
      backgroundColor: 'rgba(30, 41, 59, 0.8)',
      borderColor: state.isFocused ? '#3b82f6' : '#334155',
      borderRadius: '0.5rem',
      padding: '0.125rem',
      boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.5)' : 'none',
      cursor: 'pointer',
      '&:hover': {
        backgroundColor: 'rgba(30, 41, 59, 1)',
        borderColor: state.isFocused ? '#3b82f6' : '#475569',
      },
    }),
    menu: (base: Record<string, unknown>) => ({
      ...base,
      backgroundColor: 'rgba(30, 41, 59, 0.95)',
      backdropFilter: 'blur(12px)',
      border: '1px solid #334155',
      borderRadius: '0.5rem',
      overflow: 'hidden',
      zIndex: 9999,
    }),
    menuPortal: (base: Record<string, unknown>) => ({
      ...base,
      zIndex: 9999,
    }),
    option: (base: Record<string, unknown>, state: { isSelected: boolean; isFocused: boolean }) => ({
      ...base,
      backgroundColor: state.isSelected
        ? 'rgba(59, 130, 246, 0.3)'
        : state.isFocused
        ? 'rgba(59, 130, 246, 0.1)'
        : 'transparent',
      color: '#e2e8f0',
      cursor: 'pointer',
      fontSize: '0.875rem',
      fontWeight: '500',
      '&:active': {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
      },
    }),
    singleValue: (base: Record<string, unknown>) => ({
      ...base,
      color: '#e2e8f0',
      fontSize: '0.875rem',
      fontWeight: '500',
    }),
    input: (base: Record<string, unknown>) => ({
      ...base,
      color: '#e2e8f0',
    }),
    placeholder: (base: Record<string, unknown>) => ({
      ...base,
      color: '#94a3b8',
    }),
    dropdownIndicator: (base: Record<string, unknown>) => ({
      ...base,
      color: '#94a3b8',
      '&:hover': {
        color: '#cbd5e1',
      },
    }),
    indicatorSeparator: () => ({
      display: 'none',
    }),
  };

  // Check if splash should be shown based on 10-second timer
  useEffect(() => {
    const SPLASH_INTERVAL = 10 * 1000; // 10 seconds in milliseconds

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
        setIsFirstLoad(false); // Mark that first load is complete
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

  const handleSourceLanguageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSourceLangCode = e.target.value;
    if (!newSourceLangCode) return;

    setIsLanguageLoading(true);
    handleAvailableTargetLang(newSourceLangCode);

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
    } finally {
      setIsLanguageLoading(false);
    }
  };

  const handleTargetLanguageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const targetLangName = e.target.value;
    if (!targetLangName) return;

    // Skip if user selected "Pick a language"
    if (targetLangName === "pick a language") {
      return;
    }

    setIsLanguageLoading(true);

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
    } finally {
      setIsLanguageLoading(false);
    }
  };

  const swapLanguages = async () => {
    const temp = languagePair.from;
    const newFrom = languagePair.to;
    const newTo = temp;

    setIsLanguageLoading(true);

    try {
      const updatedPair = await api.updateLanguageSettings(
        { from: newFrom, to: newTo },
        getHeaders()
      );
      setLanguagePair(updatedPair);
    } catch (error) {
      terminal.error('Failed to swap languages:', error);
    } finally {
      setIsLanguageLoading(false);
    }
  };

  // Set up SSE connection for real-time translations
  useEffect(() => {
    // Don't connect if auth is still loading
    if (isLoading) return;

    terminal.log('Connecting to backend translation events...');
    terminal.log('Auth state:', { isAuthenticated, hasToken: !!token, tokenPreview: token?.substring(0, 10) + '...' });
    terminal.log('Current user token (full):', token);
    const userId = token?.split(':')[0];
    terminal.log('User email/ID from token:', userId);

    // Check if this userId has an active app session on TPA server (in memory)
    setIsCheckingUserSession(true);

    // Check if the API method exists before calling it
    if ('getUserAppActive' in api && typeof api.getUserAppActive === 'function') {
      (api as any).getUserAppActive(userId || 'unknown-user')
        .then((userActivity: any) => {
          terminal.log(`userId: ${userId} app session is ${userActivity.active ? "online" : "offline"}`);
          setIsUserIdAppSession(userActivity.active);
          setIsCheckingUserSession(false);
        })
        .catch((error: any) => {
          terminal.error('Error fetching user activity:', error);
          setIsUserIdAppSession(false);
          setIsCheckingUserSession(false);
        });
    } else {
      // If method doesn't exist, just mark as done
      terminal.log('getUserAppActive not available, skipping session check');
      setIsCheckingUserSession(false);
    }

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

  // Handle autoscroll - scroll to bottom when new entries arrive or autoscroll is enabled
  useEffect(() => {
    if (autoscrollEnabled && transcriptRef.current) {
      transcriptRef.current.scrollTo({
        top: transcriptRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [entries, autoscrollEnabled]);

  // Detect manual scrolling to temporarily disable autoscroll
  const handleScroll = () => {
    if (!transcriptRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = transcriptRef.current;
    const isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 50;

    // Only change state if needed (avoid unnecessary renders)
    if (autoscrollEnabled && !isScrolledToBottom) {
      // User scrolled up, disable autoscroll
      setAutoscrollEnabled(false);
    } else if (!autoscrollEnabled && isScrolledToBottom) {
      // User scrolled back to bottom, re-enable autoscroll
      setAutoscrollEnabled(true);
    }
  };

  // Show loading state while authentication is loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <p className="text-gray-400">Loading authentication...</p>
        </div>
      </div>
    );
  }

  // Show authentication status if not authenticated in production
  if (!isAuthenticated && process.env.NODE_ENV === 'production') {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <p className="text-gray-400">Please open this page from the MentraOS app.</p>
        </div>
      </div>
    );
  }

  // Show loading while checking user session
  if (isCheckingUserSession) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Checking connection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-4 flex flex-col overflow-hidden">
      {/* Splash Screen Overlay */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            className="fixed inset-0 z-[100] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
            initial={{ opacity: isFirstLoad ? 1 : 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          >
            <SplashScreen />
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes wave {
          0%, 100% { height: 8px; }
          50% { height: 20px; }
        }
        .bar-1 { animation: wave 0.8s ease-in-out infinite; animation-delay: 0s; }
        .bar-2 { animation: wave 0.8s ease-in-out infinite; animation-delay: 0.1s; }
        .bar-3 { animation: wave 0.8s ease-in-out infinite; animation-delay: 0.2s; }
        .bar-4 { animation: wave 0.8s ease-in-out infinite; animation-delay: 0.3s; }
        .bar-5 { animation: wave 0.8s ease-in-out infinite; animation-delay: 0.4s; }
      `}</style>

      {/* Sticky Header at Top */}
      <div className="sticky z-50 mb-6">
        <div className="max-w-sm mx-auto">
          <div className="bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-lg overflow-hidden transition-all">
          {/* Always Visible Row */}
          <div className="flex items-center justify-between p-4">
            {/* Left: Animation */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 h-8">
                <div className="w-0.5 bg-blue-500 rounded-sm bar-1"></div>
                <div className="w-0.5 bg-blue-500 rounded-sm bar-2"></div>
                <div className="w-0.5 bg-blue-500 rounded-sm bar-3"></div>
                <div className="w-0.5 bg-blue-500 rounded-sm bar-4"></div>
                <div className="w-0.5 bg-blue-500 rounded-sm bar-5"></div>
              </div>
              <span className={`text-xs font-medium ${listening ? 'text-[#00d4ff]' : 'text-blue-400'}`}>
                {listening ? 'Listening' : 'Ready'}
              </span>
            </div>

            {/* Right: Auto-scroll Toggle (Compact) + Expand Button */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAutoscrollEnabled(!autoscrollEnabled)}
                className={`relative w-10 h-5 rounded-full transition-all ${
                  autoscrollEnabled ? 'bg-gradient-to-r from-blue-500 to-purple-600' : 'bg-slate-700'
                }`}
                title={autoscrollEnabled ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full flex items-center justify-center transition-transform ${
                    autoscrollEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                >
                  <ArrowDown className={`w-2.5 h-2.5 transition-colors ${
                    autoscrollEnabled ? 'text-purple-600' : 'text-slate-400'
                  }`} />
                </div>
              </button>

              {/* <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 hover:bg-slate-700/50 rounded transition-all"
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button> */}
            </div>
          </div>

          {/* Expandable Section */}
          <div
            className={`transition-all duration-300 ease-in-out ${
              isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
            }`}
          >
            <div className="px-4 pb-4 pt-2 space-y-4 border-t border-slate-700/50">
              {/* Full Language Selector with labels */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-xs text-blue-400 font-medium mb-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                    Source
                  </label>
                  <Select
                    value={sourceLanguageOptions.find(opt => opt.value === getLanguageCodeFromDisplayName(languagePair.from))}
                    onChange={(option) => {
                      if (option) {
                        const event = { target: { value: option.value } } as React.ChangeEvent<HTMLSelectElement>;
                        handleSourceLanguageChange(event);
                      }
                    }}
                    
                    options={sourceLanguageOptions}
                    isDisabled={isLanguageLoading}
                    isSearchable={true}
                    placeholder="Search languages..."
                    styles={customSelectStyles}
                    className="react-select-container"
                    classNamePrefix="react-select capitalize"
                    menuPosition="fixed"
                    menuPortalTarget={document.body}
                  />
                </div>

                <button
                  onClick={swapLanguages}
                  disabled={isLanguageLoading}
                  className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg hover:shadow-lg hover:shadow-blue-500/50 transition-all transform active:scale-95 mt-5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100"
                  title="Swap languages"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </button>

                <div className="flex-1">
                  <label className="text-xs text-purple-400 font-medium mb-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                    Target
                  </label>
                  <Select
                    value={targetLanguageOptions.find(opt => opt.value === languagePair.to.toLowerCase()) || null}
                    onChange={(option) => {
                      if (option) {
                        const event = { target: { value: option.value } } as React.ChangeEvent<HTMLSelectElement>;
                        handleTargetLanguageChange(event);
                      }
                    }}
                    options={targetLanguageOptions}
                    isDisabled={isLanguageLoading}
                    isSearchable={true}
                    placeholder="Search..."
                    styles={customSelectStyles}
                    className="react-select-container"
                    classNamePrefix="react-select"
                    menuPosition="fixed"
                    menuPortalTarget={document.body}
                  />
                </div>
              </div>


            </div>
          </div>
          </div>
        </div>
      </div>

      {/* Translation Display */}
        <div
          ref={transcriptRef}
          onScroll={handleScroll}
          className="space-y-4 overflow-y-auto pr-2"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#475569 transparent',
            maxHeight: 'calc(100vh - 200px)'
          }}
        >
          {entries.length === 0 ? (
            <div className="text-center text-slate-400 flex flex-col items-center justify-center h-full min-h-[60vh]">
              <motion.div
                className='flex justify-center items-center p-4 rounded-full mb-4 bg-slate-800/50'
                animate={{
                  scale: [1, 1.05, 1],
                  backgroundColor: ['rgba(30, 41, 59, 0.5)', 'rgba(51, 65, 85, 0.5)', 'rgba(30, 41, 59, 0.5)']
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Mic color='white' size={32}/>
              </motion.div>
              <div className='flex flex-col items-center text-center text-sm font-medium space-y-1'>
                <span>Start speaking to see live translations</span>
                <span className="text-slate-500">We're ready to translate your conversation!</span>
              </div>
            </div>
          ) : (
            entries.map(entry => {
              // Determine if this is source → target or target → source
              const isSourceToTarget = entry.originalLanguage.toLowerCase() === languagePair.from.toLowerCase() ||
                                      entry.originalLanguage.toLowerCase().startsWith(languagePair.from.toLowerCase().slice(0, 2));

              return (
                <div
                  key={entry.id}
                  className={`rounded-lg p-4 backdrop-blur-sm transition-all ${
                    isSourceToTarget
                      ? 'bg-blue-900/20 border border-blue-700/30 hover:bg-blue-900/30'
                      : 'bg-purple-900/20 border border-purple-700/30 hover:bg-purple-900/30'
                  }`}
                >
                  <div className="text-xs font-medium text-slate-400 mb-2 flex items-center justify-between">
                    <span className={`px-2 py-1 rounded ${
                      isSourceToTarget
                        ? 'bg-blue-700/30'
                        : 'bg-purple-700/30'
                    }`}>
                      {entry.originalLanguage} → {entry.translatedLanguage}
                    </span>
                    <span className="text-slate-500">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-sm text-slate-300 mb-2">
                    {entry.originalText}
                  </div>
                  <div className="text-base text-white font-medium">
                    {entry.translatedText}
                  </div>
                </div>
              );
            })
          )}
        </div>
    </div>
  );
};
