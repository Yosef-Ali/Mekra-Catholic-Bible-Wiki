import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface ProofreadSuggestion {
  original: string;
  suggested: string;
  reason: string;
  type: 'spelling' | 'grammar' | 'formatting' | 'verse';
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * AI Chat Assistant for Bible editing
 */
export async function chatWithAI(
  message: string, 
  context: { content?: string; bookName?: string; chapter?: number },
  history: ChatMessage[] = []
) {
  try {
    const systemPrompt = `You are an expert Amharic Bible editor assistant. You help with:
- Proofreading and correcting Amharic text
- Formatting Bible verses properly  
- Identifying and fixing OCR errors
- Suggesting improvements to text layout
- Explaining Amharic grammar and punctuation

Current context:
- Book: ${context.bookName || 'Not specified'}
- Chapter: ${context.chapter || 'Not specified'}
${context.content ? `\nCurrent content (${context.content.length} chars):\n${context.content.substring(0, 800)}${context.content.length > 800 ? '...' : ''}` : ''}

Guidelines:
- Respond in the same language as the user (Amharic or English)
- Be concise and helpful
- When suggesting edits, show before → after
- Use Amharic punctuation: ። (period) ፣ (comma) ፤ (semicolon) ፥ (colon)
- Verse numbers should be formatted as [1], [2], etc.
- When providing corrected text, wrap it in \`\`\` code blocks`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `${systemPrompt}\n\nUser: ${message}`
    });

    return {
      success: true,
      message: response.text || 'No response generated'
    };

  } catch (error) {
    console.error('Chat error:', error);
    return {
      success: false,
      error: 'Chat failed',
      message: 'Sorry, I encountered an error. Please try again.'
    };
  }
}


/**
 * AI Proofreading for Amharic Bible text
 */
export async function proofreadContent(content: string, bookName?: string, chapter?: number) {
  try {
    const prompt = `You are an expert in Amharic Bible text proofreading. Analyze the following Bible chapter text and identify any issues.

Book: ${bookName || 'Unknown'}
Chapter: ${chapter || 'Unknown'}

Text to proofread:
${content}

Please identify:
1. Spelling errors in Amharic words
2. Inconsistent verse numbering (should be [1], [2], etc.)
3. Missing or incorrect punctuation (። ፣ ፤ ፥)
4. Formatting issues (extra spaces, broken lines)
5. Any text that seems corrupted or garbled

Respond in JSON format only:
{
  "suggestions": [
    {
      "original": "the problematic text",
      "suggested": "the corrected text", 
      "reason": "brief explanation",
      "type": "spelling|grammar|formatting|verse"
    }
  ]
}

If no issues found, return: { "suggestions": [] }`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt
    });
    
    const responseText = response.text || '';
    
    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        suggestions: parsed.suggestions || []
      };
    }

    return { success: true, suggestions: [] };

  } catch (error) {
    console.error('Proofreading error:', error);
    return {
      success: false,
      error: 'Proofreading failed',
      suggestions: []
    };
  }
}


/**
 * OCR - Extract text from image using Gemini Vision
 */
export async function extractTextFromImage(imageBase64: string, bookName?: string, chapter?: number) {
  try {
    const prompt = `This is a page from an Amharic Bible PDF. Please extract all the text exactly as shown, preserving:

1. Verse numbers (format as [1], [2], etc.)
2. Line breaks and paragraph structure  
3. Any subtitles or section headings (mark with **)
4. Poetry formatting (indentation for Psalms, etc.)

Book context: ${bookName || 'Unknown'} Chapter ${chapter || ''}

Important:
- Extract Amharic text exactly as written
- Preserve the original layout/structure
- Mark unclear text with [?]
- Do NOT translate - keep original Amharic

Output the extracted text only, no explanations.`;

    // Clean base64 data
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        { text: prompt },
        { 
          inlineData: {
            mimeType: 'image/png',
            data: cleanBase64
          }
        }
      ]
    });

    return {
      success: true,
      text: response.text || ''
    };

  } catch (error) {
    console.error('OCR error:', error);
    return {
      success: false,
      error: 'Failed to extract text from image',
      text: ''
    };
  }
}
