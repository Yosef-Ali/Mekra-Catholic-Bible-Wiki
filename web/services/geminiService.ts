import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { UserProfile } from "../types";

// Initialize Gemini AI using latest API (matches scripts pattern)
// IMPORTANT: In a Vite client build, use VITE_GEMINI_API_KEY from .env/.env.local
// Fallback to process.env for server-side scripts.
const apiKey =
  // Vite client env
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
  // Node/server-side
  process.env.GEMINI_API_KEY ||
  '';
const hasApiKey = !!apiKey;
const ai = new GoogleGenAI({ apiKey });

// Use Gemini 3 Pro Preview - kept ONLY for features Ollama can't do:
// - getDailyMassReadings (needs googleSearch grounding)
// - generateAndPlayAudio (TTS)
// All other AI calls now go through Ollama Cloud via /api/ai (server proxy).
const modelName = "gemini-3-pro-preview";

// --- Ollama proxy helpers (server-side, key never exposed to browser) ---
async function ollamaGenerate(opts: { system?: string; prompt: string; json?: boolean; temperature?: number }): Promise<string> {
  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw new Error(`AI proxy error ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'AI proxy failure');
  return data.text || '';
}

// Strip markdown code fences from JSON responses (gemma sometimes wraps).
function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  const arrStart = text.indexOf('[');
  const arrEnd = text.lastIndexOf(']');
  // Prefer object if both present and object wraps array
  if (start !== -1 && end !== -1 && (arrStart === -1 || start < arrStart)) {
    return text.substring(start, end + 1);
  }
  if (arrStart !== -1 && arrEnd !== -1) {
    return text.substring(arrStart, arrEnd + 1);
  }
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

// Helper to construct system instruction with user context
const getPersonalizedSystemInstruction = (profile: UserProfile | null) => {
  if (!profile) return SYSTEM_INSTRUCTION;

  return `${SYSTEM_INSTRUCTION}
  
  --- USER CONTEXT (ADAPT YOUR RESPONSE TO THIS) ---
  You are speaking to a user with the following profile:
  - Role/Vocation: ${profile.role}
  - Age Group: ${profile.ageGroup}
  - Interests: ${profile.interests.join(', ')}

  ADAPTATION RULES:
  1. If Role is 'Priest' or 'Theologian': Use deep theological terminology, cite Canon Law (CIC), Latin phrases, and specific Church documents (e.g., Vatican II, Encyclicals). Focus on Dogma.
  2. If Role is 'Student' or 'Youth': Focus on the **Psychology of Faith**—how faith helps with anxiety, purpose, and identity. Use intellectual arguments.
  3. If Role is 'Child': Use simple nature stories, very gentle language, focus on God's friendship.
  4. If Role is 'Nun': Focus on **Mysticism**, the Interior Castle (St. Teresa of Avila), and the beauty of silence.
  5. If Role is 'Layperson': Focus on the **Interior Life** amidst the busy world. How to find peace in the heart.
  `;
};

export const getDailyVerse = async (): Promise<{ verse: string; reference: string; reflection: string }> => {
  try {
    const text = await ollamaGenerate({
      system: SYSTEM_INSTRUCTION,
      prompt: `Generate a daily Catholic Bible verse in Amharic with a short spiritual reflection.
Return ONLY a JSON object with this exact shape:
{"verse": "scripture text in Amharic", "reference": "book chapter:verse in Amharic e.g. ማቴዎስ 5:3", "reflection": "2-3 sentence Amharic reflection"}
Use standard numerals (1, 2, 3), not Amharic numerals.`,
      json: true,
      temperature: 0.7,
    });
    return JSON.parse(extractJson(text));
  } catch (error) {
    console.error("Failed to fetch daily verse", error);
    return {
      verse: "እግዚአብሔር እረኛዬ ነው፤ የሚያሳጣኝም የለም።",
      reference: "መዝሙረ ዳዊት 23:1",
      reflection: "እግዚአብሔር ሁል ጊዜ ከእኛ ጋር ስለሆነ ልንፈራ አይገባም።"
    };
  }
};

import { getCachedDailyReadings, setCachedDailyReadings, isCacheValid } from './storageService';

export const getDailyMassReadings = async (targetDate: Date = new Date()): Promise<any> => {
  // Check cache first for instant loading
  const cache = getCachedDailyReadings();
  if (isCacheValid(cache)) {
    console.log('📦 Returning cached daily readings');
    return cache!.data;
  }

  // Show stale data while we fetch fresh data (if cache exists but expired)
  const staleData = cache?.data;

  try {
    if (!hasApiKey) throw new Error("Missing GEMINI_API_KEY");
    const formattedDate = targetDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const prompt = `
      Find the official Catholic Daily Mass Readings for ${formattedDate}.
      
      Tasks:
      1. Identify the Liturgical Date/Feast (e.g., "Tuesday of the 3rd Week of Lent").
      2. Provide the full text for:
         - First Reading
         - Responsorial Psalm
         - Second Reading (if applicable for today)
         - Gospel
      3. Write a deep, powerful Homily/Reflection.
         - **Style**: Combine the **intellectual clarity of Bishop Robert Barron** and the **dramatic, soul-piercing rhetoric of Archbishop Fulton Sheen**.
         - **Focus**: **Psychological** and **Mystical**.
           - **Psychological**: Analyze the human condition—our anxieties, our hidden fears, the ego, and the thirst for meaning. How does today's reading heal the human mind?
           - **Mystical**: Speak of the soul's union with God. Use imagery of Light, Fire, the Desert, and the Heart.
           - **Universal Metaphors**: Use universal examples (e.g., a traveler lost in a storm, the silence of a mountain, the warmth of a home, the battle of a soldier) rather than specific cultural clichés.
           - Avoid superficial examples. Go deep into the soul.
         - The reflection should be substantial (3-4 paragraphs) in Amharic.
      
      Output Language: **AMHARIC** (Except for the JSON keys).
      
      **IMPORTANT**: USE STANDARD ARABIC NUMERALS (1, 2, 3) for all verse numbers and dates. DO NOT use Ethiopic numerals.

      STRICT JSON OUTPUT REQUIRED:
      1. Return ONLY a valid JSON object. 
      2. Do not include markdown formatting (like \`\`\`json).
      3. **ESCAPE ALL DOUBLE QUOTES** inside the text content (e.g. "He said \\"Hello\\"").
      4. Ensure no unescaped control characters.
      
      Structure:
      {
        "date": "The requested date",
        "liturgicalFeast": "Name of feast in English/Amharic mixed",
        "readings": [
          { 
            "type": "First Reading" | "Responsorial Psalm" | "Second Reading" | "Gospel", 
            "reference": "Book Chapter:Verse", 
            "text": "Full text in Amharic" 
          }
        ],
        "reflection": {
          "title": "Title in Amharic",
          "authorStyle": "Description",
          "content": "Content in Amharic"
        }
      }
    `;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2, // Lower temperature to ensure valid JSON structure
      }
    });

    let text = response.text;
    if (!text) throw new Error("No text returned");

    text = extractJson(text);

    try {
      const parsedData = JSON.parse(text);
      // Cache the fresh data
      setCachedDailyReadings(parsedData);
      console.log('✅ Fetched and cached fresh daily readings');
      return parsedData;
    } catch (parseError) {
      console.error("JSON Parse Error in Mass Readings:", parseError);
      console.log("Malformed JSON Text:", text);
      throw parseError; // Re-throw to hit the outer catch block and return fallback
    }

  } catch (error) {
    console.error("Failed to fetch mass readings", error);

    // Return stale data if available
    if (staleData) {
      console.log('⚠️ Returning stale cached data due to fetch error');
      return staleData;
    }

    // Fallback data
    return {
      date: targetDate.toLocaleDateString(),
      liturgicalFeast: "Ordinary Time",
      readings: [
        { type: "Gospel", reference: "John 3:16", text: "እግዚአብሔር አንድያ ልጁን እስኪሰጥ ድረስ ዓለሙን እንዲሁ ወዶአልና..." }
      ],
      reflection: {
        title: "የእግዚአብሔር ፍቅር",
        authorStyle: "Fulton Sheen Style",
        content: "እግዚአብሔር ፍቅር ነው። ይህ ፍቅር ደግሞ በቃላት ብቻ ሳይሆን በተግባር የተገለጠ ነው።..."
      }
    };
  }
};

export const getChapterContent = async (book: string, chapter: number): Promise<string> => {
  try {
    const text = await ollamaGenerate({
      system: SYSTEM_INSTRUCTION,
      prompt: `Provide the full text of ${book} Chapter ${chapter} in Amharic.
IMPORTANT:
1. You MUST include verse numbers in brackets like [1], [2] at the beginning of each verse.
2. USE STANDARD ARABIC NUMERALS (1, 2, 3) for verse numbers. DO NOT use Amharic/Ethiopic numerals.
3. Do not skip any verses.`,
      temperature: 0.3,
    });
    return text || "ይቅርታ፣ ይህንን ምዕራፍ ማግኘት አልተቻለም። እባክዎ እንደገና ይሞክሩ።";
  } catch (error) {
    console.error("Failed to fetch chapter", error);
    return "Error loading chapter. Please check your connection.";
  }
};

export const streamChatResponse = async function* (
  message: string,
  history: { role: string, parts: { text: string }[] }[],
  userProfile: UserProfile | null = null
) {
  try {
    const res = await fetch('/api/ai/chat-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: getPersonalizedSystemInstruction(userProfile),
        history,
        message,
        temperature: 0.7,
      }),
    });

    if (!res.ok || !res.body) throw new Error(`Chat proxy error ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const events = buf.split('\n\n');
      buf = events.pop() || '';
      for (const ev of events) {
        const line = ev.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          const obj = JSON.parse(payload);
          if (obj.text) {
            yield { text: obj.text } as GenerateContentResponse;
          }
        } catch {
          // ignore
        }
      }
    }
  } catch (error) {
    console.error("Chat error", error);
    yield { text: "Error connecting to the spiritual guide. Please check your connection." } as GenerateContentResponse;
  }
};

export const generateChatSuggestions = async (lastResponse: string, userProfile: UserProfile | null = null): Promise<string[]> => {
  try {
    let contextPrompt = "";
    if (userProfile) {
      contextPrompt = `
        User Profile: ${userProfile.role}, Age: ${userProfile.ageGroup}, Interests: ${userProfile.interests.join(', ')}.
        Customize the suggestions to fit this user's capability and role. 
        (e.g. if Priest -> deeper theological questions. if Student -> educational/psychological questions).
        `;
    }

    const prompt = `
    Analyze the following Catholic theological response:
    "${lastResponse.substring(0, 1500)}..."

    ${contextPrompt}

    Based on this context, generate exactly 3 short, engaging follow-up questions in AMHARIC.
    
    The questions must strictly follow these categories:
    1. **Psychological/Clarification**: How does this apply to the mind/heart?
    2. **Apologetics/Deep Dive**: Challenge based on user role.
    3. **Mystical/Application**: How does this lead to prayer?

    Return ONLY a JSON array of exactly 3 strings in Amharic. Example: ["ጥያቄ 1", "ጥያቄ 2", "ጥያቄ 3"]
    `;

    const text = await ollamaGenerate({ prompt, json: true, temperature: 0.7 });
    if (!text) return [];
    return JSON.parse(extractJson(text));
  } catch (error) {
    console.error("Failed to generate suggestions", error);
    return [
      "የቤተክርስቲያን አባቶች ስለዚህ ምን ይላሉ?",
      "ይህንን በዕለት ተዕለት ሕይወቴ እንዴት ልተገብረው እችላለሁ?",
      "ለዚህ ጥያቄ መጽሐፍ ቅዱሳዊ ማስረጃው ምንድን ነው?"
    ];
  }
};

export const getInitialLiturgicalSuggestions = async (): Promise<string[]> => {
  try {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const text = await ollamaGenerate({
      prompt: `Given today is ${today}, generate 4 short, relevant questions for a Catholic user in AMHARIC.

Mix the following types:
1. Liturgical Season/Feast (e.g. regarding Lent, Advent, or today's Saint).
2. Basic Doctrine (e.g. "Who is the Holy Spirit?", "What is Grace?").
3. Apologetics (e.g. "Why do Catholics confess to priests?", "Do Catholics worship Mary?").

Return ONLY a JSON array of exactly 4 strings in Amharic.`,
      json: true,
      temperature: 0.7,
    });
    if (!text) return [];
    return JSON.parse(extractJson(text));
  } catch (error) {
    console.error("Failed to fetch initial suggestions", error);
    // Fallback in Amharic
    return [
      "የዛሬው የቅዳሴ ምንባባት ምንድን ናቸው?",
      "ስለ እመቤታችን ንገረኝ",
      "ለምን ለካህን እንናዘዛለን?",
      "ዐቢይ ጾም ምንድነው?"
    ];
  }
};

// --- TTS Helper Functions (free Google Translate TTS) ---
let currentAudio: HTMLAudioElement | null = null;
let _playbackRate = 1.0;

export const setTTSPlaybackRate = (rate: number) => {
  _playbackRate = rate;
  if (currentAudio) currentAudio.playbackRate = rate;
};

export const pauseAudioPlayback = () => {
  if (currentAudio && !currentAudio.paused) {
    currentAudio.pause();
  }
};

export const resumeAudioPlayback = () => {
  if (currentAudio && currentAudio.paused && currentAudio.src) {
    currentAudio.play().catch(() => {});
  }
};

export const stopAudioPlayback = () => {
  if (currentAudio) {
    // Remove event handlers to prevent ghost callbacks
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.pause();
    const src = currentAudio.src;
    currentAudio.src = '';
    currentAudio.load();   // force release
    currentAudio = null;
    if (src.startsWith('blob:')) URL.revokeObjectURL(src);
  }
};

// Abort controller cancels in-flight fetch when stop/skip is called
let fetchController: AbortController | null = null;

export const generateAndPlayAudio = async (text: string): Promise<void> => {
  // Kill any previous audio + in-flight request
  stopAudioPlayback();
  if (fetchController) fetchController.abort();

  const cleanText = text.replace(/\[\d+\]\s*/g, '').trim();
  if (!cleanText) return;

  fetchController = new AbortController();

  const res = await fetch('/api/ai/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: cleanText, lang: 'am' }),
    signal: fetchController.signal,
  });

  fetchController = null;
  if (!res.ok) throw new Error(`TTS error ${res.status}`);

  const blob = await res.blob();
  if (blob.size === 0) throw new Error('TTS returned empty audio');

  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.playbackRate = _playbackRate;
    currentAudio = audio;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      reject(new Error('Audio playback failed'));
    };
    audio.play().catch((err) => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      reject(err);
    });
  });
};
