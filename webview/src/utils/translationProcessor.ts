import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Language {
  code: string;
  name: string;
}

interface Model {
  id: string;
  languages: Language[];
  name: string;
  transcription_mode: string;
  translation_targets: any[];
  two_way_translation_pairs: string[];
}

interface SonioxMappings {
  models: Model[];
}

interface LanguageOutput {
  [sourceCode: string]: {
    source_language: {
      [code: string]: string;
    };
    supported_target_languages: {
      [code: string]: string;
    }[];
  };
}

function processTranslationMappings(): void {
  const mappingsPath = path.join(__dirname, '../soniox/SonioxTranslationMappings.json');
  const outputPath = path.join(__dirname, '../soniox/Languages.json');
  
  try {
    const mappingsData: SonioxMappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));
    
    // Get the real-time model data
    const rtModel = mappingsData.models.find(model => model.id === 'stt-rt-preview');
    if (!rtModel) {
      throw new Error('Real-time model not found');
    }
    
    // Create language code to name mapping
    const languageMap: { [code: string]: string } = {};
    rtModel.languages.forEach(lang => {
      languageMap[lang.code] = lang.name;
    });
    
    // Process two-way translation pairs
    const languageSupport: LanguageOutput = {};
    
    // Initialize all languages as potential sources
    rtModel.languages.forEach(lang => {
      languageSupport[lang.code] = {
        source_language: {
          [lang.code]: lang.name.toLowerCase()
        },
        supported_target_languages: []
      };
    });
    
    // Process each translation pair
    rtModel.two_way_translation_pairs.forEach(pair => {
      const [source, target] = pair.split(':');
      
      // Add target language to source language's supported targets
      if (languageSupport[source] && languageMap[target]) {
        const targetExists = languageSupport[source].supported_target_languages.some(
          targetLang => Object.keys(targetLang)[0] === target
        );
        
        if (!targetExists) {
          languageSupport[source].supported_target_languages.push({
            [target]: languageMap[target].toLowerCase()
          });
        }
      }
    });
    
    // Sort supported target languages alphabetically by language name
    Object.keys(languageSupport).forEach(sourceCode => {
      languageSupport[sourceCode].supported_target_languages.sort((a, b) => {
        const nameA = Object.values(a)[0];
        const nameB = Object.values(b)[0];
        return nameA.localeCompare(nameB);
      });
    });
    
    // Write the output file
    fs.writeFileSync(outputPath, JSON.stringify(languageSupport, null, 2), 'utf8');
    
    console.log(`Successfully processed ${Object.keys(languageSupport).length} languages`);
    console.log(`Output written to: ${outputPath}`);
    
    // Log some statistics
    const stats = Object.entries(languageSupport).map(([code, data]) => ({
      code,
      name: Object.values(data.source_language)[0],
      targetCount: data.supported_target_languages.length
    }));
    
    console.log('\nLanguage support summary:');
    stats.forEach(stat => {
      console.log(`${stat.code} (${stat.name}): ${stat.targetCount} target languages`);
    });
    
  } catch (error) {
    console.error('Error processing translation mappings:', error);
    process.exit(1);
  }
}

// Run the processor
processTranslationMappings();