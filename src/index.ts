// src/index.ts
import path from 'path';
import {
  TpaServer,
  TpaSession,
  ViewType,
} from '@augmentos/sdk';
import { TranscriptProcessor, languageToLocale, convertLineWidth } from '@augmentos/utils';
import axios from 'axios';

// Define TranslationData interface to match expected structure
interface TranslationData {
  isFinal: boolean;
  text: string;
  language?: string;
  targetLanguage?: string;
}

// Configuration constants
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 80;
const CLOUD_HOST_NAME = process.env.CLOUD_HOST_NAME || "cloud";
const PACKAGE_NAME = "com.augmentos.livetranslation";
const API_KEY = process.env.LIVE_TRANSLATION_API_KEY || 'test_key'; // In production, this would be securely stored
const MAX_FINAL_TRANSCRIPTS = 3;

// User transcript processors map
const userTranscriptProcessors: Map<string, TranscriptProcessor> = new Map();
// Map to track the active languages for each user (source and target)
const userSourceLanguages: Map<string, string> = new Map();
const userTargetLanguages: Map<string, string> = new Map();

// For debouncing transcripts per session
interface TranscriptDebouncer {
  lastSentTime: number;
  timer: NodeJS.Timeout | null;
}

/**
 * LiveTranslationApp - Main application class that extends TpaServer
 */
class LiveTranslationApp extends TpaServer {
  // Session debouncers for throttling non-final transcripts
  private sessionDebouncers = new Map<string, TranscriptDebouncer>();
  // Track active sessions by user ID
  private activeUserSessions = new Map<string, { session: TpaSession, sessionId: string }>();

  constructor() {
    super({
      packageName: PACKAGE_NAME,
      apiKey: API_KEY,
      port: PORT,
      publicDir: path.join(__dirname, './public'),
    });
  }

  /**
   * Called by TpaServer when a new session is created
   */
  protected async onSession(session: TpaSession, sessionId: string, userId: string): Promise<void> {
    console.log(`\n\n🗣️🗣️🗣️Received new session for user ${userId}, session ${sessionId}\n\n`);

    // Initialize transcript processor and debouncer for this session
    this.sessionDebouncers.set(sessionId, { lastSentTime: 0, timer: null });
    
    // Store the active session for this user
    this.activeUserSessions.set(userId, { session, sessionId });

    try {
      // Fetch and apply user settings (source/target languages, line width, etc.)
      await this.processSettings(userId, session, sessionId);

    } catch (error) {
      console.error('Error initializing session:', error);
      // Apply default settings if there was an error
      const transcriptProcessor = new TranscriptProcessor(30, 3, MAX_FINAL_TRANSCRIPTS);
      userTranscriptProcessors.set(userId, transcriptProcessor);
      
      // Default source and target languages
      const sourceLang = 'zh-CN';
      const targetLang = 'en-US';
      userSourceLanguages.set(userId, sourceLang);
      userTargetLanguages.set(userId, targetLang);

      // Setup handler for translation data
      const cleanup = session.onTranslationForLanguage(sourceLang, targetLang, (data: TranslationData) => {
        this.handleTranslation(session, sessionId, userId, data);
      });
      
      // Register cleanup handler
      this.addCleanupHandler(cleanup);
    }
  }

  /**
   * Called by TpaServer when a session is stopped
   */
  protected async onStop(sessionId: string, userId: string, reason: string): Promise<void> {
    console.log(`Session ${sessionId} stopped: ${reason}`);
    
    // Clean up session resources
    const debouncer = this.sessionDebouncers.get(sessionId);
    if (debouncer?.timer) {
      clearTimeout(debouncer.timer);
    }
    this.sessionDebouncers.delete(sessionId);
    
    // Remove active session if it matches this session ID
    const activeSession = this.activeUserSessions.get(userId);
    if (activeSession && activeSession.sessionId === sessionId) {
      this.activeUserSessions.delete(userId);
    }
  }

  /**
   * Processes user settings - either fetches them from API or uses provided settings
   * Can be used for both initial session setup and settings updates
   */
  public async processSettings(
    userId: string,
    session?: TpaSession, 
    sessionId?: string, 
    providedSettings?: any[]
  ): Promise<any> {
    try {
      // If no session provided, try to find an active one
      if (!session || !sessionId) {
        console.log(`No session provided for user ${userId}, looking for active session`);
        const activeSession = this.getActiveSessionForUser(userId);
        
        if (activeSession) {
          console.log(`Found active session ${activeSession.sessionId} for user ${userId}, using it`);
          return this.processSettings(userId, activeSession.session, activeSession.sessionId, providedSettings);
        } else {
          console.log(`No active session found for user ${userId}, cannot process settings`);
          return {
            status: 'Failed to process settings',
            error: 'No active session available',
            userId
          };
        }
      }
      
      let settings: any[] = providedSettings || [];
      
      // If settings aren't provided, fetch them from API
      if (!providedSettings) {
        console.log(`Fetching settings for user ${userId}`);
        const response = await axios.get(`http://${CLOUD_HOST_NAME}/tpasettings/user/${PACKAGE_NAME}`, {
          headers: { Authorization: `Bearer ${userId}` }
        });
        settings = response.data.settings;
        console.log(`Fetched settings for user ${userId}:`, settings);
      } else {
        console.log('Using provided settings for user:', userId);
      }
      
      // Extract settings
      const lineWidthSetting = settings.find(s => s.key === 'line_width');
      const numberOfLinesSetting = settings.find(s => s.key === 'number_of_lines');
      const transcribeLanguageSetting = settings.find(s => s.key === 'transcribe_language');
      const translateLanguageSetting = settings.find(s => s.key === 'translate_language');

      // Process language settings
      // Default source language is zh-CN, default target is en-US
      const sourceLang = transcribeLanguageSetting?.value ? languageToLocale(transcribeLanguageSetting.value) : 'zh-CN';
      const targetLang = translateLanguageSetting?.value ? languageToLocale(translateLanguageSetting.value) : 'en-US';

      // Get previous processor to check for language changes and preserve history
      const previousTranscriptProcessor = userTranscriptProcessors.get(userId);
      const previousSourceLang = userSourceLanguages.get(userId);
      const previousTargetLang = userTargetLanguages.get(userId);
      const languageChanged = (previousSourceLang && previousSourceLang !== sourceLang) || 
                              (previousTargetLang && previousTargetLang !== targetLang);
      
      // Store the current language settings
      userSourceLanguages.set(userId, sourceLang);
      userTargetLanguages.set(userId, targetLang);

      // Process line width and other formatting settings
      const isChineseTarget = targetLang.toLowerCase().startsWith('zh-') || targetLang.toLowerCase().startsWith('ja-');
      const lineWidth = lineWidthSetting ? convertLineWidth(lineWidthSetting.value, isChineseTarget) : 30;
      
      let numberOfLines = numberOfLinesSetting ? Number(numberOfLinesSetting.value) : 3;
      if (isNaN(numberOfLines) || numberOfLines < 1) numberOfLines = 3;

      console.log(`Applied settings for user ${userId}: source=${sourceLang}, target=${targetLang}, lineWidth=${lineWidth}, numberOfLines=${numberOfLines}`);

      // Create new processor with the settings
      const newProcessor = new TranscriptProcessor(lineWidth, numberOfLines, MAX_FINAL_TRANSCRIPTS, isChineseTarget);

      // Preserve transcript history if language didn't change and we have a previous processor
      if (!languageChanged && previousTranscriptProcessor) {
        const previousHistory = previousTranscriptProcessor.getFinalTranscriptHistory();
        for (const transcript of previousHistory) {
          newProcessor.processString(transcript, true);
        }
        console.log(`Preserved ${previousHistory.length} transcripts after settings change`);
      } else if (languageChanged) {
        console.log(`Cleared transcript history due to language change`);
      }

      // Update the processor
      userTranscriptProcessors.set(userId, newProcessor);

      // Show the updated transcript layout immediately with the new formatting
      if (session) {
        const formattedTranscript = newProcessor.getFormattedTranscriptHistory();
        this.showTranscriptsToUser(session, formattedTranscript, true);
      }

      // If we're in session context, set up translation handler
      console.log(`Setting up translation handlers for session ${sessionId} (${sourceLang}->${targetLang})`);
      
      // Create handler for the language pair
      const translationHandler = (data: TranslationData) => {
        this.handleTranslation(session, sessionId, userId, data);
      };

      // Subscribe to language-specific translation
      const cleanup = session.onTranslationForLanguage(sourceLang, targetLang, translationHandler);
      
      // Register cleanup handler
      this.addCleanupHandler(cleanup);
      
      console.log(`Subscribed to translations from ${sourceLang} to ${targetLang} for user ${userId}`);

      // Return status for API endpoint response
      return {
        status: 'Settings processed successfully',
        languageChanged: languageChanged,
        transcriptsPreserved: !languageChanged,
        sessionUpdated: true
      };
    } catch (error) {
      console.error(`Error processing settings for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Handles translation data from the AugmentOS cloud
   */
  private handleTranslation(
    session: TpaSession, 
    sessionId: string, 
    userId: string, 
    translationData: TranslationData
  ): void {
    let transcriptProcessor = userTranscriptProcessors.get(userId);
    if (!transcriptProcessor) {
      // Create default processor if none exists
      const targetLang = userTargetLanguages.get(userId) || 'en-US';
      const isChineseTarget = targetLang.toLowerCase().startsWith('zh-') || targetLang.toLowerCase().startsWith('ja-');
      transcriptProcessor = new TranscriptProcessor(30, 3, MAX_FINAL_TRANSCRIPTS, isChineseTarget);
      userTranscriptProcessors.set(userId, transcriptProcessor);
    }

    const isFinal = translationData.isFinal;
    const newText = translationData.text;
    const sourceLanguage = translationData.language || userSourceLanguages.get(userId) || 'zh-CN';
    const targetLanguage = translationData.targetLanguage || userTargetLanguages.get(userId) || 'en-US';

    console.log(`[Session ${sessionId}]: Received translation (${sourceLanguage}->${targetLanguage})`);

    // Process the new translation text
    transcriptProcessor.processString(newText, isFinal);

    let textToDisplay;

    if (isFinal) {
      // For final translations, get the formatted history
      textToDisplay = transcriptProcessor.getFormattedTranscriptHistory();
      console.log(`[Session ${sessionId}]: finalTranscriptCount=${transcriptProcessor.getFinalTranscriptHistory().length}`);
    } else {
      // For non-final, combine history with current partial
      const combinedTranscriptHistory = transcriptProcessor.getCombinedTranscriptHistory();
      const textToProcess = `${combinedTranscriptHistory} ${newText}`;
      textToDisplay = transcriptProcessor.getFormattedPartialTranscript(textToProcess);
    }

    console.log(`[Session ${sessionId}]: ${textToDisplay}`);
    console.log(`[Session ${sessionId}]: isFinal=${isFinal}`);

    this.debounceAndShowTranscript(session, sessionId, textToDisplay, isFinal);
  }

  /**
   * Debounces transcript display to avoid too frequent updates for non-final transcripts
   */
  private debounceAndShowTranscript(
    session: TpaSession,
    sessionId: string,
    transcript: string,
    isFinal: boolean
  ): void {
    const debounceDelay = 400; // in milliseconds
    let debouncer = this.sessionDebouncers.get(sessionId);
    
    if (!debouncer) {
      debouncer = { lastSentTime: 0, timer: null };
      this.sessionDebouncers.set(sessionId, debouncer);
    }

    // Clear any scheduled timer
    if (debouncer.timer) {
      clearTimeout(debouncer.timer);
      debouncer.timer = null;
    }

    const now = Date.now();

    // Show final transcripts immediately
    if (isFinal) {
      this.showTranscriptsToUser(session, transcript, isFinal);
      debouncer.lastSentTime = now;
      return;
    }

    // Throttle non-final transcripts
    if (now - debouncer.lastSentTime >= debounceDelay) {
      this.showTranscriptsToUser(session, transcript, false);
      debouncer.lastSentTime = now;
    } else {
      debouncer.timer = setTimeout(() => {
        this.showTranscriptsToUser(session, transcript, false);
        if (debouncer) {
          debouncer.lastSentTime = Date.now();
        }
      }, debounceDelay);
    }
  }

  /**
   * Displays transcript text in the AR view
   */
  private showTranscriptsToUser(
    session: TpaSession,
    transcript: string,
    isFinal: boolean
  ): void {
    session.layouts.showTextWall(transcript, {
      view: ViewType.MAIN,
      // Use a fixed duration for final transcripts (20 seconds)
      durationMs: isFinal ? 20000 : undefined,
    });
  }

  // Helper method to get active session for a user
  public getActiveSessionForUser(userId: string): { session: TpaSession, sessionId: string } | null {
    return this.activeUserSessions.get(userId) || null;
  }
}

// Create and start the app
const liveTranslationApp = new LiveTranslationApp();

// Add settings endpoint
const expressApp = liveTranslationApp.getExpressApp();
expressApp.post('/settings', async (req: any, res: any) => {
  try {
    const { userIdForSettings, settings } = req.body;

    if (!userIdForSettings || !Array.isArray(settings)) {
      return res.status(400).json({ error: 'Missing userId or settings array in payload' });
    }

    // Process settings - the method will find active session if available
    const result = await liveTranslationApp.processSettings(userIdForSettings, undefined, undefined, settings);
    
    res.json(result);
  } catch (error) {
    console.error('Error in settings endpoint:', error);
    res.status(500).json({ error: 'Internal server error updating settings' });
  }
});

// Add health check endpoint
expressApp.get('/health', (req: any, res: any) => {
  res.json({ status: 'healthy', app: PACKAGE_NAME });
});

// Start the server
liveTranslationApp.start().then(() => {
  console.log(`${PACKAGE_NAME} server running on port ${PORT}`);
}).catch(error => {
  console.error('Failed to start server:', error);
});
