# Smart Glasses Note-Taking App: Webview Technical Design

## Overview

The webview component of the Smart Glasses Note-Taking app provides an interface for managing notes and recordings captured via the glasses. The webview is built with React, TypeScript, and shadcn components, focusing on a clean architecture that efficiently manages real-time updates from the glasses.

## Project Structure

```
src/
├── screens/                   # Main application screens
│   ├── Home/
│   │   ├── components/        # Components specific to this screen
│   │   │   ├── NoteCard.tsx
│   │   │   ├── RecordingCard.tsx
│   │   │   └── FilterTabs.tsx
│   │   ├── Home.tsx           
│   │   └── index.ts           
│   ├── NoteDetail/
│   │   ├── components/
│   │   │   ├── NoteEditor.tsx
│   │   │   ├── SourceRecordingPlayer.tsx
│   │   │   └── TagEditor.tsx
│   │   ├── NoteDetail.tsx
│   │   └── index.ts
│   ├── LiveRecording/
│   │   ├── components/
│   │   │   ├── LiveTranscript.tsx
│   │   │   ├── RecordingControls.tsx
│   │   │   ├── Waveform.tsx
│   │   │   └── CreateNoteButton.tsx
│   │   ├── LiveRecording.tsx
│   │   └── index.ts
│   └── CompletedRecording/
│       ├── components/
│       │   ├── TranscriptWithTimestamps.tsx
│       │   ├── PlaybackControls.tsx
│       │   └── RelatedNotesList.tsx
│       ├── CompletedRecording.tsx
│       └── index.ts
├── components/                # Shared components
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── HudPreview.tsx
│   └── LoadingSpinner.tsx
├── hooks/                     # Custom React hooks
│   ├── useRealTimeEvents.ts
│   └── useAudioPlayer.ts
├── utils/                    
│   ├── formatters.ts
│   └── storage.ts
├── types/                     
│   ├── note.ts
│   ├── recording.ts
│   └── api.ts                 
├── context/                   
│   ├── AppContext.tsx
│   └── index.ts
├── assets/                    
│   ├── icons/
│   └── fonts/
├── App.tsx                    # Main app component with routing
├── Api.ts                     # Centralized API object
├── theme.ts                   # shadcn theme configuration
└── index.tsx                  # Entry point
```

## Key Components

### API Module

A centralized API object for all server communication, including SSE management:

```typescript
// Api.ts
import axios from 'axios';
import { Note, Recording } from './types';

// Axios instance
const instance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// SSE singleton management
let eventSourceInstance: EventSource | null = null;
const eventListeners: Record<string, ((event: MessageEvent) => void)[]> = {};

const api = {
  notes: {
    getAll: async (): Promise<Note[]> => {
      const response = await instance.get('/notes');
      return response.data;
    },
    getById: async (id: string): Promise<Note> => {
      const response = await instance.get(`/notes/${id}`);
      return response.data;
    },
    create: async (content: string): Promise<Note> => {
      const response = await instance.post('/notes', { content });
      return response.data;
    },
    update: async (id: string, content: string): Promise<Note> => {
      const response = await instance.put(`/notes/${id}`, { content });
      return response.data;
    },
    delete: async (id: string): Promise<void> => {
      await instance.delete(`/notes/${id}`);
    }
  },
  
  recordings: {
    getAll: async (): Promise<Recording[]> => {
      const response = await instance.get('/recordings');
      return response.data;
    },
    getById: async (id: string): Promise<Recording> => {
      const response = await instance.get(`/recordings/${id}`);
      return response.data;
    },
    updateStatus: async (id: string, isRecording: boolean, duration: number): Promise<void> => {
      await instance.post(`/recordings/status`, { id, isRecording, duration });
    },
    updateTranscript: async (recordingId: string, text: string): Promise<void> => {
      await instance.post(`/recordings/transcript`, { recordingId, text });
    },
    createNoteFromRecording: async (recordingId: string, content: string): Promise<Note> => {
      const response = await instance.post(`/recordings/${recordingId}/notes`, { content });
      return response.data;
    },
    delete: async (id: string): Promise<void> => {
      await instance.delete(`/recordings/${id}`);
    }
  },
  
  events: {
    connect: () => {
      if (eventSourceInstance && eventSourceInstance.readyState !== EventSource.CLOSED) {
        return eventSourceInstance;
      }
      
      eventSourceInstance = new EventSource(`${process.env.REACT_APP_API_URL || 'http://localhost:3000'}/events`);
      
      // Re-attach any existing listeners
      Object.entries(eventListeners).forEach(([eventName, listeners]) => {
        listeners.forEach(listener => {
          eventSourceInstance?.addEventListener(eventName, listener as EventListener);
        });
      });
      
      return eventSourceInstance;
    },
    
    addEventListener: (eventName: string, callback: (event: MessageEvent) => void) => {
      if (!eventListeners[eventName]) {
        eventListeners[eventName] = [];
      }
      eventListeners[eventName].push(callback);
      
      eventSourceInstance?.addEventListener(eventName, callback as EventListener);
    },
    
    removeEventListener: (eventName: string, callback: (event: MessageEvent) => void) => {
      if (eventListeners[eventName]) {
        eventListeners[eventName] = eventListeners[eventName].filter(cb => cb !== callback);
      }
      
      eventSourceInstance?.removeEventListener(eventName, callback as EventListener);
    },
    
    close: () => {
      if (eventSourceInstance) {
        eventSourceInstance.close();
        eventSourceInstance = null;
      }
      Object.keys(eventListeners).forEach(key => {
        eventListeners[key] = [];
      });
    }
  }
};

export default api;
```

### Real-Time Events Hook

A custom hook for components to easily subscribe to SSE events:

```typescript
// hooks/useRealTimeEvents.ts
import { useEffect, useCallback } from 'react';
import api from '../Api';

export function useRealTimeEvents<T>(
  eventName: string, 
  callback: (data: T) => void
) {
  // Wrap callback in useCallback to avoid unnecessary re-renders
  const stableCallback = useCallback((data: T) => {
    callback(data);
  }, [callback]);

  useEffect(() => {
    // Ensure connection
    api.events.connect();
    
    // Create handler
    const handleEvent = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      stableCallback(data);
    };
    
    // Register
    api.events.addEventListener(eventName, handleEvent);
    
    // Clean up
    return () => {
      api.events.removeEventListener(eventName, handleEvent);
    };
  }, [eventName, stableCallback]);
}
```

### TypeScript Types

```typescript
// types/note.ts
export interface NoteI {
  id: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  sourceRecordingId?: string;
  tags: string[];
}

// types/recording.ts
export interface RecordingI {
  id: string;
  title: string;
  duration: number;
  transcript: string;
  isRecording: boolean;
  createdAt: number;
  updatedAt: number;
  relatedNoteIds: string[];
}

export interface TranscriptUpdateI {
  recordingId: string;
  text: string;
  timestamp: number;
}
```

## Screen Implementations

### Home Screen

The main dashboard showing notes and recordings:

```typescript
// screens/Home/Home.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NoteI, RecordingI } from '../../types';
import api from '../../Api';
import { useRealTimeEvents } from '../../hooks/useRealTimeEvents';
import NoteCard from './components/NoteCard';
import RecordingCard from './components/RecordingCard';
import FilterTabs from './components/FilterTabs';

const Home: React.FC = () => {
  const [notes, setNotes] = useState<NoteI[]>([]);
  const [recordings, setRecordings] = useState<RecordingI[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'notes' | 'recordings'>('all');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [notesData, recordingsData] = await Promise.all([
          api.notes.getAll(),
          api.recordings.getAll()
        ]);
        
        setNotes(notesData);
        setRecordings(recordingsData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Real-time updates for new notes
  useRealTimeEvents<NoteI>('note', (newNote) => {
    setNotes(prev => {
      // Don't add duplicates
      if (prev.some(note => note.id === newNote.id)) {
        return prev.map(note => note.id === newNote.id ? newNote : note);
      }
      return [...prev, newNote];
    });
  });
  
  // Real-time updates for recording status
  useRealTimeEvents<RecordingI>('recording-status', (updatedRecording) => {
    setRecordings(prev => {
      if (prev.some(rec => rec.id === updatedRecording.id)) {
        return prev.map(rec => rec.id === updatedRecording.id ? updatedRecording : rec);
      }
      return [...prev, updatedRecording];
    });
  });
  
  // Handle card clicks
  const handleNoteClick = (noteId: string) => {
    navigate(`/notes/${noteId}`);
  };
  
  const handleRecordingClick = (recordingId: string, isActive: boolean) => {
    navigate(`/recordings/${recordingId}${isActive ? '/live' : ''}`);
  };
  
  return (
    <div className="home-container">
      <h1>GlassNotes</h1>
      
      <FilterTabs activeTab={activeTab} onChange={setActiveTab} />
      
      <div className="content-list">
        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            {activeTab === 'all' || activeTab === 'notes' ? (
              notes.map(note => (
                <NoteCard 
                  key={note.id} 
                  note={note} 
                  onClick={() => handleNoteClick(note.id)} 
                />
              ))
            ) : null}
            
            {activeTab === 'all' || activeTab === 'recordings' ? (
              recordings.map(recording => (
                <RecordingCard 
                  key={recording.id} 
                  recording={recording} 
                  onClick={() => handleRecordingClick(recording.id, recording.isRecording)} 
                />
              ))
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};

export default Home;
```

### Live Recording Screen

Real-time view of an active recording with transcription:

```typescript
// screens/LiveRecording/LiveRecording.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RecordingI, TranscriptUpdateI } from '../../types';
import api from '../../Api';
import { useRealTimeEvents } from '../../hooks/useRealTimeEvents';
import Waveform from './components/Waveform';
import LiveTranscript from './components/LiveTranscript';
import RecordingControls from './components/RecordingControls';
import CreateNoteButton from './components/CreateNoteButton';
import HudPreview from '../../components/HudPreview';

const LiveRecording: React.FC = () => {
  const { id } = useParams<{id: string}>();
  const [recording, setRecording] = useState<RecordingI | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  // Fetch recording
  useEffect(() => {
    const fetchRecording = async () => {
      if (!id) return;
      
      try {
        const data = await api.recordings.getById(id);
        setRecording(data);
      } catch (error) {
        console.error('Error fetching recording:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRecording();
  }, [id]);
  
  // Subscribe to transcript updates
  useRealTimeEvents<TranscriptUpdateI>('transcript', (update) => {
    if (recording && update.recordingId === recording.id) {
      setRecording(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          transcript: update.text
        };
      });
    }
  });
  
  // Handle recording controls
  const handleStop = async () => {
    if (!recording || !id) return;
    
    try {
      await api.recordings.updateStatus(id, false, recording.duration);
      navigate(`/recordings/${id}`);
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  };
  
  const handleCreateNote = async () => {
    if (!recording || !id) return;
    
    try {
      // Extract the last few sentences for the note content
      const content = extractRecentContent(recording.transcript);
      const newNote = await api.recordings.createNoteFromRecording(id, content);
      navigate(`/notes/${newNote.id}`);
    } catch (error) {
      console.error('Error creating note:', error);
    }
  };
  
  // Utility to extract recent content
  const extractRecentContent = (transcript: string): string => {
    // Logic to extract last few sentences or paragraphs
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return sentences.slice(-3).join('. ') + '.';
  };
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!recording) {
    return <div>Recording not found</div>;
  }
  
  return (
    <div className="recording-container">
      <h1>{recording.title || 'Untitled Recording'}</h1>
      <div className="recording-duration">{formatDuration(recording.duration)}</div>
      
      <Waveform isActive={true} />
      
      <LiveTranscript text={recording.transcript} />
      
      <CreateNoteButton onClick={handleCreateNote} />
      
      <RecordingControls 
        onPause={() => {/* Not implemented for MVP */}}
        onStop={handleStop}
        onBookmark={() => {/* Not implemented for MVP */}}
      />
      
      <HudPreview text={`● REC [${formatDuration(recording.duration)}]`} />
    </div>
  );
};

export default LiveRecording;
```

### Note Detail Screen

Allows viewing and editing notes with source recording access:

```typescript
// screens/NoteDetail/NoteDetail.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { NoteI, RecordingI } from '../../types';
import api from '../../Api';
import NoteEditor from './components/NoteEditor';
import SourceRecordingPlayer from './components/SourceRecordingPlayer';
import TagEditor from './components/TagEditor';

const NoteDetail: React.FC = () => {
  const { id } = useParams<{id: string}>();
  const [note, setNote] = useState<NoteI | null>(null);
  const [sourceRecording, setSourceRecording] = useState<RecordingI | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  // Fetch note and its source recording if available
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      
      try {
        const noteData = await api.notes.getById(id);
        setNote(noteData);
        
        if (noteData.sourceRecordingId) {
          const recordingData = await api.recordings.getById(noteData.sourceRecordingId);
          setSourceRecording(recordingData);
        }
      } catch (error) {
        console.error('Error fetching note:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id]);
  
  // Save note changes
  const handleSave = async (content: string) => {
    if (!note || !id) return;
    
    try {
      const updatedNote = await api.notes.update(id, content);
      setNote(updatedNote);
    } catch (error) {
      console.error('Error saving note:', error);
    }
  };
  
  // Update tags
  const handleTagsUpdate = async (tags: string[]) => {
    if (!note || !id) return;
    
    try {
      // This would need an API endpoint to update tags
      // For MVP, we might include tags in the content update
      console.log('Tags updated:', tags);
    } catch (error) {
      console.error('Error updating tags:', error);
    }
  };
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!note) {
    return <div>Note not found</div>;
  }
  
  return (
    <div className="note-detail-container">
      <div className="note-header">
        <button onClick={() => navigate(-1)}>Back</button>
        <h1>Note</h1>
        <button onClick={() => handleSave(note.content)}>Save</button>
      </div>
      
      <NoteEditor 
        initialContent={note.content}
        onChange={(content) => setNote({...note, content})}
      />
      
      {sourceRecording && (
        <SourceRecordingPlayer 
          recording={sourceRecording}
          onViewOriginal={() => navigate(`/recordings/${sourceRecording.id}`)}
        />
      )}
      
      <TagEditor 
        tags={note.tags}
        onChange={handleTagsUpdate}
      />
      
      <div className="note-actions">
        <button>Share</button>
        {sourceRecording && (
          <button onClick={() => navigate(`/recordings/${sourceRecording.id}`)}>
            Original Transcript
          </button>
        )}
        <button onClick={async () => {
          if (window.confirm('Delete this note?')) {
            await api.notes.delete(id!);
            navigate('/');
          }
        }}>Delete</button>
      </div>
    </div>
  );
};

export default NoteDetail;
```

### App Component with Routing

```typescript
// App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './screens/Home';
import NoteDetail from './screens/NoteDetail';
import LiveRecording from './screens/LiveRecording';
import CompletedRecording from './screens/CompletedRecording';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/notes/:id" element={<NoteDetail />} />
        <Route path="/recordings/:id/live" element={<LiveRecording />} />
        <Route path="/recordings/:id" element={<CompletedRecording />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
```

## Communication Flow

The webview application communicates with the server using two primary methods:

1. **REST API** for standard CRUD operations on notes and recordings.
2. **Server-Sent Events (SSE)** for real-time updates from the glasses.

### REST Communication

- Uses axios for HTTP requests
- Centralized in the Api.ts file
- Each endpoint corresponds to a specific operation

### Real-Time Communication (SSE)

1. Smart glasses send updates to the server via HTTP POST
2. Server broadcasts these updates to all connected clients via SSE
3. Webview receives updates and updates UI accordingly

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│                 │      │                 │      │                 │
│  Smart Glasses  │──────▶     Server     │──────▶    Webview      │
│    (Client)     │      │                 │      │    (Client)     │
│                 │      │                 │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
       HTTP POST              SSE Stream              HTTP POST
```

## Implementation Notes

### SSE Connection Management

- Single connection maintained via singleton pattern
- Connection automatically reestablishes if dropped
- Event listeners are preserved across reconnections

### State Management

The application uses component-local state with React's useState for most screens, with real-time updates managed through the custom useRealTimeEvents hook. This keeps the architecture simple for the MVP while still providing the necessary reactivity.

### Smart Glasses Integration

The webview doesn't directly communicate with the glasses. Instead:

1. Glasses send updates to the server
2. Server broadcasts to all connected clients
3. Webview displays these updates in real-time

This architecture allows for multiple clients to connect to the same glasses session, which could be useful for future expansion.

## Next Steps After MVP

1. Add offline support with local storage
2. Implement more robust error handling
3. Add authentication and user accounts
4. Improve audio playback capabilities
5. Add search functionality