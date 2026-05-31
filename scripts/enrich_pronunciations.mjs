import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';

const WORDS_FILE = path.join(process.cwd(), 'public', 'data', 'words.json');
const STAGING_FILE = path.join(process.cwd(), 'public', 'data', 'words_staging.json');

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Please provide a list of words to enrich pronunciations for. Example: npm run add-pronunciations 'pecan, caramel'");
    process.exit(1);
  }

  let inputWords = [];
  const isAll = args[0] === '--all';
  if (!isAll) {
    inputWords = args.join(' ').split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
  }

  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_frontier_api_key_here') {
    console.error("ERROR: Please set a valid OPENAI_API_KEY in your .env file.");
    process.exit(1);
  }

  // Load existing words
  let existingWords = {};
  let stagingData = {};
  try {
    existingWords = JSON.parse(await fs.readFile(WORDS_FILE, 'utf-8'));
  } catch (err) {
    console.error("Could not read words.json.", err);
  }
  try {
    stagingData = JSON.parse(await fs.readFile(STAGING_FILE, 'utf-8'));
  } catch (err) {
    stagingData = {};
  }

  if (isAll) {
    // Find words that don't have pronunciation variants yet
    const allKeys = [...Object.keys(existingWords), ...Object.keys(stagingData)];
    inputWords = allKeys.filter(word => {
      const entry = stagingData[word] || existingWords[word];
      // If it only has 1 variant or no variants, it needs pronunciation expansion
      return !entry.variants || entry.variants.length <= 1;
    });
    console.log(`Found ${inputWords.length} words needing pronunciation expansion.`);
  }

  // Batch process in chunks of 15 to avoid LLM token limits
  const chunkSize = 15;
  for (let i = 0; i < inputWords.length; i += chunkSize) {
    const chunk = inputWords.slice(i, i + chunkSize);
    console.log(`\nProcessing batch ${Math.floor(i/chunkSize) + 1} of ${Math.ceil(inputWords.length/chunkSize)}: ${chunk.join(', ')}`);

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    });
  
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const prompt = `You are a linguistic data generator. The user has provided a list of words. For each word, generate a JSON object containing an array of regional pronunciation variants. 
  
Return a JSON object where the keys are the words, and the values are the arrays of variant objects.

For example, if the word is "caramel", the output should be:
{
  "caramel": [
    {
      "word": "caramel",
      "region": "Midwest / West",
      "phrase": "I love caramel apples.",
      "ipa": "/ˈkɑrməl/",
      "note": "Two syllables.",
      "wave": "midwest"
    },
    {
      "word": "caramel",
      "region": "Northeast",
      "phrase": "I love caramel apples.",
      "ipa": "/ˈkærəmɛl/",
      "note": "Three syllables.",
      "wave": "northeast"
    }
  ]
}

CRITICAL RULES:
1. The "word" field inside the variant MUST be exactly the same spelling as the requested word.
2. The "wave" field MUST be exactly one of: "south", "midwest", "northeast", "west".
3. Provide 2 to 4 distinct pronunciations per word based on real American regional dialects.

Only return raw JSON. Do not use markdown blocks like \`\`\`json.
Words to process: ${JSON.stringify(chunk)}`;

    try {
      console.log("Querying OpenAI API...");
      const response = await openai.chat.completions.create({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: "json_object" }
      });
      
      const text = response.choices[0].message.content.trim();
      
      const jsonString = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
      const generatedVariants = JSON.parse(jsonString);

      let updatedCount = 0;

      for (const [word, newVariants] of Object.entries(generatedVariants)) {
        // Find the base entry to update
        let baseEntry = stagingData[word] || existingWords[word];
        
        if (!baseEntry) {
          console.log(`Warning: "${word}" not found in dataset. Creating a stub entry...`);
          baseEntry = {
            concept: "pronunciation difference",
            summary: `Regional pronunciation differences for ${word}.`,
            states: { "CA": 0.5, "NY": 0.5, "TX": 0.5 },
            variants: [],
            source: {
              survey: "LLM Pronunciation Expansion",
              question_id: 999,
              answer_labels: [word]
            }
          };
        } else {
          // Deep clone if it came from words.json to avoid mutating references
          baseEntry = JSON.parse(JSON.stringify(baseEntry));
          
          // Update the source so the UI badges correctly
          if (!baseEntry.source || baseEntry.source.survey.includes("Harvard")) {
              baseEntry.source = {
                  survey: "Harvard Dialect Survey + LLM Pronunciations",
                  question_id: baseEntry.source?.question_id || 999,
                  answer_labels: baseEntry.source?.answer_labels || [word]
              };
          }
        }

        // Merge variants. We replace existing variants that have the exact same spelling, 
        // or just append them if it's a completely new list.
        baseEntry.variants = [...newVariants, ...(baseEntry.variants || []).filter(v => v.word !== word)];

        // Save to staging
        stagingData[word] = baseEntry;
        updatedCount++;
      }

      await fs.writeFile(STAGING_FILE, JSON.stringify(stagingData, null, 2), 'utf-8');
      console.log(`Successfully updated ${updatedCount} words in public/data/words_staging.json`);
    } catch (error) {
      console.error("Error during LLM generation or parsing for this batch:", error);
    }
    // Pause slightly between batches to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log("\nRebuilding js/data.js static bundle...");
  await promisify(exec)("node scripts/make-static-assets.mjs && npm run build");
  console.log("App rebuilt successfully with all the new pronunciations!");
}

main();
