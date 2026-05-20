import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

async function listModels() {
  console.log('📋 Listing available Gemini models...\n');

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  try {
    const models = await ai.models.list();

    console.log('Available models:');
    console.log('='.repeat(80));

    for (const model of models) {
      console.log(`\n✅ ${model.name}`);
      console.log(`   Display Name: ${model.displayName}`);
      console.log(`   Supported: ${model.supportedGenerationMethods?.join(', ')}`);
    }

    console.log('\n' + '='.repeat(80));

  } catch (error: any) {
    console.error('❌ Error listing models:', error.message);
  }
}

listModels();
