/**
 * readings.ts — daily Mass readings for both rites.
 *
 * GET /api/readings/:date (YYYY-MM-DD or "today")
 *   → { date, roman: { liturgical, readings }, geez: { liturgical, readings } }
 *
 * Layered data strategy (accuracy first):
 *   1. liturgical CONTEXT is always computed locally (server/liturgical.ts)
 *      — season, week, cycles, feasts, Ethiopian date, fasting. Never AI.
 *   2. READINGS come from the daily_readings table when a row exists
 *      (verified rows are the goal — the priest/admin can correct any day).
 *   3. If no row and GEMINI_API_KEY is set, the server asks Gemini (with
 *      Google-Search grounding) for the day's readings, parses the
 *      citations, and stores them flagged source='ai', verified=false.
 *      The UI shows an "unverified" marker until a human confirms.
 *
 * PUT /api/readings/:date  { rite, celebration?, readings: [...] }
 *   → upserts a verified row (admin/priest correction path).
 */

import { db } from '../../services/db';
import { sql } from 'drizzle-orm';
import { romanDay, geezDay } from '../liturgical';

// ---------- table ----------
let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS daily_readings (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      rite VARCHAR(10) NOT NULL,          -- 'roman' | 'geez'
      celebration TEXT,
      readings JSONB NOT NULL,            -- [{type,label,labelAm,citation,book,chapter,verses}]
      source VARCHAR(20) NOT NULL DEFAULT 'manual',
      verified BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(date, rite)
    )`);
  tableReady = true;
}

// ---------- citation parsing ----------
const BOOK_ALIASES: Record<string, string> = {
  'genesis': 'Genesis', 'gen': 'Genesis', 'exodus': 'Exodus', 'ex': 'Exodus',
  'leviticus': 'Leviticus', 'lev': 'Leviticus', 'numbers': 'Numbers', 'num': 'Numbers',
  'deuteronomy': 'Deuteronomy', 'deut': 'Deuteronomy', 'dt': 'Deuteronomy',
  'joshua': 'Joshua', 'jos': 'Joshua', 'judges': 'Judges', 'jgs': 'Judges', 'ruth': 'Ruth',
  '1 samuel': '1 Samuel', '1 sm': '1 Samuel', '2 samuel': '2 Samuel', '2 sm': '2 Samuel',
  '1 kings': '1 Kings', '1 kgs': '1 Kings', '2 kings': '2 Kings', '2 kgs': '2 Kings',
  '1 chronicles': '1 Chronicles', '1 chr': '1 Chronicles', '2 chronicles': '2 Chronicles', '2 chr': '2 Chronicles',
  'ezra': 'Ezra', 'nehemiah': 'Nehemiah', 'neh': 'Nehemiah', 'tobit': 'Tobit', 'tb': 'Tobit',
  'judith': 'Judith', 'jdt': 'Judith', 'esther': 'Esther', 'est': 'Esther',
  '1 maccabees': '1 Maccabees', '1 mc': '1 Maccabees', '2 maccabees': '2 Maccabees', '2 mc': '2 Maccabees',
  'job': 'Job', 'jb': 'Job',
  'psalm': 'Psalms', 'psalms': 'Psalms', 'ps': 'Psalms',
  'proverbs': 'Proverbs', 'prv': 'Proverbs', 'ecclesiastes': 'Ecclesiastes', 'eccl': 'Ecclesiastes',
  'song of songs': 'Song of Songs', 'song of solomon': 'Song of Songs', 'sg': 'Song of Songs',
  'wisdom': 'Wisdom', 'wis': 'Wisdom', 'sirach': 'Sirach', 'sir': 'Sirach', 'ecclesiasticus': 'Sirach',
  'isaiah': 'Isaiah', 'is': 'Isaiah', 'isa': 'Isaiah',
  'jeremiah': 'Jeremiah', 'jer': 'Jeremiah', 'lamentations': 'Lamentations', 'lam': 'Lamentations',
  'baruch': 'Baruch', 'bar': 'Baruch', 'ezekiel': 'Ezekiel', 'ez': 'Ezekiel', 'ezk': 'Ezekiel',
  'daniel': 'Daniel', 'dn': 'Daniel', 'hosea': 'Hosea', 'hos': 'Hosea', 'joel': 'Joel', 'jl': 'Joel',
  'amos': 'Amos', 'am': 'Amos', 'obadiah': 'Obadiah', 'ob': 'Obadiah', 'jonah': 'Jonah', 'jon': 'Jonah',
  'micah': 'Micah', 'mi': 'Micah', 'nahum': 'Nahum', 'na': 'Nahum',
  'habakkuk': 'Habakkuk', 'hb': 'Habakkuk', 'zephaniah': 'Zephaniah', 'zep': 'Zephaniah',
  'haggai': 'Haggai', 'hg': 'Haggai', 'zechariah': 'Zechariah', 'zec': 'Zechariah',
  'malachi': 'Malachi', 'mal': 'Malachi',
  'matthew': 'Matthew', 'mt': 'Matthew', 'mark': 'Mark', 'mk': 'Mark',
  'luke': 'Luke', 'lk': 'Luke', 'john': 'John', 'jn': 'John',
  'acts': 'Acts', 'acts of the apostles': 'Acts',
  'romans': 'Romans', 'rom': 'Romans',
  '1 corinthians': '1 Corinthians', '1 cor': '1 Corinthians', '2 corinthians': '2 Corinthians', '2 cor': '2 Corinthians',
  'galatians': 'Galatians', 'gal': 'Galatians', 'ephesians': 'Ephesians', 'eph': 'Ephesians',
  'philippians': 'Philippians', 'phil': 'Philippians', 'colossians': 'Colossians', 'col': 'Colossians',
  '1 thessalonians': '1 Thessalonians', '1 thes': '1 Thessalonians', '2 thessalonians': '2 Thessalonians', '2 thes': '2 Thessalonians',
  '1 timothy': '1 Timothy', '1 tm': '1 Timothy', '2 timothy': '2 Timothy', '2 tm': '2 Timothy',
  'titus': 'Titus', 'ti': 'Titus', 'philemon': 'Philemon', 'phlm': 'Philemon',
  'hebrews': 'Hebrews', 'heb': 'Hebrews', 'james': 'James', 'jas': 'James',
  '1 peter': '1 Peter', '1 pt': '1 Peter', '2 peter': '2 Peter', '2 pt': '2 Peter',
  '1 john': '1 John', '1 jn': '1 John', '2 john': '2 John', '2 jn': '2 John', '3 john': '3 John', '3 jn': '3 John',
  'jude': 'Jude', 'revelation': 'Revelation', 'rv': 'Revelation', 'rev': 'Revelation', 'apocalypse': 'Revelation',
};

/** "Eph 2:19-22" → { book:'Ephesians', chapter:2, verses:'19-22' } (null if unparseable) */
export function parseCitation(citation: string): { book: string; chapter: number; verses?: string } | null {
  const m = citation.trim().match(/^([1-3]?\s?[A-Za-z .]+?)\s+(\d+)\s*[:,፥]\s*([\d\-–,ab ]+)/);
  if (!m) {
    const chapterOnly = citation.trim().match(/^([1-3]?\s?[A-Za-z .]+?)\s+(\d+)\s*$/);
    if (!chapterOnly) return null;
    const book = BOOK_ALIASES[chapterOnly[1].toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim()];
    return book ? { book, chapter: parseInt(chapterOnly[2], 10) } : null;
  }
  const key = m[1].toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
  const book = BOOK_ALIASES[key];
  if (!book) return null;
  const verses = m[3].replace(/–/g, '-').replace(/\s/g, '').replace(/[ab]/g, '');
  return { book, chapter: parseInt(m[2], 10), verses };
}

type Reading = {
  type: string; label: string; labelAm: string; citation: string;
  book?: string; chapter?: number; verses?: string;
};

const READING_LABELS: Record<string, [string, string]> = {
  first: ['First Reading', 'መጀመሪያ ንባብ'],
  psalm: ['Responsorial Psalm', 'መዝሙር'],
  second: ['Second Reading', 'ሁለተኛ ንባብ'],
  gospel: ['Gospel', 'ወንጌል'],
};

function structureReadings(raw: Array<{ type: string; citation: string }>): Reading[] {
  return raw.map(r => {
    const [label, labelAm] = READING_LABELS[r.type] ?? [r.type, r.type];
    const parsed = parseCitation(r.citation);
    return { type: r.type, label, labelAm, citation: r.citation, ...(parsed ?? {}) };
  });
}

// ---------- AI fallback (server-side Gemini with search grounding) ----------
async function aiLookupReadings(dateStr: string, rite: 'roman' | 'geez', context: string): Promise<{ celebration: string; readings: Array<{ type: string; citation: string }> } | null> {
  const key = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!key) return null;
  const what = rite === 'roman'
    ? `the official Roman Catholic daily Mass readings (per the USCCB / Universalis lectionary) for ${dateStr}`
    : `the Ethiopian Orthodox Tewahedo daily readings (ግጻዌ / Gitsawe lectionary) for ${dateStr} (${context})`;
  const prompt = `Find ${what}.
Respond with STRICT JSON only, no prose:
{"celebration":"<name of the liturgical day>","readings":[{"type":"first|psalm|second|gospel","citation":"<Book Chapter:Verses in English, e.g. Ephesians 2:19-22>"}]}
Rules: use standard English book names; omit "second" when the day has none; include the responsorial psalm as type "psalm".`;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
        }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? '';
    const start = text.indexOf('{'), end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed.readings) || parsed.readings.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ---------- handlers ----------
export async function getDailyReadings(dateStr: string) {
  try {
    await ensureTable();
    const date = dateStr === 'today' ? new Date() : new Date(dateStr + 'T00:00:00Z');
    if (isNaN(date.getTime())) return { success: false, error: 'invalid date' };
    const iso = date.toISOString().slice(0, 10);

    const roman = romanDay(new Date(iso + 'T00:00:00Z'));
    const geez = geezDay(new Date(iso + 'T00:00:00Z'));

    const rows: any = await db.execute(sql`
      SELECT rite, celebration, readings, source, verified
      FROM daily_readings WHERE date = ${iso}`);
    const byRite: Record<string, any> = {};
    for (const r of rows.rows ?? rows) byRite[r.rite] = r;

    // AI fallback for missing rites (stored so it only runs once per day)
    for (const rite of ['roman', 'geez'] as const) {
      if (byRite[rite]) continue;
      const context = rite === 'roman' ? roman.dayName : geez.ethDateAm;
      const ai = await aiLookupReadings(iso, rite, context);
      if (!ai) continue;
      const readings = structureReadings(ai.readings);
      await db.execute(sql`
        INSERT INTO daily_readings (date, rite, celebration, readings, source, verified)
        VALUES (${iso}, ${rite}, ${ai.celebration}, ${JSON.stringify(readings)}::jsonb, 'ai', false)
        ON CONFLICT (date, rite) DO NOTHING`);
      byRite[rite] = { rite, celebration: ai.celebration, readings, source: 'ai', verified: false };
    }

    const pack = (rite: 'roman' | 'geez') => {
      const row = byRite[rite];
      return row
        ? { celebration: row.celebration, readings: row.readings, source: row.source, verified: row.verified }
        : null;
    };

    return {
      success: true,
      data: {
        date: iso,
        roman: { liturgical: roman, ...(pack('roman') ?? { readings: null }) },
        geez: { liturgical: geez, ...(pack('geez') ?? { readings: null }) },
      },
    };
  } catch (e: any) {
    console.error('readings error:', e);
    return { success: false, error: e.message ?? 'readings failure' };
  }
}

export async function upsertDailyReadings(dateStr: string, body: any) {
  try {
    await ensureTable();
    const { rite, celebration, readings, verified = true, source = 'manual' } = body ?? {};
    if (!['roman', 'geez'].includes(rite) || !Array.isArray(readings))
      return { success: false, error: 'rite and readings[] required' };
    const structured = structureReadings(readings);
    await db.execute(sql`
      INSERT INTO daily_readings (date, rite, celebration, readings, source, verified)
      VALUES (${dateStr}, ${rite}, ${celebration ?? null}, ${JSON.stringify(structured)}::jsonb, ${source}, ${verified})
      ON CONFLICT (date, rite) DO UPDATE
      SET celebration = EXCLUDED.celebration, readings = EXCLUDED.readings,
          source = EXCLUDED.source, verified = EXCLUDED.verified`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? 'upsert failure' };
  }
}
