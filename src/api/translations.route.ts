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
  
  // In production, enforce authentication (but allow fallback to dev-user for now)
  if (process.env.NODE_ENV === 'production' && !req.authUserId && !req.query.token) {
    console.warn('[SSE] No authentication in production - using fallback');
    // Temporarily allow without strict auth for development
    // TODO: Implement proper auth token system
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
  
  // In production, enforce authentication (but allow fallback for now)
  if (process.env.NODE_ENV === 'production' && !req.authUserId) {
    console.log('[API] No authentication in production - using fallback');
    // Temporarily allow without strict auth for development
    // TODO: Implement proper auth token system
  }

  // Get languages from session storage first
  const storedLanguages = await app.getUserLanguagesFromStorage(userId);
  if (storedLanguages) {
    console.log(`[API] Returning stored language pair: ${storedLanguages.from} -> ${storedLanguages.to}`);
    res.json(storedLanguages);
  } else {
    // Fallback to conversation manager if no stored languages
    const conversationManager = app.getConversationManagerForUser(userId);
    if (conversationManager) {
      const languagePair = conversationManager.getLanguagePair();
      console.log(`[API] Returning language pair from conversation manager: ${languagePair.from} -> ${languagePair.to}`);
      res.json(languagePair);
    } else {
      console.log(`[API] No conversation manager found for user ${userId}`);
      res.json({ from: 'Unknown', to: 'Unknown' });
    }
  }
}

// Update language settings
async function updateLanguageSettings(req: AuthRequest, res: Response) {
  console.log(`[API] Language settings update request from ${req.headers.origin || 'unknown'}`);
  
  const { from, to } = req.body;
  
  if (!from && !to) {
    return res.status(400).json({ error: 'At least one language must be specified' });
  }
  
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
  console.log(`[API] Updating language settings for user: ${userId}`, { from, to });
  
  // In production, enforce authentication (but allow fallback for now)
  if (process.env.NODE_ENV === 'production' && !req.authUserId) {
    console.log('[API] No authentication in production - using fallback');
    // Temporarily allow without strict auth for development
    // TODO: Implement proper auth token system
  }

  // Update the languages in the app
  try {
    const success = await app.updateUserLanguages(userId, from, to);
    if (success) {
      const conversationManager = app.getConversationManagerForUser(userId);
      const updatedLanguagePair = conversationManager?.getLanguagePair() || { from: from || 'Unknown', to: to || 'Unknown' };
      console.log(`[API] Successfully updated language settings: ${updatedLanguagePair.from} -> ${updatedLanguagePair.to}`);
      res.json(updatedLanguagePair);
    } else {
      console.error(`[API] Failed to update language settings for user: ${userId}`);
      res.status(500).json({ error: 'Failed to update language settings' });
    }
  } catch (error) {
    console.error(`[API] Error updating language settings:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Routes
router.get('/translation-events', translationEvents);
router.get('/api/language-settings', getLanguageSettings);
router.post('/api/language-settings', updateLanguageSettings);