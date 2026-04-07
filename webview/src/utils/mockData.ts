/**
 * Mock data utilities for development testing
 */
import { TranslationEntry } from '../types';

/**
 * Generate mock translation entries for testing
 */
export const generateMockTranslations = (): TranslationEntry[] => {
  return [
    {
      id: '1',
      timestamp: Date.now() - 180000, // 3 minutes ago
      originalText: 'Hello, my name is Sarah. Nice to meet you.',
      translatedText: '你好，我叫莎拉。很高兴见到你。',
      originalLanguage: 'English',
      translatedLanguage: 'Chinese (Hanzi)',
      isFinal: true
    },
    {
      id: '2',
      timestamp: Date.now() - 165000, // 2.75 minutes ago
      originalText: '你好，我叫李明。认识你我也很高兴。',
      translatedText: 'Hello, my name is Li Ming. I\'m also happy to meet you.',
      originalLanguage: 'Chinese (Hanzi)',
      translatedLanguage: 'English',
      isFinal: true
    },
    {
      id: '3',
      timestamp: Date.now() - 150000, // 2.5 minutes ago
      originalText: 'I\'m visiting from the United States. Is this your first time using this translation technology?',
      translatedText: '我是从美国来访的。这是你第一次使用这种翻译技术吗？',
      originalLanguage: 'English',
      translatedLanguage: 'Chinese (Hanzi)',
      isFinal: true
    },
    {
      id: '4',
      timestamp: Date.now() - 135000, // 2.25 minutes ago
      originalText: '是的，这是我第一次使用。效果很好，让沟通变得容易了。你来中国旅游多久了？',
      translatedText: 'Yes, this is my first time using it. It works very well and makes communication easier. How long have you been traveling in China?',
      originalLanguage: 'Chinese (Hanzi)',
      translatedLanguage: 'English',
      isFinal: true
    },
    {
      id: '5',
      timestamp: Date.now() - 120000, // 2 minutes ago
      originalText: 'I arrived last week. I\'m here for a business conference but also wanted to do some sightseeing. Could you recommend any good local restaurants?',
      translatedText: '我上周到的。我是来参加商务会议的，但也想观光一下。你能推荐一些好的当地餐馆吗？',
      originalLanguage: 'English',
      translatedLanguage: 'Chinese (Hanzi)',
      isFinal: true
    }
  ];
};

/**
 * Simulate a stream of translation events
 * @param callback Function to call with each entry
 * @param intervalMs Delay between entries
 */
export const simulateTranslationStream = (
  callback: (entry: TranslationEntry) => void,
  intervalMs: number = 5000
): () => void => {
  const mockData = generateMockTranslations();
  let index = 0;
  let subIndex = 0;
  
  // For each entry in mockData, create 3-5 partial updates before the final version
  const interval = setInterval(() => {
    if (index < mockData.length) {
      // Get the current mock entry
      const currentMock = mockData[index];
      
      // Update timestamp to create a realistic sequence
      const timestamp = Date.now();
      
      // Determine if this is a partial or final update
      if (subIndex < 3) { // Generate 3 partials before the final
        // Create a partial update by truncating the text
        const originalText = currentMock.originalText.substring(0, 
          Math.floor((subIndex + 1) * currentMock.originalText.length / 4));
        const translatedText = currentMock.translatedText.substring(0, 
          Math.floor((subIndex + 1) * currentMock.translatedText.length / 4));
        
        // Create partial entry
        const entry = {
          ...currentMock,
          id: `${currentMock.id}-partial-${subIndex}`,
          timestamp,
          originalText,
          translatedText,
          isFinal: false // Mark as not final
        };
        
        callback(entry);
        subIndex++;
      } else {
        // Send the final version
        const entry = {
          ...currentMock,
          timestamp,
          isFinal: true // Mark as final
        };
        
        callback(entry);
        
        // Move to the next entry
        index++;
        subIndex = 0;
      }
    } else {
      // Start over with new entries
      index = 0;
      subIndex = 0;
    }
  }, intervalMs);
  
  // Return function to stop the simulation
  return () => clearInterval(interval);
};