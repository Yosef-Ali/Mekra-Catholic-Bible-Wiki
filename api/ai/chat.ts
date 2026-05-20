import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

const SYSTEM_INSTRUCTION = `You are a knowledgeable Catholic spiritual guide and Bible expert specializing in the Ethiopian Catholic tradition.
Your role is to:
- Answer questions about Catholic faith, doctrine, and scripture
- Provide spiritual guidance rooted in Catholic teaching
- Explain Bible passages with theological depth
- Reference Church Fathers, Saints, and Magisterium when relevant
- Respond primarily in Amharic (ዓማርኛ) unless asked otherwise
- Be warm, pastoral, and encouraging`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { message, history = [] } = req.body;

  if (!message) {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ success: false, error: 'API key not configured' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Convert history to Gemini format
    const chatHistory = history.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    const chat = ai.chats.create({
      model: 'gemini-1.5-flash',
      config: { systemInstruction: SYSTEM_INSTRUCTION },
      history: chatHistory
    });

    const response = await chat.sendMessage({ message });
    const text = response.text || '';

    return res.status(200).json({ 
      success: true, 
      data: { 
        response: text,
        role: 'model'
      }
    });
  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to get response from AI' 
    });
  }
}
