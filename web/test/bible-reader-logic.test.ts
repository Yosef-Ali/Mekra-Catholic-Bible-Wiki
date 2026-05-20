import { describe, it, expect } from 'vitest';

// Test the core logic extracted from BibleReader.tsx

interface FormattingRules {
  sections: Array<{ type: string; verseRange: [number, number]; indent?: number }>;
  hasPoetry: boolean;
  hasLists: boolean;
  primaryStyle: string;
  paragraphBreaks?: number[];
  subtitles?: Array<{ verse: number; text: string }>;
}

// Extracted from BibleReader.tsx:71-81
function getVerseFormatting(verseNumber: number, rules: FormattingRules | null): { type: string; indent: number } {
  if (!rules?.sections) return { type: 'prose', indent: 0 };
  for (const section of rules.sections) {
    const [start, end] = section.verseRange || [0, 0];
    if (verseNumber >= start && verseNumber <= end) {
      return { type: (section.type || 'prose').toLowerCase(), indent: section.indent || 0 };
    }
  }
  return { type: 'prose', indent: 0 };
}

// Extracted from BibleReader.tsx:337-339 — the O(1) verse lookup
function buildVerseIndexMap(content: Array<{ type: string; number: number }>): Map<number, number> {
  return new Map(
    content.filter(v => v.type === 'verse').map((v, i) => [v.number, i])
  );
}

describe('getVerseFormatting', () => {
  it('returns prose with no indent when rules are null', () => {
    expect(getVerseFormatting(1, null)).toEqual({ type: 'prose', indent: 0 });
  });

  it('returns correct section type for verse in range', () => {
    const rules: FormattingRules = {
      sections: [
        { type: 'poetry', verseRange: [1, 5], indent: 2 },
        { type: 'prose', verseRange: [6, 20] },
      ],
      hasPoetry: true,
      hasLists: false,
      primaryStyle: 'mixed',
    };
    expect(getVerseFormatting(3, rules)).toEqual({ type: 'poetry', indent: 2 });
    expect(getVerseFormatting(10, rules)).toEqual({ type: 'prose', indent: 0 });
  });

  it('falls back to prose for verse outside all ranges', () => {
    const rules: FormattingRules = {
      sections: [{ type: 'poetry', verseRange: [1, 5] }],
      hasPoetry: true,
      hasLists: false,
      primaryStyle: 'poetry',
    };
    expect(getVerseFormatting(99, rules)).toEqual({ type: 'prose', indent: 0 });
  });

  it('normalizes section type to lowercase', () => {
    const rules: FormattingRules = {
      sections: [{ type: 'Poetry', verseRange: [1, 10] }],
      hasPoetry: true,
      hasLists: false,
      primaryStyle: 'poetry',
    };
    expect(getVerseFormatting(5, rules)).toEqual({ type: 'poetry', indent: 0 });
  });
});

describe('buildVerseIndexMap (O(1) lookup)', () => {
  it('builds correct index map from mixed content', () => {
    const content = [
      { type: 'header', number: 0 },
      { type: 'subtitle', number: 1 },
      { type: 'verse', number: 1 },
      { type: 'verse', number: 2 },
      { type: 'verse', number: 3 },
    ];
    const map = buildVerseIndexMap(content);
    // Only verses are indexed, 0-based among verse-type items
    expect(map.get(1)).toBe(0);
    expect(map.get(2)).toBe(1);
    expect(map.get(3)).toBe(2);
    expect(map.has(0)).toBe(false); // header has number 0 but type 'header'
  });

  it('returns undefined for missing verse numbers', () => {
    const content = [
      { type: 'verse', number: 1 },
      { type: 'verse', number: 3 },
    ];
    const map = buildVerseIndexMap(content);
    expect(map.get(2)).toBeUndefined();
  });

  it('handles empty content', () => {
    const map = buildVerseIndexMap([]);
    expect(map.size).toBe(0);
  });

  it('correctly uses fallback for audio highlighting', () => {
    const content = [
      { type: 'header', number: 0 },
      { type: 'verse', number: 1 },
      { type: 'verse', number: 2 },
    ];
    const map = buildVerseIndexMap(content);
    // This is the pattern from BibleReader.tsx:368
    const verseIdx = map.get(99) ?? -1;
    expect(verseIdx).toBe(-1);
    // Existing verse
    const existingIdx = map.get(1) ?? -1;
    expect(existingIdx).toBe(0);
  });
});
