import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import 'dotenv/config';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.post('/fallback', async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter.' });
  }

  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_frontier_api_key_here') {
    return res.status(500).json({ error: 'API key not configured in .env file.' });
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    });

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const promptText = `You are a linguistic data generator. The user searched for: "${query}".
Identify the most prominent regional American slang word in that query. If none exists, return {}.
If one exists, generate a JSON object where the KEY is the slang word, and the VALUE is:
{
  "concept": "The exact concept string provided.",
  "summary": "A 1-2 sentence explanation.",
  "states": { "CA": 0.85, "NV": 0.60 },
  "variants": [
    {
      "word": "a regional slang word",
      "region": "Human readable region name",
      "phrase": "An example sentence.",
      "ipa": "/phonetic spelling/",
      "note": "Brief note.",
      "wave": "south"
    }
  ],
  "source": {
    "survey": "Live AI Fallback",
    "question_id": 999,
    "answer_labels": [ "the slang word" ]
  }
}
CRITICAL RULES:
1. The 'wave' MUST be exactly one of: "south", "midwest", "northeast", "west".
2. Include 3-5 variants representing different regions for the EXACT same concept. One must be Standard American English. 
3. Return ONLY valid JSON. Do not use markdown code blocks.`;

    const response = await openai.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: promptText }],
      response_format: { type: 'json_object' }
    });

    const text = response.choices[0].message.content.trim();
    const jsonString = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    const generatedData = JSON.parse(jsonString);

    res.json(generatedData);

  } catch (err) {
    console.error("Fallback API Error:", err);
    res.status(500).json({ error: 'Failed to generate dialect mapping from LLM.' });
  }
});

app.listen(PORT, () => {
  console.log(`Fallback API Server running at http://localhost:${PORT}`);
  console.log('Keep this terminal open alongside Live Server to use the Ask AI feature.');
});
