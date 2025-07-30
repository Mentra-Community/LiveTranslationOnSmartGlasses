import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Play, Pause, Download, Trash2 } from "lucide-react";
import axios from "axios";
import { useWebSocketContext } from "../context/WebSocketContext";

// Get API base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8069';

interface Recording {
  id: string;
  title: string;
  timestamp: string;
  duration: string;
  format: string;
  size?: number;
}

interface RecordingListProps {
  userId: string;
}

export function RecordingList({ userId }: RecordingListProps) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const { isConnected, sendMessage, addMessageHandler } = useWebSocketContext();

  // Handle WebSocket messages for recordings
  useEffect(() => {
    // Listen for state updates
    const removeStateHandler = addMessageHandler('state_update', (data) => {
      console.log('RecordingList: Received state update', data);
      if (data.recordings) {
        setRecordings(data.recordings);
      }
    });

    // Request initial state when connected
    if (isConnected) {
      console.log('RecordingList: Requesting initial state');
      sendMessage({ type: 'get_state' });
    }

    return () => {
      removeStateHandler();
    };
  }, [isConnected, addMessageHandler, sendMessage]);

  const formatTimestamp = (timestamp: string) => {
    try {
      // Try to parse as ISO date string first
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        // Simple formatting to show date and time
        return date.toLocaleString();
      }
      
      // If not a valid date, just return the original
      return timestamp;
    } catch (error) {
      return timestamp;
    }
  };

  const handlePlay = async (recording: Recording) => {
    try {
      if (playingId === recording.id && audioRef.current) {
        // Toggle play/pause if it's the currently playing recording
        if (audioRef.current.paused) {
          await audioRef.current.play();
        } else {
          audioRef.current.pause();
        }
        return;
      }

      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }

      // Set as playing and create new audio element
      setPlayingId(recording.id);
      setIsAudioLoading(true);

      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error("Authentication required");
      }

      // Get a signed URL for the recording
      const downloadUrl = `${API_BASE_URL}/api/${userId}/recordings/${recording.id}/download`;
      
      // Create new audio element
      const audio = new Audio();
      audioRef.current = audio;
      
      // Configure proper authorization
      const response = await axios.get(downloadUrl, {
        responseType: 'blob',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const blob = response.data;
      const url = URL.createObjectURL(blob);
      audio.src = url;
      
      // Set up event listeners
      audio.onended = () => {
        setPlayingId(null);
      };
      
      audio.oncanplay = () => {
        setIsAudioLoading(false);
        audio.play().catch(error => {
          console.error("Error playing audio:", error);
          setPlayingId(null);
          alert("Failed to play recording");
        });
      };
      
      audio.onerror = () => {
        console.error("Audio error occurred");
        setPlayingId(null);
        setIsAudioLoading(false);
        alert("Error loading audio");
      };
    } catch (error) {
      console.error("Error playing recording:", error);
      setPlayingId(null);
      setIsAudioLoading(false);
      alert("Failed to load recording");
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setPlayingId(null);
    }
  };

  const handleDownload = async (recording: Recording) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error("Authentication required");
      }

      const downloadUrl = `${API_BASE_URL}/api/${userId}/recordings/${recording.id}/download`;
      
      // Trigger download
      const response = await axios.get(downloadUrl, {
        responseType: 'blob',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', recording.title);
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      alert("Download started");
    } catch (error) {
      console.error("Error downloading recording:", error);
      alert("Failed to download recording");
    }
  };

  const handleDelete = async (recording: Recording) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error("Authentication required");
      }

      // Stop if this recording is playing
      if (playingId === recording.id && audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        setPlayingId(null);
      }

      const deleteUrl = `${API_BASE_URL}/api/${userId}/recordings/${recording.id}`;
      
      await axios.delete(deleteUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Update local state
      setRecordings(prev => prev.filter(r => r.id !== recording.id));
      
      alert("Recording deleted");
    } catch (error) {
      console.error("Error deleting recording:", error);
      alert("Failed to delete recording");
    }
  };

  // Function to refresh recordings
  const handleRefresh = () => {
    if (isConnected) {
      sendMessage({ type: 'get_state' });
    }
  };

  if (recordings.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Recordings</CardTitle>
          <CardDescription>Your saved recordings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-secondary/20 border border-secondary/30 rounded-md p-6 text-center text-muted-foreground">
            No recordings available. Start a recording session to create one.
          </div>
        </CardContent>
        <CardFooter className="justify-center">
          <Button variant="outline" onClick={handleRefresh}>
            Refresh
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Recordings</CardTitle>
        <CardDescription>Your saved recordings</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recordings.map((recording) => (
            <div
              key={recording.id}
              className="bg-secondary/10 border border-secondary/20 rounded-lg p-4"
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium">{recording.title}</h3>
                <span className="text-xs text-muted-foreground">
                  {formatTimestamp(recording.timestamp)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => playingId === recording.id ? handlePause() : handlePlay(recording)}
                    disabled={isAudioLoading && playingId === recording.id}
                    className="w-8 h-8 p-0"
                  >
                    {playingId === recording.id ? (
                      isAudioLoading ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Pause className="h-4 w-4" />
                      )
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <span className="text-sm">{recording.duration}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(recording)}
                    className="w-8 h-8 p-0"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(recording)}
                    className="w-8 h-8 p-0 text-destructive hover:text-destructive/90"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="justify-between">
        <div className="text-sm text-muted-foreground">
          {recordings.length} recording{recordings.length !== 1 ? "s" : ""}
        </div>
        <Button variant="outline" onClick={handleRefresh}>
          Refresh
        </Button>
      </CardFooter>
    </Card>
  );
}