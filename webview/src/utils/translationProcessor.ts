import fs from 'fs';

// Types for the original Soniox format
interface SonioxLanguage {
  code: string;
  name: string;
}

interface SonioxTranslationTarget {
  exclude_source_languages: string[];
  source_languages: string[];
  target_language: string;
}

interface SonioxModel {
  id: string;
  languages: SonioxLanguage[];
  name: string;
  transcription_mode: string;
  translation_targets: SonioxTranslationTarget[];
  two_way_translation_pairs: string[];
}

interface SonioxMappingsInput {
  models: SonioxModel[];
}

// Types for the reformatted output
interface TranslationConfig {
  source_language: Record<string, string>;
  sup_target_languages: Record<string, string>[];
  exclude_source_languages: string[];
}

type ReformattedMappings = TranslationConfig[];

/**
 * Reformats Soniox translation mappings into a cleaner, more readable structure
 * @param inputData - The original Soniox mappings data
 * @returns Reformatted translation mappings
 */
export function reformatTranslationMappings(inputData: SonioxMappingsInput): ReformattedMappings {
  if (!inputData.models || !Array.isArray(inputData.models)) {
    throw new Error('Invalid input format: expected models array');
  }

  const translationConfigs: TranslationConfig[] = [];

  // Process each model to extract source->target mappings
  inputData.models.forEach(model => {
    if (!model.translation_targets || !model.languages) return;

    // Group translation targets by source language
    const sourceToTargetsMap = new Map<string, Set<string>>();
    
    model.translation_targets.forEach(target => {
      target.source_languages.forEach(sourceCode => {
        if (sourceCode === '*') {
          // Handle wildcard - add all languages except excluded ones as sources
          model.languages.forEach(lang => {
            if (!target.exclude_source_languages.includes(lang.code)) {
              if (!sourceToTargetsMap.has(lang.code)) {
                sourceToTargetsMap.set(lang.code, new Set());
              }
              sourceToTargetsMap.get(lang.code)!.add(target.target_language);
            }
          });
        } else {
          // Handle specific source language
          if (!sourceToTargetsMap.has(sourceCode)) {
            sourceToTargetsMap.set(sourceCode, new Set());
          }
          sourceToTargetsMap.get(sourceCode)!.add(target.target_language);
        }
      });
    });

    // Create a config for each source language
    sourceToTargetsMap.forEach((targetCodes, sourceCode) => {
      const sourceLangInfo = model.languages.find(lang => lang.code === sourceCode);
      if (!sourceLangInfo) return;

      // Create source_languages with just this one language
      const sourceLanguages: Record<string, string> = {
        [sourceCode]: sourceLangInfo.name.toLowerCase()
      };

      // Create sup_target_languages array
      const supTargetLanguages: Record<string, string>[] = [];
      targetCodes.forEach(targetCode => {
        const targetLangInfo = model.languages.find(lang => lang.code === targetCode);
        if (targetLangInfo) {
          const langObj: Record<string, string> = {};
          langObj[targetCode] = targetLangInfo.name.toLowerCase();
          supTargetLanguages.push(langObj);
        }
      });

      // Get exclude_source_languages for this specific source
      let excludeSourceLanguages: string[] = [];
      const relevantTarget = model.translation_targets.find(target => 
        target.source_languages.includes(sourceCode) && target.exclude_source_languages?.length > 0
      );
      if (relevantTarget) {
        excludeSourceLanguages = relevantTarget.exclude_source_languages;
      }

      translationConfigs.push({
        source_language: sourceLanguages,
        sup_target_languages: supTargetLanguages,
        exclude_source_languages: excludeSourceLanguages
      });
    });
  });

  return translationConfigs;
}

/**
 * Processes a JSON file and reformats it according to the new structure
 * @param inputFilePath - Path to the input JSON file
 * @param outputFilePath - Optional path for output file (defaults to input_reformatted.json)
 * @returns The reformatted data
 */
export function processTranslationFile(inputFilePath: string, outputFilePath?: string): ReformattedMappings {
  try {
    // Read the input JSON file
    const inputData: SonioxMappingsInput = JSON.parse(fs.readFileSync(inputFilePath, 'utf8'));
    
    // Reformat the data
    const reformattedData = reformatTranslationMappings(inputData);
    
    // Determine output file path
    const outputPath = outputFilePath || inputFilePath.replace(/\.json$/, '_reformatted.json');
    
    // Write the reformatted JSON to output file
    fs.writeFileSync(outputPath, JSON.stringify(reformattedData, null, 2), 'utf8');
    
    console.log(` Successfully reformatted translation mappings:`);
    console.log(`   Input:  ${inputFilePath}`);
    console.log(`   Output: ${outputPath}`);
    console.log(`   Translation configs generated: ${reformattedData.length}`);
    
    return reformattedData;

  } catch (error) {
    console.error('L Error processing translation mappings:', (error as Error).message);
    throw error;
  }
}

/**
 * Gets available source languages for a specific config index
 * @param mappings - The reformatted mappings data
 * @param configIndex - The config index to get languages for (0, 1, etc.)
 * @returns Object with language codes and names
 */
export function getSourceLanguages(mappings: ReformattedMappings, configIndex: number): Record<string, string> | null {
  const config = mappings[configIndex];
  return config ? config.source_language : null;
}

/**
 * Gets available target languages for a specific config index
 * @param mappings - The reformatted mappings data
 * @param configIndex - The config index to get languages for (0, 1, etc.)
 * @returns Array of language objects
 */
export function getTargetLanguages(mappings: ReformattedMappings, configIndex: number): Record<string, string>[] | null {
  const config = mappings[configIndex];
  return config ? config.sup_target_languages : null;
}

/**
 * Gets excluded source languages for a specific config index
 * @param mappings - The reformatted mappings data
 * @param configIndex - The config index to get excluded languages for (0, 1, etc.)
 * @returns Array of excluded language codes
 */
export function getExcludedSourceLanguages(mappings: ReformattedMappings, configIndex: number): string[] | null {
  const config = mappings[configIndex];
  return config ? config.exclude_source_languages : null;
}

/**
 * Example usage function - demonstrates how to use the processor
 */
export function example(): void {
  // Example usage:
  // const reformattedData = processTranslationFile('./soniox/SonioxTranslationMappings.json');
  // const sourceLanguages = getSourceLanguages(reformattedData, 0); // First config
  // const targetLanguages = getTargetLanguages(reformattedData, 1); // Second config
  console.log('Translation processor ready. Use processTranslationFile() to reformat your JSON.');
}