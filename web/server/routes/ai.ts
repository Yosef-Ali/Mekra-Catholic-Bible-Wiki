import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import { getAllAudioBase64 } from 'google-tts-api';

const router = Router();

const OLLAMA_URL = 'https://ollama.com/api/chat';
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || '';
const OLLAMA_MODEL = (process.env.OLLAMA_MODEL || 'gemma4:31b-cloud').trim();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-3-flash-preview';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

// ── Ollama ─────────────────────────────────────────────────────────
async function callOllama(messages: ChatMessage[], opts: { json?: boolean; temperature?: number; stream?: boolean } = {}) {
  if (!OLLAMA_API_KEY) throw new Error('Missing OLLAMA_API_KEY');
  const body: any = {
    model: OLLAMA_MODEL,
    messages,
    stream: !!opts.stream,
    options: { temperature: opts.temperature ?? 0.7 },
  };
  if (opts.json) body.format = 'json';

  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OLLAMA_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ollama ${res.status}: ${errText}`);
  }
  return res;
}

// ── Gemini fallback (singleton) ───────────────────────────────────
const geminiAI = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

function getGeminiAI() {
  if (!geminiAI) throw new Error('Missing GEMINI_API_KEY for fallback');
  return geminiAI;
}

async function geminiGenerate(messages: ChatMessage[], opts: { json?: boolean; temperature?: number }): Promise<string> {
  const ai = getGeminiAI();
  const systemMsg = messages.find(m => m.role === 'system');
  const userMsgs = messages.filter(m => m.role !== 'system');
  const prompt = userMsgs.map(m => m.content).join('\n');

  const config: any = { temperature: opts.temperature ?? 0.7 };
  if (systemMsg) config.systemInstruction = systemMsg.content;
  if (opts.json) config.responseMimeType = 'application/json';

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config,
  });
  return response.text || '';
}

async function geminiStream(messages: ChatMessage[], opts: { temperature?: number }): Promise<AsyncIterable<string>> {
  const ai = getGeminiAI();
  const systemMsg = messages.find(m => m.role === 'system');
  const history = messages.filter(m => m.role !== 'system' && m !== messages[messages.length - 1]);
  const lastMsg = messages[messages.length - 1];

  const chat = ai.chats.create({
    model: GEMINI_MODEL,
    config: {
      systemInstruction: systemMsg?.content,
      temperature: opts.temperature ?? 0.7,
    },
    history: history.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })) as any,
  });

  const result = await chat.sendMessageStream({ message: lastMsg.content });
  return (async function* () {
    for await (const chunk of result) {
      if (chunk.text) yield chunk.text;
    }
  })();
}

// Single-shot generate (optional JSON mode) — Ollama first, Gemini fallback
router.post('/generate', async (req, res) => {
  const { system, prompt, json, temperature } = req.body || {};
  const messages: ChatMessage[] = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt || '' });

  // Try Ollama
  try {
    const ollamaRes = await callOllama(messages, { json: !!json, temperature, stream: false });
    const data: any = await ollamaRes.json();
    const text: string = data?.message?.content ?? '';
    res.json({ success: true, text, provider: 'ollama' });
    return;
  } catch (err: any) {
    console.warn('Ollama failed, falling back to Gemini:', err.message);
  }

  // Fallback to Gemini
  try {
    const text = await geminiGenerate(messages, { json: !!json, temperature });
    res.json({ success: true, text, provider: 'gemini' });
  } catch (err: any) {
    console.error('AI generate error (both providers failed):', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Streaming chat (SSE) — Ollama first, Gemini fallback
router.post('/chat-stream', async (req, res) => {
  const { system, history, message, temperature } = req.body || {};
  const messages: ChatMessage[] = [];
  if (system) messages.push({ role: 'system', content: system });
  if (Array.isArray(history)) {
    for (const h of history) {
      const role = h.role === 'model' ? 'assistant' : h.role;
      const content = Array.isArray(h.parts) ? h.parts.map((p: any) => p.text).join('') : (h.content || '');
      if (content) messages.push({ role, content });
    }
  }
  messages.push({ role: 'user', content: message || '' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let cancelled = false;
  req.on('close', () => { cancelled = true; });

  // Try Ollama streaming
  try {
    const ollamaRes = await callOllama(messages, { temperature, stream: true });
    const reader = (ollamaRes.body as any).getReader();
    const decoder = new TextDecoder();
    let buf = '';

    req.on('close', () => { reader.cancel().catch(() => {}); });

    while (!cancelled) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          const chunk = obj?.message?.content;
          if (chunk) res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
          if (obj.done) res.write('data: [DONE]\n\n');
        } catch { /* partial line */ }
      }
    }
    if (!cancelled) res.end();
    return;
  } catch (err: any) {
    console.warn('Ollama stream failed, falling back to Gemini:', err.message);
  }

  // Fallback to Gemini streaming
  try {
    const stream = await geminiStream(messages, { temperature });
    for await (const chunk of stream) {
      if (cancelled) break;
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }
    if (!cancelled) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (err: any) {
    console.error('AI chat-stream error (both providers failed):', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

// ── TTS (Google Translate — free, no API key, supports Amharic) ──
router.post('/tts', async (req, res) => {
  const { text, lang } = req.body || {};
  if (!text) {
    res.status(400).json({ success: false, error: 'Missing text' });
    return;
  }

  try {
    const results = await getAllAudioBase64(text, {
      lang: lang || 'am',
      slow: false,
      host: 'https://translate.google.com',
      splitPunct: '።፣፤',
    });
    const buffers = results.map((r: any) => Buffer.from(r.base64, 'base64'));
    const combined = Buffer.concat(buffers);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', combined.length.toString());
    res.send(combined);
  } catch (err: any) {
    console.error('TTS error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
