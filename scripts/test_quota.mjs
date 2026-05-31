import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

async function test() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  try {
    const res = await model.generateContent("hello");
    console.log("Success:", res.response.text());
  } catch (e) {
    console.log("Error status:", e.status);
    console.log("Error details:", JSON.stringify(e.errorDetails, null, 2));
  }
}
test();
