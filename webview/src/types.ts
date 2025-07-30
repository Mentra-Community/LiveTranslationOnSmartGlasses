/**
 * Represents a translation entry in the transcript
 */
export interface TranslationEntry {
  id: string;
  timestamp: number;
  originalText: string;
  translatedText: string;
  originalLanguage: string;
  translatedLanguage: string;
  isFinal: boolean;
  isNewUtterance?: boolean; // Optional flag from server to indicate if this is a new utterance
}

/**
 * Represents a language pair for translation
 */
export interface LanguagePair {
  from: string;
  to: string;
}