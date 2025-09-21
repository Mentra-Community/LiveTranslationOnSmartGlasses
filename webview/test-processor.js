import { processTranslationFile } from './src/utils/translationProcessor.ts';

// Test the processor with the Soniox mappings file
try {
  const result = processTranslationFile('./src/soniox/SonioxTranslationMappings.json');
  console.log('\n✅ Test completed successfully!');
  console.log('Sample output structure:');
  console.log('- Translation configs:', result.length);
  if (result[0]) {
    console.log('- First config source languages count:', Object.keys(result[0].source_languages).length);
    console.log('- First config target languages count:', result[0].sup_target_languages.length);
    console.log('- First config excluded languages count:', result[0].exclude_source_languages.length);
  }
} catch (error) {
  console.error('❌ Test failed:', error.message);
}