/**
 * Simple storage utilities for the webview
 */

/**
 * Save the translation history to local storage
 */
export const saveTranslationHistory = (history: any[]): void => {
  try {
    localStorage.setItem('translation_history', JSON.stringify(history));
  } catch (error) {
    console.error('Error saving translation history:', error);
  }
};

/**
 * Load the translation history from local storage
 */
export const loadTranslationHistory = (): any[] => {
  try {
    const history = localStorage.getItem('translation_history');
    return history ? JSON.parse(history) : [];
  } catch (error) {
    console.error('Error loading translation history:', error);
    return [];
  }
};