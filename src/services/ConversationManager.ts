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
   */
  addTranslation(
    originalText: string,
    translatedText: string,
    originalLanguage: string,
    translatedLanguage: string,
    isFinal: boolean
  ): TranslationEntry | null {
    let entry: TranslationEntry;

    if (!isFinal && this.currentInterimId) {
      // Update existing interim entry
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
    } else if (isFinal && this.currentInterimId) {
      // Convert interim to final
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
    } else {
      // Create new entry
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
      }

      // Maintain max entries limit
      if (this.entryOrder.length > this.maxEntries) {
        const oldestId = this.entryOrder.shift();
        if (oldestId) {
          this.entries.delete(oldestId);
        }
      }
    }

    return entry;
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
    this.entryCounter = 0;
  }

  /**
   * Get the number of entries
   */
  getEntryCount(): number {
    return this.entryOrder.length;
  }

}