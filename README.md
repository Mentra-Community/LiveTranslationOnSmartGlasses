# Live Translation App for AugmentOS

A real-time bidirectional translation application for AugmentOS smart glasses, enabling seamless conversations between people speaking different languages.

## Overview

The Live Translation App provides:
- **Real-time translation** between any two languages supported by AugmentOS
- **Bidirectional conversation tracking** - captures both sides of the conversation
- **Smart glasses display** - shows only the translations the wearer needs
- **Companion webview** - displays the complete conversation for both participants
- **Confidence-based rendering** - shows partial translations as they're being spoken
- **Automatic session management** - clears old conversations after 40 seconds of inactivity

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         AugmentOS Cloud                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Translation Service (Transcription + Translation)        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  │ WebSocket
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Live Translation App (Backend)                │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────┐   │
│  │  AppSession      │  │ ConversationMgr  │  │ SSE/REST API │   │
│  │  (SDK Handler)   │  │ (Memory Store)   │  │  (Webview)   │   │
│  └─────────────────┘  └──────────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────┘
           │                                            │
           │ Display Commands                           │ SSE/HTTP
           ▼                                            ▼
┌──────────────────────┐                    ┌───────────────────────┐
│   Smart Glasses      │                    │   Webview (Phone)     │
│  ┌────────────────┐  │                    │  ┌────────────────┐   │
│  │ Source → Target│  │                    │  │ Bidirectional  │   │
│  │  Translation   │  │                    │  │  Conversation  │   │
│  │     Only       │  │                    │  │    History     │   │
│  └────────────────┘  │                    │  └────────────────┘   │
└──────────────────────┘                    └───────────────────────┘
```

### Core Components

#### 1. **Backend Server (`src/index.ts`)**
The main application server built on the AugmentOS SDK:
- **LiveTranslationApp**: Extends `AppServer` from the SDK
- Manages user sessions and WebSocket connections to AugmentOS Cloud
- Handles translation data processing and routing
- Implements CORS for cross-origin webview access

#### 2. **Conversation Manager (`src/services/ConversationManager.ts`)**
In-memory storage for conversation history:
- Stores up to 500 translation entries per user
- Tracks both interim (partial) and final translations
- Manages language pair configuration
- No persistence - data lives only for the session duration

#### 3. **Translation Processing Pipeline**
- **Input**: Receives `TranslationData` from AugmentOS Cloud via WebSocket
- **Processing**: 
  - Confidence calculations for partial translations
  - Text wrapping and formatting based on display constraints
  - Language detection for bidirectional support
  - Chinese Pinyin conversion when needed
- **Output**: 
  - Formatted text to glasses display
  - Translation entries to webview via SSE

#### 4. **API Layer (`src/api/`)**
RESTful and Server-Sent Events (SSE) endpoints:
- `/translation-events` - SSE endpoint for real-time updates
- `/api/language-settings` - Current language pair configuration
- `/health` - Health check endpoint

#### 5. **Webview (`webview/`)**
React-based web interface:
- Displays complete bidirectional conversation
- Auto-scrolling transcript view
- Real-time updates via SSE
- Mobile-optimized responsive design

### Data Flow

1. **Audio Input** → AugmentOS Cloud processes speech
2. **Translation Data** → Sent to app via WebSocket
3. **App Processing**:
   - Determines translation direction (source→target or target→source)
   - Formats text for glasses display (if applicable)
   - Creates conversation entry with original and translated text
4. **Distribution**:
   - **Glasses**: Shows only source→target translations
   - **Webview**: Shows all translations bidirectionally
5. **Real-time Updates** → SSE pushes to all connected clients

### Key Design Decisions

#### Bidirectional Translation Support
The app receives translations in both directions but intelligently filters what to display:
- **Glasses Display**: Only shows translations FROM the configured source language
- **Webview**: Shows ALL translations for complete conversation context

#### Session Management
- Each user (identified by email) has their own conversation session
- Sessions are automatically created when glasses connect
- Conversation history clears after 40 seconds of inactivity
- No data persistence - privacy by design

#### Development Mode
In development, the webview automatically connects to the first active glasses user, eliminating the need for authentication during testing.

## Configuration

### Environment Variables

#### Backend
```bash
PORT=8070                          # Server port
PACKAGE_NAME=com.mentra.translation   # App identifier
AUGMENTOS_API_KEY=your_api_key    # AugmentOS API key
```

#### Webview
```bash
VITE_API_URL=https://your-backend-url  # Backend API URL
```

### Settings (via AugmentOS Dashboard)

- **Source Language**: The language the wearer speaks
- **Target Language**: The language to translate to
- **Display Mode**: 
  - `translations` - Show only translated text
  - `everything` - Show all text (debug mode)
- **Line Width**: Text wrapping width (Small/Medium/Large)
- **Number of Lines**: Max lines to display (1-5)
- **Confidence Heuristic**: Algorithm for partial translation display

## Development

### Prerequisites
- Node.js 20+ or Bun
- Docker (optional but recommended)
- ngrok (for HTTPS tunneling in development)

### Quick Start

#### Using Docker (Recommended)
```bash
# Start development environment
bun run docker:dev

# View logs
bun run logs

# Stop container
bun run docker:stop
```

#### Local Development
```bash
# Install dependencies
bun install
cd webview && bun install

# Start backend (in root directory)
bun run dev

# Start webview (in webview directory)
bun run dev

# Setup ngrok tunnels (for HTTPS)
ngrok http 8070  # Backend
ngrok http 5173  # Webview
```

### Project Structure
```
translation/
├── src/
│   ├── index.ts              # Main app server
│   ├── api/                  # API endpoints
│   │   ├── translations.route.ts
│   │   ├── health.route.ts
│   │   └── index.ts
│   ├── services/
│   │   └── ConversationManager.ts
│   └── utils/                # Text processing utilities
├── webview/                  # React frontend
│   ├── src/
│   │   ├── screens/          # UI screens
│   │   ├── hooks/            # React hooks
│   │   ├── types.ts          # TypeScript types
│   │   └── App.tsx
│   └── .env                  # Environment config
└── CLAUDE.md                 # AI assistant instructions
```

### Common Tasks

#### Add New Language Support
1. Language mappings are in `src/utils/languageLocale.ts`
2. Add new language to locale mapping
3. Test with AugmentOS language settings

#### Modify Text Display
1. Line width settings in `src/utils/text-wrapping/convertLineWidth.ts`
2. Text wrapping logic in `src/utils/text-wrapping/wrapText.ts`
3. Confidence algorithms in `src/utils/confidenceHeuristics.ts`

#### Debug Translation Issues
1. Enable verbose logging in `handleTranslation` method
2. Check `displayMode` setting - use "everything" to see all text
3. Monitor WebSocket connection status in logs

## Deployment

### Production Considerations

1. **Authentication**: In production, use proper AugmentOS authentication
2. **HTTPS**: Required for webview SSE connections
3. **CORS**: Configure allowed origins for your domain
4. **Scaling**: Each user session maintains WebSocket + SSE connections
5. **Privacy**: No data persistence - all conversations are ephemeral

### Docker Deployment
```bash
# Build production image
docker build -t augmentos/live-translation:latest -f docker/Dockerfile .

# Run with environment variables
docker run -p 80:80 \
  -e AUGMENTOS_API_KEY=your_key \
  -e PACKAGE_NAME=com.mentra.translation \
  augmentos/live-translation:latest
```

## Troubleshooting

### Common Issues

1. **"No conversation manager found"**
   - Ensure glasses are connected and session is active
   - Check that languages are configured in AugmentOS dashboard

2. **Translations not appearing in webview**
   - Verify CORS is enabled on backend
   - Check browser console for SSE connection errors
   - Ensure backend and webview URLs are correctly configured

3. **Mixed content errors**
   - Both backend and webview must use HTTPS in production
   - Use ngrok for HTTPS tunnels in development

4. **Duplicate translations showing**
   - This is normal for bidirectional mode
   - Original text + translation are shown for context

## License

See the [LICENSE](LICENSE) file for details.