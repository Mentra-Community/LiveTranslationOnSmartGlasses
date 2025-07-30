/**
 * Hook for audio playback
 */

import { useState, useRef, useEffect } from 'react';

interface UseAudioPlayerOptions {
  onEnded?: () => void;
  onError?: (error: Error) => void;
}

export function useAudioPlayer(options?: UseAudioPlayerOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  
  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);
  
  // Load audio from a URL
  const loadAudio = async (url: string): Promise<void> => {
    try {
      setIsLoading(true);
      
      // Stop any playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
      
      // Create new audio element
      const audio = new Audio(url);
      audioRef.current = audio;
      
      // Set up event listeners
      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
        setIsLoading(false);
      };
      
      audio.onerror = () => {
        setIsLoading(false);
        const error = new Error('Error loading audio');
        
        if (options?.onError) {
          options.onError(error);
        } else {
          console.error(error);
        }
      };
      
      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        if (options?.onEnded) {
          options.onEnded();
        }
      };
      
      // Start loading
      await new Promise<void>((resolve) => {
        audio.oncanplaythrough = () => resolve();
        
        // Some browsers may not fire oncanplaythrough
        setTimeout(resolve, 2000);
      });
    } catch (error) {
      setIsLoading(false);
      
      if (options?.onError) {
        options.onError(error instanceof Error ? error : new Error('Unknown error'));
      } else {
        console.error('Error loading audio:', error);
      }
    }
  };
  
  // Play the loaded audio
  const play = async (): Promise<void> => {
    if (!audioRef.current) {
      return;
    }
    
    try {
      // Start playback
      await audioRef.current.play();
      setIsPlaying(true);
      
      // Start progress tracking
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
      
      intervalRef.current = window.setInterval(() => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime);
        }
      }, 100);
    } catch (error) {
      setIsPlaying(false);
      
      if (options?.onError) {
        options.onError(error instanceof Error ? error : new Error('Playback failed'));
      } else {
        console.error('Error playing audio:', error);
      }
    }
  };
  
  // Pause playback
  const pause = (): void => {
    if (!audioRef.current) {
      return;
    }
    
    audioRef.current.pause();
    setIsPlaying(false);
    
    // Stop progress tracking
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };
  
  // Seek to a specific time
  const seek = (time: number): void => {
    if (!audioRef.current) {
      return;
    }
    
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };
  
  // Toggle play/pause
  const toggle = async (): Promise<void> => {
    if (isPlaying) {
      pause();
    } else {
      await play();
    }
  };
  
  return {
    isPlaying,
    isLoading,
    duration,
    currentTime,
    loadAudio,
    play,
    pause,
    seek,
    toggle
  };
}