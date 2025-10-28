/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import { TranslationEntry, LanguagePair } from '../types';
import { useAuthenticatedApi } from '../hooks/useAuthenticatedApi';
import api from '../Api';
import { terminal } from 'virtual:terminal';
import TpaConnectionError from './TpaConnectionError';
// import

import { ArrowLeftRight, Mic, ArrowDown } from 'lucide-react';
import languages from "../soniox/Languages.json"
import { motion, AnimatePresence } from 'framer-motion';
import SplashScreen from './SplashScreen';
import { Select, MenuItem, ListSubheader } from '@mui/material';


export const TranslationTranscript: React.FC = () => {
  const [entries, setEntries] = useState<TranslationEntry[]>([]);
  const [autoscrollEnabled, setAutoscrollEnabled] = useState(true);
  const [isUserIdAppSession, setIsUserIdAppSession] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [isCheckingUserSession, setIsCheckingUserSession] = useState(false);
  const [targetLangAvailable, setTargetLangAvailable] = useState<string[]>([]);
  const [isLanguageLoading, setIsLanguageLoading] = useState(false);
  const [languagePair, setLanguagePair] = useState<LanguagePair>({
    from: 'English',
    to: 'Chinese'
  });
  const [showScrollButton, setShowScrollButton] = useState(false);
  const isProgrammaticScrollRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const forceAutoscrollRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const isScrollingUpRef = useRef(false);

  const transcriptRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const { getHeaders, getAuthQuery, isAuthenticated, isLoading, token } = useAuthenticatedApi();

  // Extract userId from token and check if it contains "mentra" (case-insensitive)
  const userId = token?.split(':')[0] || '';
  const isMentraUser = userId.toLowerCase().includes('mentra');

  // Popular languages list (in exact order specified)
  const popularLanguages = [
    "English", "Spanish", "French", "German", "Chinese",
    "Japanese", "Korean", "Portuguese", "Russian", "Arabic"
  ];

  // Hardcoded list of languages to EXCLUDE from source dropdown
  const excludedSourceLanguages = [
    "Azerburmeseaijani"
  ];

  // Hardcoded list of languages to EXCLUDE from target dropdown
  const excludedTargetLanguages = [
    "Azerburmeseaijani",
    "Hebrew",
    "Arabic",
    "Vietnamese",
    "Persian",
    "Thai"
  ];

  // Helper function to create grouped and sorted options
  const createGroupedOptions = (languageList: Array<{ value: string; label: string }>) => {
    // const MAX_LABEL_LENGTH = 14;

    // // Helper to truncate labels
    // const truncateLabel = (label: string) => {
    //   return label.length > MAX_LABEL_LENGTH
    //     ? label.slice(0, MAX_LABEL_LENGTH) + '...'
    //     : label;
    // };

    const popularOptions: Array<{ value: string; label: string }> = [];
    const otherOptions: Array<{ value: string; label: string }> = [];

    // Separate popular languages and others
    languageList.forEach(option => {
      if (popularLanguages.includes(option.label)) {
        popularOptions.push({
          ...option,
          label: option.label
        });
      } else {
        otherOptions.push({
          ...option,
          label: option.label
        });
      }
    });

    // Sort popular languages by the order in popularLanguages array
    popularOptions.sort((a, b) => {
      return popularLanguages.indexOf(a.label) - popularLanguages.indexOf(b.label);
    });

    // Sort all languages alphabetically for the "All Languages" section
    const allLanguagesSorted = [...languageList]
      .map(option => ({
        ...option,
        label: option.label
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return [
      {
        label: 'Popular Languages',
        options: popularOptions
      },
      {
        label: 'All Languages',
        options: allLanguagesSorted
      }
    ];
  };

  // Create dropdown options from languages
  const sourceLanguageFlat = Object.entries(languages as any)
    .map(([code, lang]) => {
      const langName = Object.values((lang as any).source_language)[0] as string;
      return {
        value: code,
        label: langName.charAt(0).toUpperCase() + langName.slice(1)
      };
    })
    .filter(lang => isMentraUser || !excludedSourceLanguages.includes(lang.label)); // Only filter if NOT a Mentra user

  const sourceLanguageOptions = createGroupedOptions(sourceLanguageFlat);

  const targetLanguageFlat = targetLangAvailable
    .map(lang => ({
      value: lang.toLowerCase(),
      label: lang.charAt(0).toUpperCase() + lang.slice(1)
    }))
    .filter(lang => isMentraUser || !excludedTargetLanguages.includes(lang.label)); // Only filter if NOT a Mentra user

  const targetLanguageOptions = createGroupedOptions(targetLanguageFlat);

  // Debug logging
  console.log('🎯 Target language state:', {
    languagePairTo: languagePair.to,
    targetLangAvailable,
    targetLanguageOptions: targetLanguageFlat
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

  // Check if splash should be shown based on 10-second timer
  useEffect(() => {
    const SPLASH_INTERVAL = 20 * 60 * 1000; // 20 minutes in milliseconds
    // const SPLASH_INTERVAL = 1000; // 20 minutes in milliseconds


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
      // Get available target languages
      const availableTargets = handleAvailableTargetLang(newSourceLangCode);

      // Check if current target language is still supported
      const currentTarget = languagePair.to;
      const isCurrentTargetStillAvailable = availableTargets.some(
        (lang: string) => lang.toLowerCase() === currentTarget.toLowerCase()
      );

      // Only change target if current one is not supported
      const finalTarget = isCurrentTargetStillAvailable
        ? currentTarget  // Keep current target if still supported
        : (availableTargets.length > 0
            ? availableTargets[0].charAt(0).toUpperCase() + availableTargets[0].slice(1)
            : 'Pick a language');

      const updatedPair = await api.updateLanguageSettings(
        { from: formattedSourceLang, to: finalTarget },
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

  // Check if swap button should be disabled
  const isSwapDisabled = () => {
    // Users with "mentra" in their ID can swap any languages
    if (isMentraUser) return false;

    // For non-Mentra users: disable if either language would be invalid in the swapped position
    const sourceWouldBeInvalid = excludedTargetLanguages.includes(languagePair.from);
    const targetWouldBeInvalid = excludedTargetLanguages.includes(languagePair.to);
    return sourceWouldBeInvalid || targetWouldBeInvalid;
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
      setIsUserIdAppSession(true); // Default to true if API not available
      setIsCheckingUserSession(false);
    }

    // Fetch language settings first
    api.getLanguageSettings(getHeaders())
      .then(data => {
        console.log('📥 API returned language settings:', data);

        // Normalize language names to match Languages.json format
        // Backend might return "Chinese (Hanzi)" or "Chinese (Pinyin)", but we need just "Chinese"
        let normalizedTo = data.to;
        if (normalizedTo.startsWith('Chinese')) {
          normalizedTo = 'Chinese';
        }

        setLanguagePair({
          from: data.from,
          to: normalizedTo
        });
        console.log('✅ Set language pair to:', { from: data.from, to: normalizedTo });
      })
      .catch(error => {
        console.error('Error fetching language settings:', error);
        // Set default language pair if API fails - default to English → Chinese
        setLanguagePair({
          from: 'English',
          to: 'Chinese'
        });
        console.log('⚠️ Using fallback language pair: English → Chinese');
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
      terminal.log('✅ Connected to translation events');
    };

    eventSource.onerror = (error) => {
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
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [isLoading, getHeaders, getAuthQuery, isAuthenticated, token]); // Dependencies for API calls

  // Handle autoscroll - scroll to bottom when new entries arrive or autoscroll is enabled
  useEffect(() => {
    if (autoscrollEnabled && transcriptRef.current) {
      // Don't autoscroll if user is actively scrolling up
      if (isScrollingUpRef.current) {
        return;
      }

      // Check if user is currently scrolled up before autoscrolling
      const { scrollTop, scrollHeight, clientHeight } = transcriptRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      // More lenient threshold when autoscroll is enabled - scroll if within 250px OR force flag is set
      // This ensures we stay at bottom even with small position shifts from content updates
      if (distanceFromBottom <= 250 || forceAutoscrollRef.current) {
        isProgrammaticScrollRef.current = true;
        // Use requestAnimationFrame to ensure DOM has updated before scrolling
        requestAnimationFrame(() => {
          if (transcriptRef.current) {
            transcriptRef.current.scrollTo({
              top: transcriptRef.current.scrollHeight + 100, // Add extra pixels to ensure we reach the very bottom
              behavior: 'smooth'
            });
          }
        });
        // Reset the flag after scroll animation completes (smooth scroll takes ~300-500ms)
        setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 600);
      } else {
        // User is scrolled up significantly (more than 250px), disable autoscroll
        setAutoscrollEnabled(false);
      }
    }
  }, [entries, autoscrollEnabled]);

  // Detect manual scrolling to temporarily disable autoscroll
  const handleScroll = () => {
    if (!transcriptRef.current) return;

    // Ignore scroll events caused by programmatic scrolling OR when force autoscroll is active
    if (isProgrammaticScrollRef.current || forceAutoscrollRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = transcriptRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    // More lenient threshold to account for subpixel rendering and the extra scroll we add
    const isScrolledToBottom = distanceFromBottom < 150;

    // Detect scroll direction
    const currentScrollTop = scrollTop;
    const scrollDirection = currentScrollTop < lastScrollTopRef.current ? 'up' : 'down';
    lastScrollTopRef.current = currentScrollTop;

    // Track if user is scrolling up
    if (scrollDirection === 'up') {
      isScrollingUpRef.current = true;
      // Clear the flag after a short delay when scrolling stops
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingUpRef.current = false;
      }, 150); // Clear after 150ms of no scroll
    } else {
      isScrollingUpRef.current = false;
    }

    // Show scroll button when not at bottom
    setShowScrollButton(!isScrolledToBottom);

    // Only change autoscroll state if user manually scrolled
    // Add a small delay to prevent race conditions with content updates
    if (autoscrollEnabled && !isScrolledToBottom) {
      // Only disable if user intentionally scrolled up (not just a slight shift from content updates)
      // Check if they're significantly far from bottom (more than 200px)
      if (distanceFromBottom > 200) {
        setTimeout(() => {
          if (!isProgrammaticScrollRef.current && !forceAutoscrollRef.current) {
            setAutoscrollEnabled(false);
          }
        }, 100);
      }
    } else if (!autoscrollEnabled && isScrolledToBottom) {
      // User scrolled back to bottom, re-enable autoscroll
      setAutoscrollEnabled(true);
    }
  };

  // Function to scroll to bottom when button is clicked
  const scrollToBottom = () => {
    if (transcriptRef.current) {
      isProgrammaticScrollRef.current = true;
      forceAutoscrollRef.current = true; // Force autoscroll for a couple seconds
      isScrollingUpRef.current = false; // Clear the scrolling up flag

      transcriptRef.current.scrollTo({
        top: transcriptRef.current.scrollHeight + 100,
        behavior: 'smooth'
      });

      // Re-enable autoscroll when user clicks the scroll-to-bottom button
      setAutoscrollEnabled(true);

      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
        setShowScrollButton(false);
      }, 600);

      // Keep force autoscroll active for 2 seconds to handle incoming entries
      setTimeout(() => {
        forceAutoscrollRef.current = false;
      }, 2000);
    }
  };

  // Function to handle toggle button click
  const handleToggleAutoscroll = () => {
    const newValue = !autoscrollEnabled;
    setAutoscrollEnabled(newValue);

    // If enabling autoscroll, also scroll to bottom and force it for 2 seconds
    if (newValue && transcriptRef.current) {
      isProgrammaticScrollRef.current = true;
      forceAutoscrollRef.current = true;
      isScrollingUpRef.current = false; // Clear the scrolling up flag

      transcriptRef.current.scrollTo({
        top: transcriptRef.current.scrollHeight + 100,
        behavior: 'smooth'
      });

      // Hide the scroll button immediately when enabling autoscroll
      setShowScrollButton(false);

      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 600);

      // Keep force autoscroll active for 2 seconds to handle incoming entries
      setTimeout(() => {
        forceAutoscrollRef.current = false;
      }, 2000);
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

  // Show loading while checking user session
  if (isCheckingUserSession) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking connection...</p>
        </div>
      </div>
    );
  }

  // Show loading while checking user session
  if (isCheckingUserSession) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking connection...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {isAuthenticated && isUserIdAppSession ? (
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
        .bar-1 { animation: wave 1.6s ease-in-out infinite; animation-delay: 0s; }
        .bar-2 { animation: wave 1.6s ease-in-out infinite; animation-delay: 0.2s; }
        .bar-3 { animation: wave 1.6s ease-in-out infinite; animation-delay: 0.4s; }
        .bar-4 { animation: wave 1.6s ease-in-out infinite; animation-delay: 0.6s; }
        .bar-5 { animation: wave 1.6s ease-in-out infinite; animation-delay: 0.8s; }
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
              {/* <span className={`text-xs font-medium ${listening ? 'text-[#00d4ff]' : 'text-blue-400'}`}>
                {listening ? 'Listening' : 'Ready'}
              </span> */}
            </div>

            {/* Right: Auto-scroll Toggle (Compact) + Test Button */}
            <div className="flex items-center gap-3">
              {/* Test Loading Button */}
              {/* <button
                onClick={() => setIsLanguageLoading(!isLanguageLoading)}
                className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
                title="Test loading animation"
              >
                Test
              </button> */}

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#b0b0b0]">Auto-scroll</span>
                <button
                  onClick={handleToggleAutoscroll}
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

                  </div>
                </button>
              </div>

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
            className={`transition-all duration-300 ease-in-out`}
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
                    value={getLanguageCodeFromDisplayName(languagePair.from)}
                    onChange={(e) => {
                      const event = { target: { value: e.target.value } } as React.ChangeEvent<HTMLSelectElement>;
                      handleSourceLanguageChange(event);
                    }}
                    disabled={isLanguageLoading}
                    renderValue={() => {
                      const label = languagePair.from;
                      return label.length > 14 ? label.slice(0, 14) + '...' : label;
                    }}
                    sx={{
                      width: '100%',
                      backgroundColor: 'rgba(30, 41, 59, 0.8)',
                      borderRadius: '0.5rem',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#334155',
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#475569',
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#3b82f6',
                        borderWidth: '2px',
                      },
                      '& .MuiSelect-select': {
                        padding: '10px 14px',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: '#e2e8f0',
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      },
                      '& .MuiSvgIcon-root': {
                        color: '#94a3b8',
                      },
                    }}
                    MenuProps={{
                      disableScrollLock: true,
                      PaperProps: {
                        sx: {
                          backgroundColor: 'rgba(30, 41, 59, 0.95)',
                          backdropFilter: 'blur(12px)',
                          border: '1px solid #334155',
                          maxHeight: '400px',
                          minWidth: '100%',
                          width: 'auto',
                          '& .MuiMenuItem-root': {
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            color: '#e2e8f0',
                            padding: '12px 16px',
                            '&:hover': {
                              backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            },
                            '&.Mui-selected': {
                              backgroundColor: 'rgba(59, 130, 246, 0.3)',
                              '&:hover': {
                                backgroundColor: 'rgba(59, 130, 246, 0.4)',
                              },
                            },
                          },
                          '& .MuiListSubheader-root': {
                            color: '#94a3b8',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            backgroundColor: 'rgba(51, 65, 85, 0.95)',
                            backdropFilter: 'blur(8px)',
                            lineHeight: '2.5',
                            position: 'sticky',
                            top: 0,
                            zIndex: 1,
                          },
                        },
                      },
                      MenuListProps: {
                        disableListWrap: true,
                        autoFocusItem: false,
                        sx: {
                          paddingTop: 0,
                        },
                      },
                    }}
                  >
                    {sourceLanguageOptions.map((group) => [
                      <ListSubheader key={`${group.label}-header`}>{group.label}</ListSubheader>,
                      ...group.options.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))
                    ])}
                  </Select>
                </div>

                <button
                  onClick={swapLanguages}
                  disabled={isLanguageLoading || isSwapDisabled()}
                  className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg hover:shadow-lg transition-all transform active:scale-95 mt-5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 tap-highlight-transparent [-webkit-tap-highlight-color:transparent]"
                  title={isSwapDisabled() ? "Cannot swap: one or more languages not available as target" : "Swap languages"}
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </button>


                <div className="flex-1">
                  <label className="text-xs text-purple-400 font-medium mb-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                    Target
                  </label>
                  <Select
                    value={languagePair.to.toLowerCase()}
                    onChange={(e) => {
                      const event = { target: { value: e.target.value } } as React.ChangeEvent<HTMLSelectElement>;
                      handleTargetLanguageChange(event);
                    }}
                    disabled={isLanguageLoading}
                    renderValue={() => {
                      const label = languagePair.to;
                      return label.length > 14 ? label.slice(0, 14) + '...' : label;
                    }}
                    sx={{
                      width: '100%',
                      backgroundColor: 'rgba(30, 41, 59, 0.8)',
                      borderRadius: '0.5rem',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#334155',
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#475569',
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#a855f7',
                        borderWidth: '2px',
                      },
                      '& .MuiSelect-select': {
                        padding: '10px 14px',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: '#e2e8f0',
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      },
                      '& .MuiSvgIcon-root': {
                        color: '#94a3b8',
                      },
                    }}
                    MenuProps={{
                      disableScrollLock: true,
                      PaperProps: {
                        sx: {
                          backgroundColor: 'rgba(30, 41, 59, 0.95)',
                          backdropFilter: 'blur(12px)',
                          border: '1px solid #334155',
                          maxHeight: '400px',
                          minWidth: '100%',
                          width: 'auto',
                          '& .MuiMenuItem-root': {
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            color: '#e2e8f0',
                            padding: '12px 16px',
                            '&:hover': {
                              backgroundColor: 'rgba(168, 85, 247, 0.1)',
                            },
                            '&.Mui-selected': {
                              backgroundColor: 'rgba(168, 85, 247, 0.3)',
                              '&:hover': {
                                backgroundColor: 'rgba(168, 85, 247, 0.4)',
                              },
                            },
                          },
                          '& .MuiListSubheader-root': {
                            color: '#94a3b8',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            backgroundColor: 'rgba(51, 65, 85, 0.95)',
                            backdropFilter: 'blur(8px)',
                            lineHeight: '2.5',
                            position: 'sticky',
                            top: 0,
                            zIndex: 1,
                          },
                        },
                      },
                      MenuListProps: {
                        disableListWrap: true,
                        autoFocusItem: false,
                        sx: {
                          paddingTop: 0,
                        },
                      },
                    }}
                  >
                    {targetLanguageOptions.map((group) => [
                      <ListSubheader key={`${group.label}-header`}>{group.label}</ListSubheader>,
                      ...group.options.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))
                    ])}
                  </Select>
                </div>
              </div>


            </div>
          </div>
          </div>
        </div>
      </div>

      {/* Translation Display Container */}
      <div className="relative rounded-2xl" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Loading Language Splash Overlay */}
        <AnimatePresence>
          {isLanguageLoading && (
            <motion.div
              className="absolute inset-0 z-[200] flex items-center justify-center bg-[#ffffff07] backdrop-blur-md rounded-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <motion.div
                className="text-center"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                <div className="relative w-20 h-20 mx-auto mb-6">
                  {/* Outer rotating ring */}
                  <motion.div
                    className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-blue-400/60 border-r-purple-400/60"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  />
                  {/* Inner rotating ring */}
                  <motion.div
                    className="absolute inset-3 rounded-full border-[3px] border-transparent border-b-purple-400/50 border-l-blue-400/50"
                    animate={{ rotate: -360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                  {/* Center pulse dot */}
                  <motion.div
                    className="absolute inset-0 m-auto w-2.5 h-2.5 rounded-full bg-gradient-to-r from-blue-400/80 to-purple-400/80"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.9, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
                <p className="text-sm font-medium bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent mt-4 drop-shadow-[0_0_8px_rgba(147,197,253,0.5)]">
                  Loading language...
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Translation Display */}
        <div
          ref={transcriptRef}
          onScroll={handleScroll}
          className="h-full space-y-4 overflow-y-auto pr-2 pb-8"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#475569 transparent'
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

      {/* Scroll to Bottom Button */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onClick={scrollToBottom}
            className="fixed bottom-8 right-8 bg-gradient-to-r from-blue-500 to-[#004782] text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-shadow z-50"
            title="Scroll to bottom"
          >
            <ArrowDown className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
      ) : (
        <TpaConnectionError />
      )}
    </div>
  );
};
