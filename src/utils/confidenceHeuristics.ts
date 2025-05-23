export type ConfidenceHeuristic = 'None' | 'WordStability' | 'PrefixRetention' | 'EditDistance' | 'WordDuration' | 'TrailingWordDecay' | 'Hybrid';

interface WordDetail {
  word: string;
  stableCount: number;
  firstSeen: number;
  lastSeen: number;
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
  private heuristic: ConfidenceHeuristic = 'None';
  private previousTranscript: string = '';
  private previousWords: string[] = [];
  private wordStabilityBuffer: WordDetail[] = [];
  private transcriptHistory: { text: string; timestamp: number }[] = [];

  constructor(initialHeuristic: ConfidenceHeuristic = 'None') {
    this.heuristic = initialHeuristic;
  }

  public setHeuristic(heuristic: ConfidenceHeuristic): void {
    this.heuristic = heuristic;
    this.resetState(); // Reset state when heuristic changes
  }

  public resetState(): void {
    this.previousTranscript = '';
    this.previousWords = [];
    this.wordStabilityBuffer = [];
    this.transcriptHistory = [];
  }

  /**
   * Main entry point for confidence calculation.
   * @param currentTranscript The current interim transcript string
   * @param isHanzi If true, treat each character as a word (for Hanzi/Chinese/Japanese)
   */
  public calculateConfidence(currentTranscript: string, isHanzi: boolean = false): number | null {
    if (this.heuristic === 'None') {
      return null;
    }

    const currentTime = Date.now();
    this.transcriptHistory.push({ text: currentTranscript, timestamp: currentTime });
    if (this.transcriptHistory.length > 20) { // Keep history limited
        this.transcriptHistory.shift();
    }

    let score: number | null = null;

    switch (this.heuristic) {
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
   * Word Stability Heuristic
   * Measures: For each word, how many consecutive updates it has appeared in the same position.
   * How: Tracks a buffer of words and their stability counts. The score is the fraction of words that are stable (unchanged from previous update).
   * Best for: Highlighting which words in the interim transcript are most reliable, especially for word-level confidence visualization.
   */
  private calculateWordStability(currentTranscript: string, isHanzi: boolean = false): number {
    const currentWords = this.splitWords(currentTranscript, isHanzi);
    let stableWords = 0;
    const newWordStabilityBuffer: WordDetail[] = [];

    currentWords.forEach((word, index) => {
      const prevDetail = this.wordStabilityBuffer.find(detail => detail.word === word && this.previousWords[index] === word);
      if (prevDetail) {
        newWordStabilityBuffer.push({ ...prevDetail, stableCount: prevDetail.stableCount + 1, lastSeen: Date.now() });
        stableWords++;
      } else {
        newWordStabilityBuffer.push({ word, stableCount: 1, firstSeen: Date.now(), lastSeen: Date.now() });
      }
    });
    this.wordStabilityBuffer = newWordStabilityBuffer;
    return currentWords.length > 0 ? stableWords / currentWords.length : 0;
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
        let detail = this.wordStabilityBuffer.find(d => d.word === word && this.previousWords[index] === word);
        if (detail) {
            detail = { ...detail, lastSeen: currentTime, stableCount: detail.stableCount + 1 }; 
        } else {
            detail = { word, stableCount: 1, firstSeen: currentTime, lastSeen: currentTime };
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
} 