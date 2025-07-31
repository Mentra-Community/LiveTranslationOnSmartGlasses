import express, { Request, Response } from 'express';
import { LiveTranslationApp } from '../index';
import crypto from 'crypto';

export const router = express.Router();

let app: LiveTranslationApp;

export function setupTranslationsAPI(translationApp: LiveTranslationApp): express.Router {
  app = translationApp;
  return router;
}

// Extended Request type with authUserId from MentraOS SDK
interface AuthRequest extends Request {
  authUserId?: string;
}

/**
 * Verify frontend token (similar to SDK's internal verifyFrontendToken)
 * Frontend tokens are in the format: userId:hash
 */
function verifyFrontendToken(frontendToken: string, apiKey: string): string | null {
  try {
    const tokenParts = frontendToken.split(':');
    if (tokenParts.length === 2) {
      const [tokenUserId, tokenHash] = tokenParts;
      
      // Hash the API key first (matching SDK implementation)
      const hashedApiKey = crypto.createHash('sha256').update(apiKey).digest('hex');
      
      // Create the expected hash using userId + hashedApiKey
      const expectedHash = crypto.createHash('sha256')
        .update(tokenUserId)
        .update(hashedApiKey)
        .digest('hex');
      
      if (tokenHash === expectedHash) {
        console.log('[SSE] Frontend token validated for user:', tokenUserId);
        return tokenUserId;
      }
    }
  } catch (error) {
    console.error('[SSE] Error verifying frontend token:', error);
  }
  return null;
}

// SSE endpoint for real-time translation events
async function translationEvents(req: AuthRequest, res: Response) {
  console.log(`[SSE] New connection attempt from ${req.headers.origin || 'unknown origin'}`);
  
  // For SSE, check token from query parameter since EventSource doesn't support headers
  let userId = req.authUserId;
  
  // If no userId from standard auth, check query parameter
  if (!userId && req.query.token) {
    const token = req.query.token as string;
    const apiKey = process.env.AUGMENTOS_API_KEY || process.env.MENTRAOS_API_KEY;
    
    if (apiKey) {
      // Verify the frontend token and extract userId
      userId = verifyFrontendToken(token, apiKey) || undefined;

      if (userId) {
        console.log('[SSE] Frontend token validated, using userId:', userId);
      } else {
        console.log('[SSE] Invalid frontend token provided');
        // In development, fall back to dev-user
        if (process.env.NODE_ENV !== 'production') {
          userId = 'dev-user';
          console.log('[SSE] Using dev-user fallback (dev mode)');
        }
      }
    } else {
      console.error('[SSE] No API key found to verify token');
    }
  }
  
  // For development without auth, use the first active user from glasses
  if (!userId) {
    // In development, connect to the first active glasses user
    const activeUsers = Array.from(app.getActiveUsers());
    if (activeUsers.length > 0) {
      userId = activeUsers[0];
      console.log(`[SSE] Using active glasses user: ${userId} (dev mode)`);
    } else {
      userId = 'dev-user';
      console.log('[SSE] No active glasses users, using default dev-user');
    }
  }
  
  // In production, enforce authentication
  if (process.env.NODE_ENV === 'production' && !req.authUserId && !req.query.token) {
    console.warn('[SSE] Rejecting connection - no authentication in production');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  console.log(`[SSE] Establishing connection for user: ${userId}`);

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Track this SSE client for the user
  app.addSSEClient(userId, res);

  // Send connection confirmation
  res.write('event: connected\ndata: {"status": "connected"}\n\n');
  console.log(`[SSE] Sent connection confirmation to user ${userId}`);

  // Send existing conversation entries
  const conversationManager = app.getConversationManagerForUser(userId);
  if (conversationManager) {
    const entries = conversationManager.getAllEntries();
    console.log(`[SSE] Sending ${entries.length} existing entries to user ${userId}`);
    entries.forEach(entry => {
      res.write(`event: translation\ndata: ${JSON.stringify(entry)}\n\n`);
    });
  } else {
    console.log(`[SSE] No conversation manager found for user ${userId}`);
  }

  // Handle disconnect
  req.on('close', () => {
    console.log(`[SSE] Client disconnected: ${userId}`);
    app.removeSSEClient(userId, res);
  });
}

// Get current language settings
async function getLanguageSettings(req: AuthRequest, res: Response) {
  console.log(`[API] Language settings request from ${req.headers.origin || 'unknown'}`);
  
  // For development without auth, use the first active user from glasses
  let userId = req.authUserId;
  if (!userId) {
    const activeUsers = Array.from(app.getActiveUsers());
    if (activeUsers.length > 0) {
      userId = activeUsers[0];
      console.log(`[API] Using active glasses user: ${userId} (dev mode)`);
    } else {
      userId = 'dev-user';
      console.log('[API] No active glasses users, using default dev-user');
    }
  }
  console.log(`[API] Getting language settings for user: ${userId}`);
  
  // In production, enforce authentication
  if (process.env.NODE_ENV === 'production' && !req.authUserId) {
    console.log('[API] Rejecting request - no authentication in production');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const conversationManager = app.getConversationManagerForUser(userId);
  if (conversationManager) {
    const languagePair = conversationManager.getLanguagePair();
    console.log(`[API] Returning language pair: ${languagePair.from} -> ${languagePair.to}`);
    res.json(languagePair);
  } else {
    console.log(`[API] No conversation manager found for user ${userId}`);
    res.json({ from: 'Unknown', to: 'Unknown' });
  }
}

// Routes
router.get('/translation-events', translationEvents);
router.get('/api/language-settings', getLanguageSettings);