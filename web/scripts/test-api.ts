import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

async function testAPI() {
  console.log('🧪 Testing Gemini API...\n');

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  try {
    console.log('📡 Making simple API call with gemini-1.5-pro...');

    // Try different models to find which one works
    const modelsToTry = ['gemini-2.5-flash'];

    for (const model of modelsToTry) {
      try {
        console.log(`  Trying: ${model}...`);
        const response = await ai.models.generateContent({
          model: model,
          contents: 'Say hello in Amharic'
        });

        console.log(`  ✅ ${model} works!`);
        console.log('  Response:', response.text);
        console.log(`\n✅ Use this model: ${model}`);
        return;
      } catch (err: any) {
        console.log(`  ❌ ${model} failed:`, err.message.split('\n')[0]);
      }
    }

    console.log('✅ API is working!\n');
    console.log('Response:', response.text);
    console.log('\n✅ Your paid API account is active and ready!');
    console.log('You can now process your Bible PDF.\n');

  } catch (error: any) {
    console.error('❌ API Error:', error.message);

    if (error.status === 429) {
      console.log('\n⚠️  Still seeing rate limits.');
      console.log('Options:');
      console.log('1. Wait 2-3 minutes for quota to reset');
      console.log('2. Verify billing is enabled at: https://aistudio.google.com/');
      console.log('3. Check your API key is from the paid account');
    } else if (error.status === 403) {
      console.log('\n⚠️  API key may not have billing enabled.');
      console.log('Visit: https://aistudio.google.com/ and enable billing');
    }
  }
}

testAPI();
