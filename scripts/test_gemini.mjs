import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

async function test() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  const sentence = "Can I get some jimmies on my ice cream?";
  const prompt = `You are a linguistic API. A user typed the following sentence: "${sentence}"
Your task is to identify ANY highly regional American slang words, dialectical terms, or colloquialisms in the sentence that are NOT standard American English. Ignore common words.
If you find regional words, return a JSON object where the keys are the words, and the values are their dictionary entries matching exactly this schema:
{
  "concept": "The general concept (e.g., 'a carbonated beverage')",
  "summary": "A 1-sentence summary of the word's regional usage.",
  "states": { "STATE_ABBR": 1 },
  "variants": [
    {
      "word": "the word itself or a synonym",
      "region": "Human readable region name",
      "phrase": "An example sentence using the word.",
      "ipa": "/phonetic spelling/",
      "note": "Brief note on usage.",
      "wave": "south"
    }
  ]
}
CRITICAL RULES:
1. ONLY return raw JSON. No markdown blocks, no extra text.
2. If the sentence contains NO regional words, return an empty object {}.
3. The variants array MUST include at least 2 variants: the slang word itself, AND the Standard American English equivalent word.
4. The "source" field will be added automatically, do not include it.`;

  console.log("Querying Gemini...");
  const res = await model.generateContent(prompt);
  console.log(res.response.text());
}
test();
