import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import 'dotenv/config';

const execAsync = promisify(exec);

const WORDS_FILE = path.join(process.cwd(), 'public', 'data', 'words.json');
const STAGING_FILE = path.join(process.cwd(), 'public', 'data', 'words_staging.json');

async function main() {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_frontier_api_key_here') {
    console.error("ERROR: Please set a valid OPENAI_API_KEY in your .env file.");
    process.exit(1);
  }

  // Load existing concepts
  let existingConcepts = new Set();
  try {
    const data = await fs.readFile(WORDS_FILE, 'utf-8');
    Object.values(JSON.parse(data)).forEach(entry => {
      if (entry.concept) existingConcepts.add(entry.concept.toLowerCase());
    });
  } catch (err) {
    console.error("Could not read public/data/words.json");
  }

  try {
    const stagingData = await fs.readFile(STAGING_FILE, 'utf-8');
    Object.values(JSON.parse(stagingData)).forEach(entry => {
      if (entry.concept) existingConcepts.add(entry.concept.toLowerCase());
    });
  } catch (err) {
    // Ignore if staging doesn't exist
  }

  console.log(`Loaded ${existingConcepts.size} existing concepts. Brainstorming new ones...`);

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  });

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const prompt = `You are a linguistic expert on American regional dialects.
I already have a dataset of ${existingConcepts.size} linguistic concepts.
Please give me exactly 100 new highly regional American linguistic concepts that are NOT common knowledge. Focus on unique ideas that have completely different words used for them depending on the region (e.g., "a long sandwich filled with meat and cheese", "a sweetened carbonated beverage", "a small insect that rolls into a ball").

Return ONLY a JSON array of strings containing the 100 concepts. Do not include any other text, quotes, or formatting.
Example output: ["a long sandwich filled with meat", "a sweetened carbonated beverage", "athletic shoes worn for casual use"]`;

  try {
    const response = await openai.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: "json_object" } // Or just parse the array
    });
    
    let generatedText = response.choices[0].message.content.trim();
    
    // Clean up
    generatedText = generatedText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    
    let newConcepts;
    try {
      newConcepts = JSON.parse(generatedText);
      // Handle case where LLM returns an object wrapping the array
      if (!Array.isArray(newConcepts)) {
        newConcepts = newConcepts.concepts || Object.values(newConcepts)[0];
      }
    } catch (e) {
      console.error("Failed to parse JSON array from LLM:", generatedText);
      return;
    }

    if (!Array.isArray(newConcepts)) {
      console.error("LLM did not return an array of concepts.");
      return;
    }

    // Dedupe
    const completelyNewConcepts = newConcepts.filter(c => !existingConcepts.has(c.toLowerCase()));

    if (completelyNewConcepts.length === 0) {
      console.log("LLM didn't return any completely new concepts this time.");
      return;
    }

    console.log(`Discovered ${completelyNewConcepts.length} new concepts: ${completelyNewConcepts.join(', ')}`);
    console.log(`Piping them to the enrichment script...`);

    // We pass the concepts as a single pipe-separated string to the enrich script
    const command = `npm run enrich "${completelyNewConcepts.join('|')}"`;
    
    const { stdout, stderr } = await execAsync(command);
    console.log(stdout);
    if (stderr) {
      console.error(stderr);
    }
    
    console.log("Auto-discovery cycle complete!");

  } catch (error) {
    console.error("Error during auto-discovery:", error);
  }
}

main();
