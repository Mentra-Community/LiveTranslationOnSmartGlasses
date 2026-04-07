export interface TranslationEntry {
  id: string;
  timestamp: number;
  originalText: string;
  translatedText: string;
  originalLanguage: string;
  translatedLanguage: string;
  isFinal: boolean;
  isNewUtterance?: boolean;
}

export interface LanguagePair {
  from: string;
  to: string;
}

export class ConversationManager {
  private entries: Map<string, TranslationEntry> = new Map();
  private entryOrder: string[] = [];
  private currentInterimId: string | null = null;
  private currentInterimLanguagePair: { from: string; to: string } | null = null;
  private entryCounter: number = 0;
  private maxEntries: number = 500;
  private languagePair: LanguagePair = { from: 'Unknown', to: 'Unknown' };

  constructor() {}

  /**
   * Set the current language pair for the conversation
   */
  setLanguagePair(from: string, to: string): void {
    this.languagePair = { from, to };
  }

  /**
   * Get the current language pair
   */
  getLanguagePair(): LanguagePair {
    return this.languagePair;
  }

  /**
   * Add or update a translation entry
   * Returns the created/updated entry, or null if no entry was created
   * Also returns a finalizedEntry if a previous interim entry was finalized due to language change
   */
  addTranslation(
    originalText: string,
    translatedText: string,
    originalLanguage: string,
    translatedLanguage: string,
    isFinal: boolean
  ): { entry: TranslationEntry | null; finalizedEntry?: TranslationEntry } {
    let entry: TranslationEntry | null = null;
    let finalizedEntry: TranslationEntry | undefined = undefined;

    // Check if language pair has changed
    const currentLanguagePair = { from: originalLanguage, to: translatedLanguage };
    const languageChanged = this.currentInterimLanguagePair && (
      this.currentInterimLanguagePair.from !== currentLanguagePair.from ||
      this.currentInterimLanguagePair.to !== currentLanguagePair.to
    );

    // If language changed, finalize the previous interim entry and start a new one
    if (languageChanged && this.currentInterimId) {
      const previousEntry = this.entries.get(this.currentInterimId);
      if (previousEntry) {
        // Finalize the previous entry
        const finalized = {
          ...previousEntry,
          isFinal: true,
          isNewUtterance: true
        };
        this.entries.set(this.currentInterimId, finalized);
        finalizedEntry = finalized;
      }
      // Reset to allow new entry creation
      this.currentInterimId = null;
      this.currentInterimLanguagePair = null;
    }

    if (!isFinal && this.currentInterimId && !languageChanged) {
      // Update existing interim entry (same language)
      entry = {
        id: this.currentInterimId,
        timestamp: Date.now(),
        originalText,
        translatedText,
        originalLanguage,
        translatedLanguage,
        isFinal: false
      };
      this.entries.set(this.currentInterimId, entry);
      this.currentInterimLanguagePair = currentLanguagePair;
    } else if (isFinal && this.currentInterimId && !languageChanged) {
      // Convert interim to final (same language)
      entry = {
        id: this.currentInterimId,
        timestamp: Date.now(),
        originalText,
        translatedText,
        originalLanguage,
        translatedLanguage,
        isFinal: true,
        isNewUtterance: true
      };
      this.entries.set(this.currentInterimId, entry);
      this.currentInterimId = null;
      this.currentInterimLanguagePair = null;
    } else {
      // Create new entry (new utterance or language changed)
      const id = `entry-${++this.entryCounter}`;
      entry = {
        id,
        timestamp: Date.now(),
        originalText,
        translatedText,
        originalLanguage,
        translatedLanguage,
        isFinal,
        isNewUtterance: isFinal
      };

      this.entries.set(id, entry);
      this.entryOrder.push(id);

      if (!isFinal) {
        this.currentInterimId = id;
        this.currentInterimLanguagePair = currentLanguagePair;
      }

      // Maintain max entries limit
      if (this.entryOrder.length > this.maxEntries) {
        const oldestId = this.entryOrder.shift();
        if (oldestId) {
          this.entries.delete(oldestId);
        }
      }
    }

    return { entry, finalizedEntry };
  }

  /**
   * Get all entries in order
   */
  getAllEntries(): TranslationEntry[] {
    return this.entryOrder
      .map(id => this.entries.get(id))
      .filter((entry): entry is TranslationEntry => entry !== undefined);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear();
    this.entryOrder = [];
    this.currentInterimId = null;
    this.currentInterimLanguagePair = null;
    this.entryCounter = 0;
  }

  /**
   * Get the number of entries
   */
  getEntryCount(): number {
    return this.entryOrder.length;
  }

}