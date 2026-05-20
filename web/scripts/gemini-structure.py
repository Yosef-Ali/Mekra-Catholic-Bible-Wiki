#!/usr/bin/env python3
"""
Call Gemini API to structure pre-extracted Bible text into chapters/verses JSON.
Uses google-genai SDK (more reliable than raw requests).

Input (stdin): enriched text with layout markers [TITLE],[HEAD],[VERSE],[POETRY],[PARA]
Args: <book_name> <amharic_name>
Output (stdout): JSON { "chapters": [...] }
"""

import sys
import json
import os
import re
from google import genai
from google.genai import types

MODEL = 'gemini-3-flash-preview'

SYSTEM_PROMPT = """You are an Amharic Bible text structurer. You receive pre-extracted text from a scanned Bible PDF.

The text uses layout markers:
  [TITLE]  = Book title or major heading
  [HEAD]   = Chapter heading (ምዕራፍ N) or section heading
  [VERSE]  = Regular verse/prose text
  [POETRY] = Indented/poetry text or footnotes
  [PARA]   = Paragraph break signal
  [PAGE N] = Page boundary

Verse numbers appear inline in the text as arabic numbers at the start of lines.

Your job: structure the text into chapters and verses as JSON.

Rules:
1. PRESERVE every Amharic character exactly — ሀ≠ሐ≠ኀ, ሰ≠ሠ, ጸ≠ፀ, አ≠ዐ
2. Identify chapter numbers from [HEAD] lines containing "ምዕራፍ N"
3. Extract verse numbers from inline numbers at start of verse text
4. Mark is_new_paragraph=true when [PARA] precedes a verse
5. Mark type="poetry" for lines from [POETRY] blocks inside chapters
6. Include subtitle_text from [HEAD] lines that are NOT chapter numbers (ምዕራፍ)
7. Merge split lines that belong to the same verse (continued text)
8. SKIP footnotes, cross-references, and introductory commentary (before chapter 1)
9. Return ONLY the JSON, no markdown fences

JSON format:
{
  "chapters": [
    {
      "chapter_number": 1,
      "sections": [
        {
          "type": "prose",
          "subtitle_text": "የዓለም አፈጣጠር",
          "subtitle_level": "section",
          "verses": [
            {
              "verse_number": 1,
              "text": "በመጀመሪያ እግዚአብሔር ሰማያትንና ምድርን ፈጠረ።",
              "is_new_paragraph": true,
              "indent": 0
            }
          ]
        }
      ]
    }
  ]
}"""


def call_gemini(prompt: str, api_key: str) -> dict:
    client = genai.Client(api_key=api_key)

    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type='application/json',
            temperature=0,
        ),
    )

    text = response.text.strip()

    # Strip markdown fences if present
    if text.startswith('```'):
        lines = text.split('\n', 1)
        text = lines[1] if len(lines) > 1 else ''
        if text.endswith('```'):
            text = text[:-3]
    text = text.strip()

    # Remove invalid JSON control characters (keep \t \n \r)
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', ' ', text)

    parsed = json.loads(text)
    # Handle both {"chapters":[...]} and [...] responses
    if isinstance(parsed, list):
        return {"chapters": parsed}
    return parsed


def main():
    if len(sys.argv) < 3:
        print("Usage: python3 gemini-structure.py <book_name> <amharic_name>", file=sys.stderr)
        sys.exit(1)

    book_name = sys.argv[1]
    amharic_name = sys.argv[2]
    enriched_text = sys.stdin.read()

    api_key = os.environ.get('GEMINI_API_KEY', '')
    if not api_key:
        print("ERROR: GEMINI_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    prompt = f"""Structure the following pre-extracted text from {book_name} ({amharic_name}).
The text comes from PyMuPDF with layout markers. Extract ALL chapters and verses you see into JSON.

EXTRACTED TEXT:
{enriched_text}"""

    result = call_gemini(prompt, api_key)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
