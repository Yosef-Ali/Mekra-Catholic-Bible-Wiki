/**
 * Helpers for detecting and stripping leading verse-number leaks in
 * extracted Amharic Bible verse text. Three numeral systems can leak from
 * the OCR pass: Ge'ez (፩ ፪ ፫ … ፼), superscript (¹²³⁴⁵⁶⁷⁸⁹⁰), and ASCII (1 2 3).
 */

const GEEZ_DIGIT_VAL: Record<string, number> = {
  '፩':1,'፪':2,'፫':3,'፬':4,'፭':5,'፮':6,'፯':7,'፰':8,'፱':9,
  '፲':10,'፳':20,'፴':30,'፵':40,'፶':50,'፷':60,'፸':70,'፹':80,'፺':90,
  '፻':100,'፼':10000,
};

const SUP_DIGIT_VAL: Record<string, number> = {
  '\u2070':0,'\u00B9':1,'\u00B2':2,'\u00B3':3,
  '\u2074':4,'\u2075':5,'\u2076':6,'\u2077':7,'\u2078':8,'\u2079':9,
};

// Match leading run of: Ge'ez numerals OR superscript digits OR ASCII digits.
export const LEADING_NUMERAL_RE =
  /^\s*([\u1369-\u137C]+|[\u00B2\u00B3\u00B9\u2070\u2074-\u2079]+|\d+)\s*/;

const SUP_ONLY_RE = /^[\u00B2\u00B3\u00B9\u2070\u2074-\u2079]+$/;

function geezToInt(s: string): number {
  // Verse numbers are small (≤180) so simple summation suffices; positional
  // ፻/፼ multipliers don't apply at this scale.
  let n = 0;
  for (const c of s) n += GEEZ_DIGIT_VAL[c] ?? 0;
  return n;
}

function supToInt(s: string): number {
  // Positional like ASCII: "¹⁰" → 10.
  let n = 0;
  for (const c of s) {
    const d = SUP_DIGIT_VAL[c];
    if (d == null) return NaN;
    n = n * 10 + d;
  }
  return n;
}

/**
 * Decimal value of any leading numeral run, or null if the text doesn't
 * start with one. Caller compares against the expected verse number to
 * decide whether to strip.
 */
export function leadingNumeralValue(text: string): number | null {
  const m = text.match(LEADING_NUMERAL_RE);
  if (!m) return null;
  const tok = m[1];
  if (/^\d+$/.test(tok)) return parseInt(tok, 10);
  if (SUP_ONLY_RE.test(tok)) return supToInt(tok);
  return geezToInt(tok);
}

/**
 * Strip a leading numeral from `text` only if it equals `verseNumber`.
 * Preserves legitimate scripture cross-references like "1ቆሮ. 13:13".
 */
export function stripLeadingVerseNumber(text: string, verseNumber: number): string {
  const m = text.match(LEADING_NUMERAL_RE);
  if (!m) return text;
  const val = leadingNumeralValue(text);
  if (val !== verseNumber) return text;
  return text.slice(m[0].length);
}
