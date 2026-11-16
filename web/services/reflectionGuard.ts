/**
 * Guard for the AI-written reflection.
 *
 * The reflection must never put words in Scripture's mouth. The model is told
 * not to quote, but it does not always obey: it will write Jesus' question to
 * the blind man in its own Amharic and wrap it in quotation marks, which reads
 * as a verse and is not the printed text.
 *
 * So a reflection is refused when it contains quoted speech: a span inside
 * quotation marks holding two or more Ethiopic words. A single quoted term
 * (“መሢሕ”) is allowed — that is naming a word, not quoting a passage.
 */
const OPEN = '“"«‹‘';
const CLOSE = '”"»›’';
const QUOTED_SPAN = new RegExp(`[${OPEN}]([^${OPEN}${CLOSE}]{1,600})[${CLOSE}]`, 'gu');
const ETHIOPIC_WORD = /[ሀ-᎟ⶀ-⷟]+/gu;

export function quotesSpeech(text: string | null | undefined): boolean {
  for (const match of (text ?? '').matchAll(QUOTED_SPAN)) {
    const words = match[1].match(ETHIOPIC_WORD);
    if (words && words.length >= 2) return true;
  }
  return false;
}
