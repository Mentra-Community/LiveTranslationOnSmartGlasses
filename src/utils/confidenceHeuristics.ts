export type ConfidenceHeuristic = 'None' | 'WordStability' | 'PrefixRetention' | 'EditDistance' | 'WordDuration' | 'TrailingWordDecay' | 'Hybrid';

interface WordDetail {
  word: string;
  normalizedWord: string; // For fuzzy matching
  stableCount: number;
  firstSeen: number;
  lastSeen: number;
  bestPosition: number; // Track the most stable position
  positionHistory: number[]; // Track position changes
}

// Basic Levenshtein distance implementation
function levenshteinDistance(s1: string, s2: string): number {
  const track = Array(s2.length + 1).fill(null).map(() =>
    Array(s1.length + 1).fill(null));
  for (let i = 0; i <= s1.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= s2.length; j += 1) {
    track[j][0] = j;
  }
  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator, // substitution
      );
    }
  }
  return track[s2.length][s1.length];
}

export class ConfidenceCalculator {
  private previousTranscript: string = '';
  private previousWords: string[] = [];
  private wordStabilityBuffer: WordDetail[] = [];
  private transcriptHistory: { text: string; timestamp: number }[] = [];
  private lastInterimLength: number = 0; // Track length of last interim transcript
  private lastShownConfidentPrefix: string = ''; // Track last shown confident prefix to prevent shrinking

  constructor() {}

  public resetState(): void {
    this.previousTranscript = '';
    this.previousWords = [];
    this.wordStabilityBuffer = [];
    this.transcriptHistory = [];
    this.lastInterimLength = 0;
    this.lastShownConfidentPrefix = '';
  }

  /**
   * Reset only the interim tracking (called after final transcripts)
   */
  public resetInterimTracking(): void {
    this.lastInterimLength = 0;
    this.lastShownConfidentPrefix = '';
  }

  /**
   * Check if an interim transcript should be accepted (not shorter than previous)
   */
  public shouldAcceptInterim(currentTranscript: string, isFinal: boolean): boolean {
    if (isFinal) {
      // Final transcripts are always accepted and reset the length tracking
      this.resetInterimTracking();
      return true;
    }
    
    const currentLength = this.splitWords(currentTranscript, false).length;
    if (currentLength >= this.lastInterimLength) {
      this.lastInterimLength = currentLength;
      return true;
    }
    
    // Reject shorter interim transcripts
    return false;
  }

  /**
   * Main entry point for confidence calculation.
   * @param currentTranscript The current interim transcript string
   * @param isHanzi If true, treat each character as a word (for Hanzi/Chinese/Japanese)
   * @param heuristic The confidence heuristic to use
   */
  public calculateConfidence(currentTranscript: string, isHanzi: boolean = false, heuristic: ConfidenceHeuristic = 'None'): number | null {
    if (heuristic === 'None') {
      return null;
    }

    const currentTime = Date.now();
    this.transcriptHistory.push({ text: currentTranscript, timestamp: currentTime });
    if (this.transcriptHistory.length > 20) { // Keep history limited
        this.transcriptHistory.shift();
    }

    let score: number | null = null;

    switch (heuristic) {
      case 'WordStability':
        score = this.calculateWordStability(currentTranscript, isHanzi);
        break;
      case 'PrefixRetention':
        score = this.calculatePrefixRetention(currentTranscript, isHanzi);
        break;
      case 'EditDistance':
        score = this.calculateEditDistanceConfidence(currentTranscript, isHanzi);
        break;
      case 'WordDuration':
        score = this.calculateWordDuration(currentTranscript, currentTime, isHanzi);
        break;
      case 'TrailingWordDecay':
        score = this.calculateTrailingWordDecay(currentTranscript, isHanzi);
        break;
      case 'Hybrid':
        score = this.calculateHybridScore(currentTranscript, currentTime, isHanzi);
        break;
    }

    this.previousTranscript = currentTranscript;
    this.previousWords = this.splitWords(currentTranscript, isHanzi);
    return score;
  }

  /**
   * Utility to split transcript into words or characters depending on isHanzi.
   */
  private splitWords(text: string, isHanzi: boolean): string[] {
    if (isHanzi) {
      // Split into array of characters, filter out whitespace
      return text.split('').filter(c => c.trim().length > 0);
    } else {
      return text.split(/\s+/);
    }
  }

  /**
   * Normalize a word for fuzzy matching (remove punctuation, lowercase)
   */
  private normalizeWord(word: string): string {
    return word.toLowerCase().replace(/[^\w\s]/g, '').trim();
  }

  /**
   * Calculate similarity between two words (0-1, where 1 is identical)
   */
  private wordSimilarity(word1: string, word2: string): number {
    const norm1 = this.normalizeWord(word1);
    const norm2 = this.normalizeWord(word2);
    
    if (norm1 === norm2) return 1.0;
    if (norm1.length === 0 || norm2.length === 0) return 0.0;
    
    // Simple similarity: longer common prefix + suffix
    let prefixLen = 0;
    let suffixLen = 0;
    const minLen = Math.min(norm1.length, norm2.length);
    
    // Count common prefix
    for (let i = 0; i < minLen; i++) {
      if (norm1[i] === norm2[i]) prefixLen++;
      else break;
    }
    
    // Count common suffix (if not overlapping with prefix)
    for (let i = 1; i <= minLen - prefixLen; i++) {
      if (norm1[norm1.length - i] === norm2[norm2.length - i]) suffixLen++;
      else break;
    }
    
    const commonChars = prefixLen + suffixLen;
    const maxLen = Math.max(norm1.length, norm2.length);
    return commonChars / maxLen;
  }

  /**
   * Find the best matching word in the buffer for a given word and position
   */
  private findBestMatch(word: string, position: number, currentWords: string[]): WordDetail | null {
    const normalizedWord = this.normalizeWord(word);
    let bestMatch: WordDetail | null = null;
    let bestScore = 0;
    
    for (const detail of this.wordStabilityBuffer) {
      // Calculate position penalty (prefer words close to expected position)
      const positionPenalty = Math.abs(detail.bestPosition - position) / Math.max(currentWords.length, 1);
      const maxPositionPenalty = 0.3; // Max 30% penalty for position mismatch
      const positionScore = Math.max(0, 1 - Math.min(positionPenalty, maxPositionPenalty));
      
      // Calculate word similarity
      const wordScore = this.wordSimilarity(word, detail.word);
      
      // Combined score (70% word similarity, 30% position)
      const combinedScore = (0.7 * wordScore) + (0.3 * positionScore);
      
      // Require minimum similarity threshold
      if (combinedScore > bestScore && wordScore >= 0.8) {
        bestScore = combinedScore;
        bestMatch = detail;
      }
    }
    
    return bestMatch;
  }

  /**
   * Word Stability Heuristic (Enhanced with Decay)
   * Measures: For each word, how stable it has been across updates, with fuzzy matching and position flexibility.
   * How: Uses similarity matching and position tracking to handle insertions, deletions, and minor variations.
   * Includes decay for absent words instead of immediate removal.
   * Best for: Robust word-level confidence that handles real-world ASR instability and oscillations.
   */
  private calculateWordStability(currentTranscript: string, isHanzi: boolean = false): number {
    const currentWords = this.splitWords(currentTranscript, isHanzi);
    if (currentWords.length === 0) return 0;
    
    const currentTime = Date.now();
    const decayTime = 2000; // 2 seconds before decay starts
    
    // First, decay absent words instead of removing them
    for (const detail of this.wordStabilityBuffer) {
      const timeSinceLastSeen = currentTime - detail.lastSeen;
      if (timeSinceLastSeen > decayTime) {
        // Gradually reduce stability for absent words
        const decayFactor = Math.max(0.1, 1 - (timeSinceLastSeen - decayTime) / 5000); // 5s to decay to 10%
        detail.stableCount = Math.max(1, detail.stableCount * decayFactor);
      }
    }
    
    const newWordStabilityBuffer: WordDetail[] = [];
    let totalStabilityScore = 0;
    
    // Process each current word
    for (let i = 0; i < currentWords.length; i++) {
      const word = currentWords[i];
      const normalizedWord = this.normalizeWord(word);
      
      // Find best matching word from previous buffer
      const bestMatch = this.findBestMatch(word, i, currentWords);
      
      if (bestMatch) {
        // Update existing word detail
        const updatedDetail: WordDetail = {
          word: word, // Update to current form
          normalizedWord: normalizedWord,
          stableCount: bestMatch.stableCount + 1,
          firstSeen: bestMatch.firstSeen,
          lastSeen: currentTime,
          bestPosition: i, // Update best position
          positionHistory: [...bestMatch.positionHistory.slice(-5), i] // Keep last 5 positions
        };
        
        newWordStabilityBuffer.push(updatedDetail);
        
        // Calculate stability score for this word
        const stabilityFactor = Math.min(1, updatedDetail.stableCount / 3); // 3+ updates = fully stable
        const positionConsistency = this.calculatePositionConsistency(updatedDetail.positionHistory);
        const wordStabilityScore = stabilityFactor * positionConsistency;
        
        totalStabilityScore += wordStabilityScore;
      } else {
        // New word
        const newDetail: WordDetail = {
          word: word,
          normalizedWord: normalizedWord,
          stableCount: 1,
          firstSeen: currentTime,
          lastSeen: currentTime,
          bestPosition: i,
          positionHistory: [i]
        };
        
        newWordStabilityBuffer.push(newDetail);
        
        // New words get low stability score
        totalStabilityScore += 0.2; // 20% confidence for new words
      }
    }
    
    // Keep decayed words that weren't matched (for potential future matches)
    for (const oldDetail of this.wordStabilityBuffer) {
      const wasMatched = newWordStabilityBuffer.some(newDetail => 
        this.wordSimilarity(oldDetail.word, newDetail.word) > 0.8
      );
      if (!wasMatched && oldDetail.stableCount > 0.5) {
        // Keep decayed word in buffer for potential future matching
        newWordStabilityBuffer.push({
          ...oldDetail,
          lastSeen: oldDetail.lastSeen // Don't update lastSeen for absent words
        });
      }
    }
    
    // Update the buffer
    this.wordStabilityBuffer = newWordStabilityBuffer;
    
    // Return average stability score
    return totalStabilityScore / currentWords.length;
  }

  /**
   * Calculate how consistent a word's position has been
   */
  private calculatePositionConsistency(positionHistory: number[]): number {
    if (positionHistory.length <= 1) return 1.0;
    
    // Calculate variance in positions
    const mean = positionHistory.reduce((sum, pos) => sum + pos, 0) / positionHistory.length;
    const variance = positionHistory.reduce((sum, pos) => sum + Math.pow(pos - mean, 2), 0) / positionHistory.length;
    const stdDev = Math.sqrt(variance);
    
    // Convert to consistency score (lower variance = higher consistency)
    // Allow up to 2 positions of variance before penalizing
    const maxAllowedStdDev = 2;
    return Math.max(0, 1 - (stdDev / maxAllowedStdDev));
  }

  /**
   * Prefix Retention Heuristic
   * Measures: How much of the beginning (prefix) of the transcript remains unchanged between updates.
   * How: Compares the current and previous transcript character by character from the start, counting the length of the matching prefix.
   * Best for: Determining the stable, high-confidence region at the start of the transcript, ideal for AR captions where the beginning is most visible.
   */
  private calculatePrefixRetention(currentTranscript: string, isHanzi: boolean = false): number {
    if (!this.previousTranscript) return 0;
    let retainedLength = 0;
    if (isHanzi) {
      // Compare by character
      const currChars = this.splitWords(currentTranscript, true);
      const prevChars = this.splitWords(this.previousTranscript, true);
      const minLen = Math.min(currChars.length, prevChars.length);
      for (let i = 0; i < minLen; i++) {
        if (currChars[i] === prevChars[i]) {
          retainedLength++;
        } else {
          break;
        }
      }
      return currChars.length > 0 ? retainedLength / currChars.length : 0;
    } else {
      // Default: character-based prefix retention
      const minLen = Math.min(currentTranscript.length, this.previousTranscript.length);
      for (let i = 0; i < minLen; i++) {
        if (currentTranscript[i] === this.previousTranscript[i]) {
          retainedLength++;
        } else {
          break;
        }
      }
      return currentTranscript.length > 0 ? retainedLength / currentTranscript.length : 0;
    }
  }

  /**
   * Edit Distance Heuristic
   * Measures: The overall volatility of the transcript between updates.
   * How: Computes the normalized Levenshtein (edit) distance between the current and previous transcript. Lower change = higher confidence.
   * Best for: Quantifying how much the transcript is changing as a whole, useful for gating display or triggering UI updates only when stable.
   */
  private calculateEditDistanceConfidence(currentTranscript: string, isHanzi: boolean = false): number {
    if (!this.previousTranscript) return 0;
    if (isHanzi) {
      // Use character arrays for Hanzi
      const currChars = this.splitWords(currentTranscript, true).join('');
      const prevChars = this.splitWords(this.previousTranscript, true).join('');
      const distance = levenshteinDistance(currChars, prevChars);
      const maxLength = Math.max(currChars.length, prevChars.length, 1);
      return 1 - (distance / maxLength);
    } else {
      const distance = levenshteinDistance(currentTranscript, this.previousTranscript);
      const maxLength = Math.max(currentTranscript.length, this.previousTranscript.length, 1);
      return 1 - (distance / maxLength);
    }
  }

  /**
   * Word Duration Heuristic
   * Measures: How long each word has remained stable in the transcript.
   * How: Tracks timestamps for when each word first appeared and was last seen unchanged. The score is the average duration (weighted by stability) that words have persisted.
   * Best for: Smoothing confidence over time, and for visualizations that fade in or highlight words as they become more reliable.
   */
  private calculateWordDuration(currentTranscript: string, currentTime: number, isHanzi: boolean = false): number {
    const currentWords = this.splitWords(currentTranscript, isHanzi);
    if (currentWords.length === 0) return 0;

    let totalWeightedDuration = 0;

    const updatedBuffer: WordDetail[] = [];

    currentWords.forEach((word, index) => {
        const bestMatch = this.findBestMatch(word, index, currentWords);
        let detail: WordDetail;
        if (bestMatch) {
            detail = { 
                ...bestMatch, 
                word: word,
                normalizedWord: this.normalizeWord(word),
                lastSeen: currentTime, 
                stableCount: bestMatch.stableCount + 1,
                bestPosition: index,
                positionHistory: [...bestMatch.positionHistory.slice(-5), index]
            }; 
        } else {
            detail = { 
                word, 
                normalizedWord: this.normalizeWord(word),
                stableCount: 1, 
                firstSeen: currentTime, 
                lastSeen: currentTime,
                bestPosition: index,
                positionHistory: [index]
            };
        }
        updatedBuffer.push(detail);
        const duration = (detail.lastSeen - detail.firstSeen) / 1000; // in seconds
        totalWeightedDuration += duration * detail.stableCount; // Weight by stability
    });
    
    this.wordStabilityBuffer = updatedBuffer;
    // Normalize: sum of (duration * stability) / (max_possible_duration * total_words * max_stability_count)
    // This is a simplified normalization, might need refinement based on observed values.
    // For now, let's use average duration weighted by stability.
    const averageDurationScore = this.wordStabilityBuffer.reduce((acc, detail) => acc + (detail.lastSeen - detail.firstSeen) * detail.stableCount, 0);
    const totalStability = this.wordStabilityBuffer.reduce((acc, detail) => acc + detail.stableCount, 0);
    
    if (totalStability === 0) return 0;
    // The score is an average weighted duration in ms, capped at 1 (e.g. 1000ms for 1s)
    return Math.min(1, (averageDurationScore / totalStability) / 1000); 
  }

  /**
   * Trailing Word Decay Heuristic
   * Measures: Confidence based on a word's position from the end of the transcript (words at the end are less reliable).
   * How: Assigns higher confidence to words closer to the start, decaying toward the end. The score is the average position-based weight.
   * Best for: Visually de-emphasizing or fading out the trailing, unstable part of interim transcripts, matching typical ASR behavior.
   */
  private calculateTrailingWordDecay(currentTranscript: string, isHanzi: boolean = false): number {
    const words = this.splitWords(currentTranscript, isHanzi);
    if (words.length === 0) return 0;
    let score = 0;
    words.forEach((word, index) => {
      score += (index + 1) / words.length; // Weight words closer to start more
    });
    return words.length > 0 ? score / words.length : 0;
  }

  /**
   * Hybrid Heuristic
   * Measures: A weighted combination of the above heuristics for a more robust confidence estimate.
   * How: Combines word stability, prefix retention, edit distance, and trailing word decay with tunable weights.
   * Best for: General-purpose confidence scoring when you want to balance stability, prefix trust, and overall volatility.
   */
  private calculateHybridScore(currentTranscript: string, currentTime: number, isHanzi: boolean = false): number {
    const wordStabilityScore = this.calculateWordStability(currentTranscript, isHanzi);
    const prefixRetentionScore = this.calculatePrefixRetention(currentTranscript, isHanzi);
    const editDistanceScore = this.calculateEditDistanceConfidence(currentTranscript, isHanzi);
    const positionFromEndWeight = this.calculateTrailingWordDecay(currentTranscript, isHanzi);
    // Word duration could be added with a weight if desired
    const finalScore = (
      0.4 * wordStabilityScore +
      0.3 * prefixRetentionScore +
      0.2 * editDistanceScore +
      0.1 * positionFromEndWeight
    );
    return Math.max(0, Math.min(1, finalScore)); // Clamp between 0 and 1
  }

  /**
   * Returns the longest prefix of words/characters in the current transcript
   * where each is above the given confidence threshold (using Word Stability).
   * @param currentTranscript The current interim transcript string
   * @param threshold Confidence threshold (0-1)
   * @param isHanzi If true, treat each character as a word
   * @param heuristic The confidence heuristic to use (should be 'WordStability' for best results)
   * @returns The confident prefix as a string
   */
  public getConfidentPrefix(currentTranscript: string, threshold: number, isHanzi: boolean = false, heuristic: ConfidenceHeuristic = 'WordStability'): string {
    const currentWords = this.splitWords(currentTranscript, isHanzi);
    const confidentWords: string[] = [];
    for (let index = 0; index < currentWords.length; index++) {
      const word = currentWords[index];
      // Find the matching word in the current buffer (read-only)
      const bestMatch = this.findBestMatchReadOnly(word, index, currentWords);
      let confidence = 0.2; // Default for new words
      
      if (bestMatch) {
        const stabilityFactor = Math.min(1, bestMatch.stableCount / 3);
        const positionConsistency = this.calculatePositionConsistency(bestMatch.positionHistory);
        confidence = stabilityFactor * positionConsistency;
      }
      
      if (confidence >= threshold) {
        confidentWords.push(word);
      } else {
        break; // Stop at the first non-confident word (prefix only)
      }
    }
    // Join with space for non-Hanzi, or no space for Hanzi
    return isHanzi ? confidentWords.join('') : confidentWords.join(' ');
  }

  /**
   * Find the best matching word in the buffer (read-only version for getConfidentPrefix)
   */
  private findBestMatchReadOnly(word: string, position: number, currentWords: string[]): WordDetail | null {
    const normalizedWord = this.normalizeWord(word);
    let bestMatch: WordDetail | null = null;
    let bestScore = 0;
    
    for (const detail of this.wordStabilityBuffer) {
      // Calculate position penalty (prefer words close to expected position)
      const positionPenalty = Math.abs(detail.bestPosition - position) / Math.max(currentWords.length, 1);
      const maxPositionPenalty = 0.3; // Max 30% penalty for position mismatch
      const positionScore = Math.max(0, 1 - Math.min(positionPenalty, maxPositionPenalty));
      
      // Calculate word similarity
      const wordScore = this.wordSimilarity(word, detail.word);
      
      // Combined score (70% word similarity, 30% position)
      const combinedScore = (0.7 * wordScore) + (0.3 * positionScore);
      
      // Require minimum similarity threshold
      if (combinedScore > bestScore && wordScore >= 0.8) {
        bestScore = combinedScore;
        bestMatch = detail;
      }
    }
    
    return bestMatch;
  }

  /**
   * Get confident prefix that never shrinks compared to previous interim
   */
  public getNonShrinkingConfidentPrefix(currentTranscript: string, threshold: number, isHanzi: boolean = false, heuristic: ConfidenceHeuristic = 'WordStability'): string {
    const newConfidentPrefix = this.getConfidentPrefix(currentTranscript, threshold, isHanzi, heuristic);
    
    // Count words/characters in both prefixes
    const newPrefixLength = this.splitWords(newConfidentPrefix, isHanzi).length;
    const lastPrefixLength = this.splitWords(this.lastShownConfidentPrefix, isHanzi).length;
    
    // Only update if new prefix is longer or equal
    if (newPrefixLength >= lastPrefixLength) {
      this.lastShownConfidentPrefix = newConfidentPrefix;
      return newConfidentPrefix;
    } else {
      // Keep the previous longer prefix
      return this.lastShownConfidentPrefix;
    }
  }
} 