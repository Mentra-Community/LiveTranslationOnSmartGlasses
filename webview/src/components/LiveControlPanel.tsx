import { useEffect, useState, useRef } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { useWebSocketContext } from "../context/WebSocketContext";

interface RecordingSession {
  sessionId: string;
  status: string;
  duration: string;
  recentTranscript?: string;
}

interface Recording {
  id: string;
  title: string;
  timestamp: string;
  duration: string;
  format: string;
}

export function LiveControlPanel() {
  const { isConnected, sendMessage, addMessageHandler } = useWebSocketContext();

  const [sessions, setSessions] = useState<RecordingSession[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [sessions]);

  // Handle WebSocket messages
  useEffect(() => {
    // Handle state updates
    const removeStateHandler = addMessageHandler('state_update', (data) => {
      setSessions(data.sessions || []);
      setRecordings(data.recordings || []);
      console.log("state_update", data);
      console.log("recordings", data.recordings);

      // Update recording status
      if (data.sessions && data.sessions.length > 0) {
        const isAnyRecording = data.sessions.some(
          (session: RecordingSession) => session.status === 'RECORDING'
        );
        setIsRecording(isAnyRecording);
      }
    });

    // Handle recording started event
    const removeStartHandler = addMessageHandler('recording_started', () => {
      setIsRecording(true);
    });

    // Handle recording stopped event
    const removeStopHandler = addMessageHandler('recording_stopped', () => {
      setIsRecording(false);
    });

    // Handle errors
    const removeErrorHandler = addMessageHandler('error', (data) => {
      console.error('WebSocket error:', data.error);
    });

    // Request initial state on connection
    if (isConnected) {
      sendMessage({ type: 'get_state' });
    }

    // Cleanup
    return () => {
      removeStateHandler();
      removeStartHandler();
      removeStopHandler();
      removeErrorHandler();
    };
  }, [isConnected, addMessageHandler, sendMessage]);

  // Start recording
  const handleStartRecording = () => {
    sendMessage({ type: 'start_recording' });
  };

  // Stop recording
  const handleStopRecording = () => {
    sendMessage({ type: 'stop_recording' });
  };

  return (
    <Card className="w-full">
      <CardHeader className="border-b border-secondary/30">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Live Control</CardTitle>
            <CardDescription>Control and monitor your recordings</CardDescription>
          </div>
          <Badge variant={isConnected ? "default" : "destructive"}>
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Active Sessions */}
          {sessions.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium mb-2">Active Session</h3>
              <div className="bg-secondary/20 rounded-md p-4 border border-secondary/30">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <span className="text-sm font-medium">Status: </span>
                    <Badge variant={isRecording ? "default" : "secondary"}>
                      {isRecording ? "Recording" : "Ready"}
                    </Badge>
                  </div>
                  <div className="text-sm font-mono">
                    {sessions[0].duration || "00:00:00"}
                  </div>
                </div>

                {/* Transcript */}
                <div className="mt-4">
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Live Transcript</h4>
                  <div className="bg-background rounded-md p-3 h-40 overflow-y-auto text-sm border border-secondary/20">
                    {sessions[0].recentTranscript ? (
                      <p>{sessions[0].recentTranscript}</p>
                    ) : (
                      <p className="text-muted-foreground italic">No transcript available</p>
                    )}
                    <div ref={transcriptEndRef} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-secondary/20 border border-secondary/30 rounded-md p-4 text-sm text-center text-muted-foreground">
              {isConnected ?
                "No active sessions found. Please start a session on your glasses." :
                "Connecting to your glasses..."}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="justify-between flex border-t border-secondary/30 pt-6">
        <Button
          variant={isRecording ? "destructive" : "default"}
          onClick={isRecording ? handleStopRecording : handleStartRecording}
          disabled={!isConnected || sessions.length === 0}
          className="px-6"
        >
          {isRecording ? "Stop Recording" : "Start Recording"}
        </Button>
        <Button
          variant="outline"
          onClick={() => sendMessage({ type: 'get_state' })}
          disabled={!isConnected}
          className="border-secondary/40"
        >
          Refresh
        </Button>
      </CardFooter>
    </Card>
  );
}