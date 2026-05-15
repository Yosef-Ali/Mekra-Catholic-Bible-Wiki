/**
 * Emmaus Wiki API Server
 *
 * Provides:
 *  - /api/wiki       — wiki page list, search, single page
 *  - /api/books      — Bible book list + sections
 *  - /api/ai/tts     — Text-to-Speech (Gemini Flash primary, Google Translate fallback)
 *  - /api/ai/read    — Smart article reader: fetches page, extracts readable content, returns audio
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { getAllAudioBase64 } from 'google-tts-api';
import { readFileSync, existsSync } from 'node:fs';

// ── Env ─────────────────────────────────────────────────────

dotenv.config();
dotenv.config({ path: '../.env' });

// Fallback: read secrets from old Mekra project .env
const LEGACY_ENV = '/Users/mekdesyared/Mekra-Catholic-Bible/.env';
if (existsSync(LEGACY_ENV)) {
  for (const line of readFileSync(LEGACY_ENV, 'utf8').split('\n')) {
    const m = line.match(/^(DATABASE_URL|GEMINI_API_KEY)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }
}

const sql = neon(process.env.DATABASE_URL);
const PORT = process.env.PORT || 5173;

// ── Gemini TTS setup ────────────────────────────────────────

let GoogleGenAI = null;
let gemini = null;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
try {
  ({ GoogleGenAI } = await import('@google/genai'));
  if (GEMINI_KEY) {
    gemini = new GoogleGenAI({ apiKey: GEMINI_KEY });
    console.log('  ✓ Gemini TTS enabled (server key)');
  } else {
    console.log('  ⚠ No server GEMINI_API_KEY — clients can provide their own');
  }
} catch {
  console.log('  ⚠ @google/genai not available — Google Translate TTS only');
}

/** Get a Gemini client — uses client-provided key if given, else server key */
function getGemini(clientKey) {
  if (clientKey && GoogleGenAI) return new GoogleGenAI({ apiKey: clientKey });
  return gemini;
}

// WAV header for raw PCM (24kHz, 16-bit, mono)
function wavHeader(pcmBytes) {
  const buf = Buffer.alloc(44);
  const total = pcmBytes + 36;
  buf.write('RIFF', 0);
  buf.writeUInt32LE(total, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);       // chunk size
  buf.writeUInt16LE(1, 20);        // PCM
  buf.writeUInt16LE(1, 22);        // mono
  buf.writeUInt32LE(24000, 24);    // sample rate
  buf.writeUInt32LE(48000, 28);    // byte rate (24000 * 2)
  buf.writeUInt16LE(2, 32);        // block align
  buf.writeUInt16LE(16, 34);       // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(pcmBytes, 40);
  return buf;
}

// Generate audio via Gemini TTS
async function geminiTTS(text, voice = 'Charon', client = gemini) {
  const response = await client.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        languageCode: 'am',
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  });

  const b64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) throw new Error('Gemini returned no audio');
  const pcm = Buffer.from(b64, 'base64');
  return Buffer.concat([wavHeader(pcm.length), pcm]);
}

// Fallback: Google Translate TTS
async function translateTTS(text, lang = 'am') {
  const results = await getAllAudioBase64(text, {
    lang,
    slow: false,
    host: 'https://translate.google.com',
    splitPunct: '።፣፤',
  });
  return Buffer.concat(results.map((r) => Buffer.from(r.base64, 'base64')));
}

// ── Content extraction — pull readable text from wiki markdown ──

function extractReadableContent(bodyMd, titleAm, titleEn) {
  const parts = [];

  // Start with title
  if (titleAm) parts.push(titleAm);
  if (titleEn) parts.push(titleEn);

  const lines = bodyMd.split('\n');
  for (const raw of lines) {
    const line = raw.trim();

    // Skip empty
    if (!line) continue;

    // Skip title (already added)
    if (line.startsWith('# ')) continue;

    // Skip frontmatter metadata: **Part:** IV, **CCC:** 1234, etc.
    if (/^\*\*(?:Type|Amharic|English|Part|Role|Compendium Q|CCC|Sources|Last updated|Related):\*\*/.test(line)) continue;

    // Skip CCC reference lines: [CCC 1213-1216]
    if (/^\[CCC\s[\d,\s–-]+\]\s*$/.test(line)) continue;

    // Skip source/reference bullets: - `raw/...`, - Compendium of...
    if (/^- `raw\//.test(line) || /^- Compendium of/.test(line) || /^- Catechism of/.test(line)) continue;

    // Skip placeholder lines: *(To be written...)*
    if (/^\*\(.*?\)\*\s*$/.test(line)) continue;

    // Skip stub sections
    if (/^##\s+(Sources|Open questions)\s*$/.test(line)) continue;

    // Section headings → read as transition
    if (line.startsWith('## ')) {
      parts.push(line.replace(/^##\s+/, ''));
      continue;
    }
    if (line.startsWith('### ')) {
      parts.push(line.replace(/^###\s+/, ''));
      continue;
    }

    // Q&A lines — keep the text, strip the bold markers
    // **Q:** question → question
    // **A:** answer → answer
    let cleaned = line
      .replace(/^\*\*Q:\*\*\s*/, '')
      .replace(/^\*\*A:\*\*\s*/, '');

    // Blockquote — strip > prefix
    cleaned = cleaned.replace(/^>\s*/, '');

    // Bullet — strip - prefix
    cleaned = cleaned.replace(/^[-*]\s+/, '');

    // Strip remaining markdown: bold, italic, wiki links
    cleaned = cleaned
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\[\[([^\]]+)\]\]/g, (_, link) => {
        const p = link.split('/');
        return p[p.length - 1].replace(/-/g, ' ');
      })
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/<\/?p>/g, '')
      .replace(/\s*#\s*\d+\s*$/g, '')  // trailing OCR numbers
      .trim();

    if (cleaned.length > 2) parts.push(cleaned);
  }

  return parts.join('\n\n');
}

// ── App ─────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ── Health ──

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    tts: {
      serverGemini: !!gemini,
      clientGeminiSupported: !!GoogleGenAI,
      fallback: 'google-translate',
    },
  });
});

// ── Wiki ────────────────────────────────────────────────────

app.get('/api/wiki', async (req, res) => {
  try {
    const { type, slug, search, limit: rawLimit } = req.query;
    const limit = Math.min(parseInt(rawLimit ?? '500', 10), 1000);

    if (slug) {
      const conds = [`slug = $1`];
      const params = [slug];
      if (type) { conds.push(`page_type = $2`); params.push(type); }
      const rows = await sql(`
        SELECT page_type, slug, title_en, title_am,
               frontmatter, body_md, links, bible_refs,
               source_path, wiki_updated_at, synced_at
        FROM wiki_pages WHERE ${conds.join(' AND ')} LIMIT 1
      `, params);
      if (rows.length === 0) return res.status(404).json({ success: false, error: 'Page not found' });
      return res.json({ success: true, data: rows[0] });
    }

    if (search) {
      const q = `%${search}%`;
      const rows = await sql(`
        SELECT page_type, slug, title_en, title_am,
               frontmatter->>'compendium_q' AS compendium_q,
               frontmatter->>'sources' AS sources,
               jsonb_array_length(bible_refs) AS bible_ref_count,
               wiki_updated_at,
               LEFT(body_md, 300) AS preview
        FROM wiki_pages
        WHERE title_en ILIKE $1 OR title_am ILIKE $1 OR body_md ILIKE $1
        ORDER BY wiki_updated_at DESC NULLS LAST
        LIMIT 30
      `, [q]);
      return res.json({ success: true, data: rows, count: rows.length });
    }

    const typeFilter = type ? `WHERE page_type = $1` : '';
    const params = type ? [type] : [];
    const rows = await sql(`
      SELECT page_type, slug, title_en, title_am,
             frontmatter->>'compendium_q' AS compendium_q,
             frontmatter->>'sources' AS sources,
             jsonb_array_length(bible_refs) AS bible_ref_count,
             wiki_updated_at
      FROM wiki_pages ${typeFilter}
      ORDER BY NULLIF(regexp_replace(frontmatter->>'compendium_q', '\\D.*$', ''), '')::int NULLS LAST, slug
      LIMIT ${limit}
    `, params);
    return res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    console.error('wiki error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch wiki pages' });
  }
});

// ── Books ───────────────────────────────────────────────────

app.get('/api/books', async (_req, res) => {
  try {
    const rows = await sql`SELECT * FROM books ORDER BY id`;
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('books error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch books' });
  }
});

app.get('/api/books/section/:section', async (req, res) => {
  try {
    const { section } = req.params;
    if (!['OT', 'NT', 'Apocrypha'].includes(section)) {
      return res.status(400).json({ success: false, error: 'Invalid section' });
    }
    const rows = await sql`SELECT * FROM books WHERE section = ${section} ORDER BY id`;
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('books/section error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch books' });
  }
});

// ── TTS — raw text to speech ────────────────────────────────
// POST /api/ai/tts { text, lang?, voice?, apiKey?, provider? }

app.post('/api/ai/tts', async (req, res) => {
  const { text, lang, voice, apiKey, provider } = req.body || {};
  if (!text) return res.status(400).json({ success: false, error: 'Missing text' });

  const useTranslate = provider === 'translate';
  const gem = !useTranslate ? getGemini(apiKey) : null;

  try {
    if (gem) {
      try {
        const wav = await geminiTTS(text, voice || 'Charon', gem);
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Content-Length', wav.length.toString());
        return res.send(wav);
      } catch (gemErr) {
        console.warn('Gemini TTS failed, falling back to Google Translate:', gemErr.message);
        // If client explicitly asked for gemini, report the error
        if (provider === 'gemini') {
          return res.status(502).json({ success: false, error: 'Gemini TTS failed: ' + gemErr.message });
        }
      }
    }

    // Fallback: Google Translate
    const mp3 = await translateTTS(text, lang || 'am');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', mp3.length.toString());
    res.send(mp3);
  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Read Article — smart content extraction + TTS ───────────
// POST /api/ai/read { slug, type?, voice?, apiKey?, provider? }
// Returns audio of the article's readable content (skips metadata, CCC refs, sources)

app.post('/api/ai/read', async (req, res) => {
  const { slug, type, voice, text: rawText, apiKey, provider } = req.body || {};

  try {
    let readable;

    if (slug) {
      // Fetch article from DB
      const conds = [`slug = $1`];
      const params = [slug];
      if (type) { conds.push(`page_type = $2`); params.push(type); }
      const rows = await sql(`
        SELECT title_en, title_am, body_md
        FROM wiki_pages WHERE ${conds.join(' AND ')} LIMIT 1
      `, params);
      if (rows.length === 0) return res.status(404).json({ success: false, error: 'Page not found' });
      const page = rows[0];
      readable = extractReadableContent(page.body_md, page.title_am, page.title_en);
    } else if (rawText) {
      readable = rawText;
    } else {
      return res.status(400).json({ success: false, error: 'Provide slug or text' });
    }

    if (!readable || readable.length < 5) {
      return res.status(400).json({ success: false, error: 'No readable content' });
    }

    console.log(`[Read] ${slug || 'raw'}: ${readable.length} chars`);

    const useTranslate = provider === 'translate';
    const gem = !useTranslate ? getGemini(apiKey) : null;

    if (gem) {
      try {
        // Gemini TTS — 8192 token limit (~4000 chars safe). Chunk if needed.
        const CHUNK_SIZE = 4000;
        const pcmChunks = [];

        if (readable.length <= CHUNK_SIZE) {
          const wav = await geminiTTS(readable, voice || 'Charon', gem);
          res.setHeader('Content-Type', 'audio/wav');
          res.setHeader('Content-Length', wav.length.toString());
          return res.send(wav);
        }

        // Split on paragraph boundaries
        const paragraphs = readable.split('\n\n');
        let chunk = '';
        for (const para of paragraphs) {
          if (chunk.length + para.length > CHUNK_SIZE && chunk.length > 0) {
            const wav = await geminiTTS(chunk, voice || 'Charon', gem);
            pcmChunks.push(wav.subarray(44)); // strip WAV header, keep PCM
            chunk = para;
          } else {
            chunk += (chunk ? '\n\n' : '') + para;
          }
        }
        if (chunk) {
          const wav = await geminiTTS(chunk, voice || 'Charon', gem);
          pcmChunks.push(wav.subarray(44));
        }

        // Combine all PCM chunks with a single WAV header
        const allPcm = Buffer.concat(pcmChunks);
        const finalWav = Buffer.concat([wavHeader(allPcm.length), allPcm]);
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Content-Length', finalWav.length.toString());
        return res.send(finalWav);
      } catch (gemErr) {
        console.warn('[Read] Gemini TTS failed, falling back to Google Translate:', gemErr.message);
        if (provider === 'gemini') {
          return res.status(502).json({ success: false, error: 'Gemini TTS failed: ' + gemErr.message });
        }
      }
    }

    // Fallback: Google Translate (chunk into smaller pieces)
    const mp3Chunks = [];
    const lines = readable.split('\n\n');
    for (const line of lines) {
      if (line.trim().length < 3) continue;
      const mp3 = await translateTTS(line.trim());
      mp3Chunks.push(mp3);
    }
    const combined = Buffer.concat(mp3Chunks);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', combined.length.toString());
    res.send(combined);
  } catch (err) {
    console.error('Read error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Start ───────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  ✦ Emmaus Wiki API`);
  console.log(`    Health:  http://localhost:${PORT}/api/health`);
  console.log(`    Wiki:    http://localhost:${PORT}/api/wiki?type=teaching`);
  console.log(`    Books:   http://localhost:${PORT}/api/books`);
  console.log(`    TTS:     ${gemini ? 'Gemini Flash' : 'Google Translate'}\n`);
});
