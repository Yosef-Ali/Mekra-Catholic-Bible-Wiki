/**
 * Pull plain verses out of a stored chapter.
 *
 * Chapter content comes back from the API in one of three shapes (the same
 * three the readers handle): { sections: [{ verses: [...] }] }, a flat array
 * of verse objects, or either of those as a JSON string.
 */
export interface PlainVerse { number: number; text: string }

// A leading Geʽez numeral is the verse number repeated inside the text; the
// readers render the number separately, so it is stripped here too.
const stripNumeral = (text: string) => (text || '').replace(/^[፩-፼]+/, '').trim();

export function extractVerses(content: unknown): PlainVerse[] {
  let raw: any = content;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return []; }
  }
  if (!raw) return [];

  const rows: any[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw.sections)
      ? raw.sections.flatMap((s: any) => (Array.isArray(s?.verses) ? s.verses : []))
      : [];

  return rows
    .map((v) => ({ number: Number(v?.verse_number ?? v?.number ?? 0), text: stripNumeral(String(v?.text ?? '')) }))
    .filter((v) => v.number > 0 && v.text.length > 0);
}

/** First verse number named by a range string: "13-17" → 13, "4, 9" → 4. */
export function firstVerseOfRange(verses?: string | null): number | null {
  const match = /\d+/.exec(verses ?? '');
  return match ? parseInt(match[0], 10) : null;
}

/**
 * The verse a reading opens with — the first verse of its range, or the
 * chapter's first verse when the citation names no verses. Null when the
 * chapter does not contain it: better no verse than the wrong one.
 */
export function pickVerse(content: unknown, verses?: string | null): PlainVerse | null {
  const all = extractVerses(content);
  if (all.length === 0) return null;
  const wanted = firstVerseOfRange(verses);
  if (wanted === null) return all[0];
  return all.find((v) => v.number === wanted) ?? null;
}
