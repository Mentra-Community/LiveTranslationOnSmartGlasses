/**
 * Formatting utility functions
 */

/**
 * Format a timestamp (milliseconds) to a human-readable date
 */
export const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
};

/**
 * Format seconds to HH:MM:SS
 */
export const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  // Add leading zeros
  const hh = h.toString().padStart(2, '0');
  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');
  
  if (h > 0) {
    return `${hh}:${mm}:${ss}`;
  } else {
    return `${mm}:${ss}`;
  }
};

/**
 * Format text for display (truncate if too long)
 */
export const formatText = (text: string, maxLength = 100): string => {
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength) + '...';
};

/**
 * Extract first few sentences from text for a summary
 */
export const extractSummary = (text: string, sentenceCount = 2): string => {
  if (!text) return '';
  
  // Split by sentence-ending punctuation and keep the punctuation
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  
  // Return the first N sentences or the entire text if fewer
  return sentences.slice(0, sentenceCount).join(' ').trim();
};