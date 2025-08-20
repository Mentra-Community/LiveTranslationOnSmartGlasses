// src/index.ts
import path from 'path';
import {
  AppServer,
  ViewType,
  TranslationData,
  AppSession,
} from '@mentra/sdk';
import { TranscriptProcessor, languageToLocale, localeToLanguage, convertLineWidth } from './utils';
import { convertToPinyin } from './utils/ChineseUtils';
import { ConfidenceCalculator, ConfidenceHeuristic } from './utils/confidenceHeuristics';
import { ConversationManager } from './services/ConversationManager';
import { setupAPI } from './api';
import fs from 'fs';
import { Response } from 'express';

// Load TPA config to get default values
const tpaConfigPath = path.join(__dirname, './public/tpa_config.json');
const tpaConfig = JSON.parse(fs.readFileSync(tpaConfigPath, 'utf8'));

// Extract default values from config
const defaultSettings = {
  transcribeLanguage: tpaConfig.settings.find((s: any) => s.key === 'transcribe_language')?.defaultValue || 'Chinese (Hanzi)',
  translateLanguage: tpaConfig.settings.find((s: any) => s.key === 'translate_language')?.defaultValue || 'English',
  lineWidth: tpaConfig.settings.find((s: any) => s.key === 'line_width')?.defaultValue || 'Medium',
  numberOfLines: tpaConfig.settings.find((s: any) => s.key === 'number_of_lines')?.defaultValue || 3,
  displayMode: tpaConfig.settings.find((s: any) => s.key === 'display_mode')?.defaultValue || 'everything',
  confidenceHeuristic: tpaConfig.settings.find((s: any) => s.key === 'confidence_heuristic')?.defaultValue || 'None'
};

// Configuration constants
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 80;
const PACKAGE_NAME = process.env.PACKAGE_NAME;
const AUGMENTOS_API_KEY = process.env.AUGMENTOS_API_KEY; // In production, this would be securely stored
const MAX_FINAL_TRANSCRIPTS = 100;

// Verify env vars are set
if (!AUGMENTOS_API_KEY) {
  throw new Error('AUGMENTOS_API_KEY environment variable is required.');
}
if (!PACKAGE_NAME) {
  throw new Error('PACKAGE_NAME environment variable is required.');
}

// User transcript processors map
const userTranscriptProcessors: Map<string, TranscriptProcessor> = new Map();
// Map to track the active languages for each user (source and target)
const userSourceLanguages: Map<string, string> = new Map();
const userTargetLanguages: Map<string, string> = new Map();
const userDisplayModes: Map<string, string> = new Map();
const userConfidenceCalculators: Map<string, ConfidenceCalculator> = new Map();
const userConfidenceHeuristics: Map<string, ConfidenceHeuristic> = new Map(); // Store per-user heuristic

// For debouncing transcripts per session
interface TranscriptDebouncer {
  lastSentTime: number;
  timer: NodeJS.Timeout | null;
}

// For managing inactivity timers per session
interface InactivityTimer {
  timer: NodeJS.Timeout | null;
  lastActivityTime: number;
}

/**
 * LiveTranslationApp - Main application class that extends TpaServer
 */
export class LiveTranslationApp extends AppServer {
  // Session debouncers for throttling non-final transcripts
  private sessionDebouncers = new Map<string, TranscriptDebouncer>();
  // Track active sessions by user ID
  private activeUserSessions = new Map<string, { session: AppSession, sessionId: string }>();
  // Inactivity timers for clearing text after 40 seconds of no activity
  private inactivityTimers = new Map<string, InactivityTimer>();
  // Conversation managers per user
  private userConversationManagers = new Map<string, ConversationManager>();
  // SSE clients tracking per user
  private userSSEClients = new Map<string, Set<Response>>();

  constructor() {
    super({
      packageName: PACKAGE_NAME!,
      apiKey: AUGMENTOS_API_KEY!,
      port: PORT,
      publicDir: path.join(__dirname, './public'),
    });
    
    // Enable CORS for the webview
    this.setupCORS();
  }
  
  private setupCORS(): void {
    const app = this.getExpressApp();
    app.use((req, res, next) => {
      // Allow requests from any origin for development
      // In production, you should restrict this to your actual webview domain
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  /**
   * Called by TpaServer when a new session is created
   */
  protected async onSession(session: AppSession, sessionId: string, userId: string): Promise<void> {
    console.log(`\n\n🗣️🗣️🗣️Received new session for user ${userId}, session ${sessionId}\n\n`);

    // Initialize transcript processor and debouncer for this session
    this.sessionDebouncers.set(sessionId, { lastSentTime: 0, timer: null });
    
    // Initialize inactivity timer for this session
    this.inactivityTimers.set(sessionId, { timer: null, lastActivityTime: Date.now() });
    
    // Store the active session for this user
    this.activeUserSessions.set(userId, { session, sessionId });
    
    // Initialize conversation manager for this user
    let conversationManager = this.userConversationManagers.get(userId);
    if (!conversationManager) {
      conversationManager = new ConversationManager();
      this.userConversationManagers.set(userId, conversationManager);
    }

    try {
      // Set up settings change handlers
      this.setupSettingsHandlers(session, sessionId, userId);
      
      // Apply initial settings
      await this.applySettings(session, sessionId, userId);

    } catch (error) {
      console.error('Error initializing session:', error);
      // Apply default settings if there was an error
      const transcriptProcessor = new TranscriptProcessor(
        convertLineWidth(defaultSettings.lineWidth, defaultSettings.translateLanguage.toLowerCase().includes('hanzi')), 
        defaultSettings.numberOfLines, 
        MAX_FINAL_TRANSCRIPTS
      );
      userTranscriptProcessors.set(userId, transcriptProcessor);
      
      // Default source and target languages from config
      const sourceLang = defaultSettings.transcribeLanguage;
      const targetLang = defaultSettings.translateLanguage;
      const sourceLocale = languageToLocale(sourceLang);
      const targetLocale = languageToLocale(targetLang);

      console.log(`[Session ${sessionId}]: sourceLang=${sourceLang}, targetLang=${targetLang}`);
      userSourceLanguages.set(userId, sourceLang);
      userTargetLanguages.set(userId, targetLang);
      userDisplayModes.set(userId, defaultSettings.displayMode);
      userConfidenceCalculators.set(userId, new ConfidenceCalculator());
      userConfidenceHeuristics.set(userId, defaultSettings.confidenceHeuristic as ConfidenceHeuristic);

      // Setup handler for translation data
      const cleanup = session.onTranslationForLanguage(sourceLocale, targetLocale, (data: TranslationData) => {
        this.handleTranslation(session, sessionId, userId, data);
        // I don't like how ConversationManager is an event emitter, so we handle the translation directly here like.
        // const conversationManager = this.userConversationManagers.get(userId);
        // conversationManager.handleTranslation(data);
      });
      
      // Register cleanup handler
      this.addCleanupHandler(cleanup);
    }
  }

  /**
   * Set up handlers for settings changes
   */
  private setupSettingsHandlers(
    session: AppSession,
    sessionId: string,
    userId: string
  ): void {
    // Handle line width changes
    session.settings.onValueChange('line_width', (newValue, oldValue) => {
      console.log(`Line width changed for user ${userId}: ${oldValue} -> ${newValue}`);
      this.applySettings(session, sessionId, userId);
    });

    // Handle number of lines changes
    session.settings.onValueChange('number_of_lines', (newValue, oldValue) => {
      console.log(`Number of lines changed for user ${userId}: ${oldValue} -> ${newValue}`);
      this.applySettings(session, sessionId, userId);
    });

    // Handle source language changes
    session.settings.onValueChange('transcribe_language', (newValue, oldValue) => {
      console.log(`Transcribe language changed for user ${userId}: ${oldValue} -> ${newValue}`);
      this.applySettings(session, sessionId, userId);
    });

    // Handle target language changes
    session.settings.onValueChange('translate_language', (newValue, oldValue) => {
      console.log(`Translate language changed for user ${userId}: ${oldValue} -> ${newValue}`);
      this.applySettings(session, sessionId, userId);
    });

    // Handle display mode changes
    session.settings.onValueChange('display_mode', (newValue, oldValue) => {
      console.log(`Display mode changed for user ${userId}: ${oldValue} -> ${newValue}`);
      this.applySettings(session, sessionId, userId);
    });

    // Handle confidence heuristic changes
    session.settings.onValueChange('confidence_heuristic', (newValue, oldValue) => {
      console.log(`Confidence heuristic changed for user ${userId}: ${oldValue} -> ${newValue}`);
      this.applySettings(session, sessionId, userId);
    });
  }

  /**
   * Apply settings from the session to the transcript processor
   */
  private async applySettings(
    session: AppSession,
    sessionId: string,
    userId: string
  ): Promise<void> {
    try {
      // Extract settings
      const sourceLang = session.settings.get<string>('transcribe_language', defaultSettings.transcribeLanguage);
      const targetLang = session.settings.get<string>('translate_language', defaultSettings.translateLanguage);
      const displayMode = session.settings.get<string>('display_mode', defaultSettings.displayMode);
      const lineWidthSetting = session.settings.get<string>('line_width', defaultSettings.lineWidth);
      const numberOfLinesSetting = session.settings.get<number>('number_of_lines', defaultSettings.numberOfLines);
      const confidenceHeuristicSetting = session.settings.get<string>('confidence_heuristic', defaultSettings.confidenceHeuristic) as ConfidenceHeuristic;

      // Check for unsupported languages (Hebrew and Standard Arabic)
      const unsupportedLanguages = ['Hebrew', 'Standard Arabic'];
      if (session.capabilities?.modelName === "Even Realities G1" && unsupportedLanguages.includes(targetLang)) {
        console.log(`[Session ${sessionId}]: Unsupported language detected - sourceLang=${sourceLang}, targetLang=${targetLang}`);
        session.layouts.showTextWall("This language is not supported on the Even Realities G1 glasses. Please use the Simulated Glasses instead.", {
          view: ViewType.MAIN,
          durationMs: 10000, // Show for 10 seconds
        });
        return; // Exit early without setting up translation handlers
      }

      // Get previous values for comparison
      const previousSourceLang = userSourceLanguages.get(userId);
      const previousTargetLang = userTargetLanguages.get(userId);
      const languageChanged = (previousSourceLang && previousSourceLang !== sourceLang) || 
                              (previousTargetLang && previousTargetLang !== targetLang);
      
      // Update stored settings
      userSourceLanguages.set(userId, sourceLang);
      userTargetLanguages.set(userId, targetLang);
      userDisplayModes.set(userId, displayMode);
      userConfidenceHeuristics.set(userId, confidenceHeuristicSetting);
      
      // Update conversation manager language pair
      const conversationManager = this.userConversationManagers.get(userId);
      if (conversationManager) {
        conversationManager.setLanguagePair(sourceLang, targetLang);
        
        // Broadcast language change to all connected webview clients
        this.broadcastToUserSSEClients(userId, { 
          type: 'languageChange', 
          data: { from: sourceLang, to: targetLang } 
        });
        console.log(`[SSE] Sent language change event to all clients for user ${userId}: ${sourceLang} → ${targetLang}`);
      }
      
      // Update or initialize confidence calculator
      let confidenceCalculator = userConfidenceCalculators.get(userId);
      if (!confidenceCalculator) {
        confidenceCalculator = new ConfidenceCalculator();
        userConfidenceCalculators.set(userId, confidenceCalculator);
      }
      // confidenceCalculator.setHeuristic(confidenceHeuristicSetting);

      console.log(`[Session ${sessionId}]: sourceLang=${sourceLang}, targetLang=${targetLang}`);

      // Convert locales
      const sourceLocale = languageToLocale(sourceLang);
      const targetLocale = languageToLocale(targetLang);

      console.log(`[Session ${sessionId}]: sourceLocale=${sourceLocale}, targetLocale=${targetLocale}`);
      
      // Process line width and other formatting settings
      const isChineseTarget = targetLang.toLowerCase().includes('hanzi') || targetLocale.toLowerCase().startsWith('ja-');
      const lineWidth = convertLineWidth(lineWidthSetting, isChineseTarget);
      
      let numberOfLines = typeof numberOfLinesSetting === 'number' ? numberOfLinesSetting : parseInt(numberOfLinesSetting);
      if (isNaN(numberOfLines) || numberOfLines < 1) numberOfLines = defaultSettings.numberOfLines;

      console.log(`Applied settings for user ${userId}: sourceLang=${sourceLang}, targetLang=${targetLang}, displayMode=${displayMode}, lineWidth=${lineWidth}, numberOfLines=${numberOfLines}, confidenceHeuristic=${confidenceHeuristicSetting}`);
      
      // Get previous processor to check for language changes and preserve history
      const previousTranscriptProcessor = userTranscriptProcessors.get(userId);
      
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
        confidenceCalculator.resetState();
      }

      // Update the processor
      userTranscriptProcessors.set(userId, newProcessor);

      // Show the updated transcript layout immediately with the new formatting
      const formattedTranscript = newProcessor.processString("", true);
      this.showTranscriptsToUser(session, formattedTranscript, true);

      // Setup handler for translation data
      console.log(`Setting up translation handlers for session ${sessionId} (${sourceLocale}->${targetLocale})`);
      
      // Create handler for the language pair
      const translationHandler = (data: TranslationData) => {
        this.handleTranslation(session, sessionId, userId, data);
      };

      // Subscribe to language-specific translation
      const cleanup = session.onTranslationForLanguage(sourceLocale, targetLocale, translationHandler);
      
      // Register cleanup handler
      this.addCleanupHandler(cleanup);
      
      console.log(`Subscribed to translations from ${sourceLocale} to ${targetLocale} for user ${userId}`);
      
    } catch (error) {
      console.error(`Error applying settings for user ${userId}:`, error);
      throw error;
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
    
    // Clean up inactivity timer
    const inactivityTimer = this.inactivityTimers.get(sessionId);
    if (inactivityTimer?.timer) {
      clearTimeout(inactivityTimer.timer);
    }
    this.inactivityTimers.delete(sessionId);
    
    // Remove active session if it matches this session ID
    const activeSession = this.activeUserSessions.get(userId);
    if (activeSession && activeSession.sessionId === sessionId) {
      this.activeUserSessions.delete(userId);
    }

    // WIPE EVERYTHING - Complete cleanup of all user data
    console.log(`🧹 Wiping all data for user ${userId} (session ${sessionId})`);
    
    // Clear transcript processor
    userTranscriptProcessors.delete(userId);
    
    // Clear language settings
    userSourceLanguages.delete(userId);
    userTargetLanguages.delete(userId);
    
    // Clear display mode
    userDisplayModes.delete(userId);
    
    // Clear confidence calculator and heuristic
    userConfidenceCalculators.delete(userId);
    userConfidenceHeuristics.delete(userId);
    
    // Clear conversation manager
    this.userConversationManagers.delete(userId);
    
    console.log(`✅ Complete data wipe completed for user ${userId}`);
  }

  /**
   * Handles translation data from the AugmentOS cloud
   */
  private handleTranslation(
    session: AppSession, 
    sessionId: string, 
    userId: string, 
    translationData: TranslationData
  ): void {
    // Reset inactivity timer when new translation is received
    this.resetInactivityTimer(session, sessionId, userId);

    console.log(`[Session ${sessionId}]: Handling translation for user ${userId}`);


// this place seems pretty sus here not gonna lie
    let transcriptProcessor = userTranscriptProcessors.get(userId);
    if (!transcriptProcessor) {
      const targetLang = userTargetLanguages.get(userId) || defaultSettings.translateLanguage;
      const isChineseTarget = targetLang.toLowerCase().startsWith('zh-') || targetLang.toLowerCase().startsWith('ja-');
      transcriptProcessor = new TranscriptProcessor(
        convertLineWidth(defaultSettings.lineWidth, isChineseTarget),
        defaultSettings.numberOfLines,
        MAX_FINAL_TRANSCRIPTS,
        isChineseTarget
      );
      userTranscriptProcessors.set(userId, transcriptProcessor);
    }

    console.log(`[Session ${sessionId}]: Confidence calculator: ${userConfidenceCalculators.get(userId)}`);

    let confidenceCalculator = userConfidenceCalculators.get(userId);
    if (!confidenceCalculator) {
      confidenceCalculator = new ConfidenceCalculator();
      userConfidenceCalculators.set(userId, confidenceCalculator);
    }

    // Use the cached heuristic for this user
    const confidenceHeuristicSetting = userConfidenceHeuristics.get(userId) || defaultSettings.confidenceHeuristic;
    console.log(`[Session ${sessionId}]: Confidence heuristic: ${confidenceHeuristicSetting}`);

    // Check if we should accept this interim transcript (length protection)
    // if (!confidenceCalculator.shouldAcceptInterim(translationData.text, translationData.isFinal)) {
    //   console.log(`[Session ${sessionId}]: Rejecting shorter interim transcript`);
    //   return; // Don't process shorter interim transcripts
    // }

    const isFinal = translationData.isFinal;
    let newText = translationData.text;
    const sourceLanguage = userSourceLanguages.get(userId) || defaultSettings.transcribeLanguage;
    const targetLanguage = userTargetLanguages.get(userId) || defaultSettings.translateLanguage;
    const sourceLocale = languageToLocale(sourceLanguage);
    const targetLocale = languageToLocale(targetLanguage);

    // Get the display mode from settings or use default
    const displayMode = userDisplayModes.get(userId) || defaultSettings.displayMode;

    const shouldDisplayOnGlasses = translationData.transcribeLanguage?.split('-')[0] === sourceLocale.split('-')[0];
    // Determine what text to show on glasses based on target language preference
    let glassesDisplayText = newText;
    if (translationData.didTranslate) {
      // If translation occurred, check if we should show original or translated text
      const detectedTargetLocale = translationData.translateLanguage || '';
      const userTargetLocale = languageToLocale(targetLanguage);
      
      // Show the text that matches the user's target language preference
      if (detectedTargetLocale.split('-')[0] === userTargetLocale.split('-')[0]) {
        // The translated text matches user's target language - show translated text
        glassesDisplayText = newText;
      } else {
        
        // The translated text doesn't match user's target language - show original text
        glassesDisplayText = ""
        
      }
    }
    
    // For glasses display: only show translations when in 'translations' mode
    if (displayMode === 'translations' && !translationData.didTranslate) {
      console.log(`[Session ${sessionId}]: Skipping glasses display - not a translation`);
      // Don't return - still process for webview
    }

    // console.log(`[Session ${sessionId}]: Received translation (${sourceLocale}->${targetLocale})`);

    // Apply Pinyin conversion to glasses display text if target is Pinyin
    if (targetLanguage === 'Chinese (Pinyin)') {
      const pinyinTranscript = convertToPinyin(glassesDisplayText);
      console.log(`[Session ${sessionId}]: Converting Chinese to Pinyin for glasses display`);
      glassesDisplayText = pinyinTranscript;
      
      // Also convert newText for webview if it's Chinese
      if (newText === glassesDisplayText) {
        newText = pinyinTranscript;
      }
    }

    // Add translation to conversation manager for webview (bidirectional)
    const conversationManager = this.userConversationManagers.get(userId);
    if (conversationManager && translationData.didTranslate) {
      // Determine the actual source and target languages from the translation data
      const detectedSourceLang = localeToLanguage(translationData.transcribeLanguage || 'en');
      const detectedTargetLang = localeToLanguage(translationData.translateLanguage || 'en');
      const originalText = translationData.originalText || '';
      
      console.log(`[Language Detection] Detected: ${translationData.transcribeLanguage} (${detectedSourceLang}) → ${translationData.translateLanguage} (${detectedTargetLang})`);
      console.log(`[Language Detection] originalText: "${originalText}", translatedText: "${newText}"`);
      
      console.log("Right here: -> ", {originalText})
      console.log("Right here: -> ", {newText})
      // Add the translation entry with the actual detected languages
      const entry = conversationManager.addTranslation(
        originalText,
        newText,
        detectedSourceLang,
        detectedTargetLang,
        isFinal
      );
      
      // Broadcast to SSE clients if entry was created
      if (entry) {
        console.log(`[Translation] Broadcasting to SSE clients for user ${userId}:`, {
          id: entry.id,
          originalLang: entry.originalLanguage,
          translatedLang: entry.translatedLanguage,
          isFinal: entry.isFinal
        });
        this.broadcastToUserSSEClients(userId, { type: 'translation', data: entry });
      }
    }

    let textToDisplay: string;
    if (isFinal) {
      // For final translations, show the glasses display text
      textToDisplay = transcriptProcessor.processString(glassesDisplayText, isFinal);
      
      confidenceCalculator.resetState(); // Reset confidence state on final transcript
      confidenceCalculator.resetInterimTracking(); // Reset interim tracking after final transcript
      console.log(`[Session ${sessionId}]: finalTranscriptCount=${transcriptProcessor.getFinalTranscriptHistory().length}`);
    } else {
      // For interim, show only the confident prefix (plus transcript history) if heuristic is not 'None'
      const isHanzi = targetLanguage.toLowerCase().includes('hanzi') || targetLocale.toLowerCase().startsWith('ja-');
      let confidentPrefix: string;
      if (confidenceHeuristicSetting === 'None') {
        confidentPrefix = glassesDisplayText;
      } else {
        // Update the confidence calculator's state for this interim
        confidenceCalculator.calculateConfidence(glassesDisplayText, isHanzi, confidenceHeuristicSetting as ConfidenceHeuristic);
        confidentPrefix = confidenceCalculator.getNonShrinkingConfidentPrefix(glassesDisplayText, 0.4, isHanzi, confidenceHeuristicSetting as ConfidenceHeuristic);
      }
      // Only pass the confident prefix to the processor (it manages its own history)
      textToDisplay = transcriptProcessor.processString(confidentPrefix, false);
    }

    // Display logic based on mode and translation status
    if (displayMode === 'translations' && translationData.didTranslate) {
      console.log(`[Session ${sessionId}]: Showing translation ${translationData.transcribeLanguage}->${translationData.translateLanguage}: ${textToDisplay}`);
      console.log(`[Session ${sessionId}]: isFinal=${isFinal}`);
      this.debounceAndShowTranscript(session, sessionId, textToDisplay, isFinal);
    } else if (displayMode === 'everything') {
      // Show everything mode - display all translations
      console.log(`[Session ${sessionId}]: Showing all: ${textToDisplay}`);
      this.debounceAndShowTranscript(session, sessionId, textToDisplay, isFinal);
    } else {
      console.log(`[Session ${sessionId}]: Skipping glasses display - displayMode=${displayMode}, didTranslate=${translationData.didTranslate}`);
    }
  }

  /**
   * Debounces transcript display to avoid too frequent updates for non-final transcripts
   */
  private debounceAndShowTranscript(
    session: AppSession,
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
   * Cleans the transcript text by removing leading punctuation while preserving Spanish question marks
   * and Chinese characters
   */
  private cleanTranscriptText(text: string): string {
    // Remove basic punctuation marks (both Western and Chinese)
    // Western: . , ; : ! ?
    // Chinese: 。 ， ； ： ！ ？
    return text.replace(/^[.,;:!?。，；：！？]+/, '').trim();
  }

  /**
   * Displays transcript text in the AR view
   */
  private showTranscriptsToUser(
    session: AppSession,
    transcript: string,
    isFinal: boolean
  ): void {
    const cleanedTranscript = this.cleanTranscriptText(transcript);

    session.layouts.showTextWall(cleanedTranscript, {
      view: ViewType.MAIN,
      // Use a fixed duration for final transcripts (20 seconds)
      durationMs: isFinal ? 20000 : undefined,
    });
  }

  /**
   * Helper method to get active session for a user
   */
  public getActiveSessionForUser(userId: string): { session: AppSession, sessionId: string } | null {
    return this.activeUserSessions.get(userId) || null;
  }

  /**
   * Add an SSE client for a specific user
   */
  public addSSEClient(userId: string, client: Response): void {
    if (!this.userSSEClients.has(userId)) {
      this.userSSEClients.set(userId, new Set());
    }
    this.userSSEClients.get(userId)!.add(client);
  }

  /**
   * Remove an SSE client for a specific user
   */
  public removeSSEClient(userId: string, client: Response): void {
    const clients = this.userSSEClients.get(userId);
    if (clients) {
      clients.delete(client);
      // Clean up empty sets
      if (clients.size === 0) {
        this.userSSEClients.delete(userId);
      }
    }
  }

  /**
   * Get conversation manager for a specific user
   */
  public getConversationManagerForUser(userId: string): ConversationManager | undefined {
    return this.userConversationManagers.get(userId);
  }
  
  /**
   * Get all active users (for dev mode)
   */
  public getActiveUsers(): Set<string> {
    return new Set(this.activeUserSessions.keys());
  }

  /**
   * Broadcast a message to all SSE clients for a specific user
   */
  private broadcastToUserSSEClients(userId: string, data: any): void {
    const clients = this.userSSEClients.get(userId);
    if (!clients || clients.size === 0) {
      console.log(`[SSE] No active clients for user ${userId}`);
      return;
    }
    
    console.log(`[SSE] Broadcasting to ${clients.size} clients for user ${userId}`);
    const message = `event: ${data.type}\ndata: ${JSON.stringify(data.data)}\n\n`;
    clients.forEach(client => {
      try {
        client.write(message);
        console.log(`[SSE] Message sent successfully`);
      } catch (error) {
        console.error('[SSE] Error broadcasting to client:', error);
        // Remove dead connections
        clients.delete(client);
      }
    });
  }

  /**
   * Resets the inactivity timer for a session and schedules text clearing
   */
  private resetInactivityTimer(session: AppSession, sessionId: string, userId: string): void {
    const inactivityTimer = this.inactivityTimers.get(sessionId);
    if (!inactivityTimer) return;

    // Clear existing timer
    if (inactivityTimer.timer) {
      clearTimeout(inactivityTimer.timer);
    }

    // Update last activity time
    inactivityTimer.lastActivityTime = Date.now();

    // Schedule transcript processor clearing after 40 seconds (40000ms)
    inactivityTimer.timer = setTimeout(() => {
      // Clear the transcript processor's history
      const transcriptProcessor = userTranscriptProcessors.get(userId);
      if (transcriptProcessor) {
        // Clear the processor's history
        transcriptProcessor.clear();
        
        // Clear conversation manager
        const conversationManager = this.userConversationManagers.get(userId);
        if (conversationManager) {
          conversationManager.clear();
          
          // Broadcast clear event to all connected webview clients
          this.broadcastToUserSSEClients(userId, { type: 'clear', data: {} });
          console.log(`[SSE] Sent clear event to all clients for user ${userId} due to inactivity`);
        }
        
        // Show empty state to user
        session.layouts.showTextWall("", {
          view: ViewType.MAIN,
          durationMs: 1000, // Brief display to clear the text
        });
      }
    }, 40000);
  }
}

// Create and start the app
const liveTranslationApp = new LiveTranslationApp();

// Set up API routes
const expressApp = liveTranslationApp.getExpressApp();
setupAPI(expressApp, liveTranslationApp);

// Start the server
liveTranslationApp.start().then(() => {
  console.log(`${PACKAGE_NAME} server running on port ${PORT}`);
}).catch(error => {
  console.error('Failed to start server:', error);
});