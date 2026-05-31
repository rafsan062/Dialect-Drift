import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';

const STAGING_FILE = path.join(process.cwd(), 'public', 'data', 'words_staging.json');

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Please provide a list of concepts to enrich, separated by pipes. Example: npm run enrich 'a long sandwich|a sweetened carbonated beverage'");
    process.exit(1);
  }

  // Handle pipe-separated string
  const inputConcepts = args.join(' ').split('|').map(w => w.trim()).filter(Boolean);

  if (inputConcepts.length === 0) {
    console.log("No new concepts to process. Exiting.");
    process.exit(0);
  }

  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_frontier_api_key_here') {
    console.error("ERROR: Please set a valid OPENAI_API_KEY in your .env file.");
    process.exit(1);
  }

  console.log(`Processing ${inputConcepts.length} new concept(s)...`);

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  });

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  // Batch process in chunks to avoid output token limits
  const chunkSize = 15;
  let totalAddedCount = 0;

  for (let i = 0; i < inputConcepts.length; i += chunkSize) {
    const chunk = inputConcepts.slice(i, i + chunkSize);
    console.log(`\nProcessing batch ${Math.floor(i/chunkSize) + 1} of ${Math.ceil(inputConcepts.length/chunkSize)}: ${chunk.join(', ')}`);

    const prompt = `You are a linguistic data generator specializing in American regional dialects. For the following list of linguistic concepts, generate a JSON object containing dialect data.
  
For EACH concept, pick the most common regional slang word for that concept to use as the top-level KEY. The value must match this exact schema:

{
  "concept": "The exact concept string provided.",
  "summary": "A 1-2 sentence explanation of the regional words used for this concept.",
  "states": {
    "CA": 0.85, "NV": 0.60  // Provide 2-5 US State abbreviations as keys with float values between 0.0 and 1.0 representing usage strength of the MAIN slang word.
  },
  "variants": [
    {
      "word": "a regional slang word (e.g., hoagie)",
      "region": "Human readable region name (e.g., Philadelphia)",
      "phrase": "An example sentence using the word naturally.",
      "ipa": "/phonetic spelling/",
      "note": "Brief note on usage.",
      "wave": "south" // MUST be exactly one of: "south", "midwest", "northeast", "west"
    }
  ],
  "source": {
    "survey": "LLM Generated Concept Discovery",
    "question_id": 999,
    "answer_labels": [ "the main slang word" ]
  }
}

CRITICAL RULES FOR VARIANTS:
1. You MUST include at least 3 to 5 variants for EACH concept.
2. The variants must represent DIFFERENT words used for the exact same concept across different US regions (e.g., if the concept is 'a long sandwich', variants should be 'sub', 'hoagie', 'grinder', 'hero').
3. One of the variants MUST be the "Standard American English" or most common baseline word (e.g., 'sub').

Only return raw JSON. Do not use markdown blocks like \`\`\`json. The root must be an object containing the main slang words as keys.
Concepts to process: ${JSON.stringify(chunk)}`;

    try {
      console.log("Querying OpenAI API...");
      const response = await openai.chat.completions.create({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: "json_object" } 
      });
      
      const text = response.choices[0].message.content.trim();
      
      const jsonString = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
      const generatedData = JSON.parse(jsonString);

      // Load staging file
      let stagingData = {};
      try {
        const stagingContent = await fs.readFile(STAGING_FILE, 'utf-8');
        stagingData = JSON.parse(stagingContent);
      } catch (err) {
        stagingData = {};
      }

      // Merge generated data into staging
      let addedCount = 0;
      for (const [key, value] of Object.entries(generatedData)) {
        stagingData[key] = value;
        addedCount++;
        totalAddedCount++;
      }

      await fs.writeFile(STAGING_FILE, JSON.stringify(stagingData, null, 2), 'utf-8');
      console.log(`Successfully appended ${addedCount} new concepts to public/data/words_staging.json`);
    } catch (error) {
      console.error("Error during LLM generation or parsing for this batch:", error);
    }
    
    // Pause briefly between batches
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Automatically rebuild the static js/data.js so the UI updates immediately
  console.log(`\nFinished processing! Total newly added concepts: ${totalAddedCount}`);
  console.log("Rebuilding js/data.js static bundle...");
  await promisify(exec)("node scripts/make-static-assets.mjs && npm run build");
  console.log("App rebuilt successfully with the new multi-variant concepts!");
}

main();
