/**
 * A year in Roman numerals, set in the Unicode Roman-numeral letterforms the
 * masthead uses (Ⅿ Ⅾ Ⅽ Ⅼ Ⅹ Ⅴ Ⅰ) rather than plain Latin capitals.
 */
export function romanYear(year: number): string {
  if (!Number.isInteger(year) || year < 1 || year > 3999) return String(year);
  const table: Array<[number, string]> = [
    [1000, 'Ⅿ'], [900, 'ⅭⅯ'], [500, 'Ⅾ'], [400, 'ⅭⅮ'],
    [100, 'Ⅽ'], [90, 'ⅩⅭ'], [50, 'Ⅼ'], [40, 'ⅩⅬ'],
    [10, 'Ⅹ'], [9, 'ⅠⅩ'], [5, 'Ⅴ'], [4, 'ⅠⅤ'], [1, 'Ⅰ'],
  ];
  let n = year, out = '';
  for (const [value, glyph] of table) {
    while (n >= value) { out += glyph; n -= value; }
  }
  return out;
}
