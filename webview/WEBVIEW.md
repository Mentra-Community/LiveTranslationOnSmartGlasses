# Audio Recorder Webview

## Overview

The Audio Recorder webview provides a browser-based interface for users to authenticate, control recordings, and manage their recorded audio files from AugmentOS smart glasses.

## Architecture

- **Frontend Framework**: React with TypeScript
- **UI Design**: Tailwind CSS with shadcn/ui components
- **State Management**: React hooks and context
- **Communication**: REST API and WebSocket

## Features

### Completed

- ✅ Authentication system with email verification code
- ✅ Live recording control (start/stop)
- ✅ Real-time transcript display
- ✅ WebSocket integration for live updates
- ✅ Connection status indicators
- ✅ Simple responsive UI

### Work in Progress

- 🔄 Recordings list display
- 🔄 Audio playback functionality
- 🔄 Basic recording management (delete/rename)
- 🔄 Full transcript viewing for past recordings

### Planned

- 📝 Improved mobile optimization
- 📝 Basic sharing functionality
- 📝 Simple recording filtering
- 📝 Error handling and recovery improvements

## Technical Details

### Component Structure

- `App.tsx` - Main application with authentication state
- `AuthForm.tsx` - Email verification code flow
- `LiveControlPanel.tsx` - Real-time recording control interface
- `[WIP] RecordingsList.tsx` - Display of user's recordings
- `[WIP] RecordingPlayer.tsx` - Audio playback and transcript view

### Custom Hooks

- `useAuth.ts` - Authentication state and functions
- `useWebSocket.ts` - WebSocket connection management
- `[WIP] useRecordings.ts` - Recordings data fetching and management

### Authentication Flow

1. User enters email address to request verification code
2. Code is sent to email (or displayed on glasses if connected)
3. User enters code to authenticate
4. JWT token is stored for API access

### WebSocket Integration

- Real-time updates during recording sessions
- Live transcript display
- Connection status monitoring
- Automatic reconnection handling

### User Interface

- **Target Devices**: Mobile browsers first, desktop supported
- **Design System**: Minimalist UI with focused functionality
- **Layout**: Single-page application with conditional rendering

## Implementation Notes

- Primary focus is on mobile usability
- Authentication token stored in localStorage
- WebSocket handles real-time communication
- REST API used for non-real-time operations
- Used shadcn/ui components for consistent design
- App uses responsive design principles for various screen sizes