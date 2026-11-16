import { describe, it, expect } from 'vitest';
import { extractVerses, firstVerseOfRange, pickVerse } from '../services/verseText';

const sectioned = {
  sections: [
    { title: 'x', verses: [{ verse_number: 1, text: '፩በመጀመሪያ ቃል ነበረ' }, { verse_number: 2, text: 'ይህ በመጀመሪያ' }] },
    { verses: [{ verse_number: 13, text: 'ከሰማይ ከወረደው' }, { verse_number: 14, text: 'ሙሴ በምድረ በዳ' }] },
  ],
};

describe('extractVerses', () => {
  it('reads the sectioned shape and strips a leading Geʽez numeral', () => {
    const v = extractVerses(sectioned);
    expect(v.map((x) => x.number)).toEqual([1, 2, 13, 14]);
    expect(v[0].text).toBe('በመጀመሪያ ቃል ነበረ');
  });

  it('reads a flat array and a JSON string', () => {
    expect(extractVerses([{ number: 3, text: 'ሦስት' }])).toEqual([{ number: 3, text: 'ሦስት' }]);
    expect(extractVerses(JSON.stringify(sectioned))).toHaveLength(4);
  });

  it('returns nothing for content it cannot read, rather than guessing', () => {
    expect(extractVerses(null)).toEqual([]);
    expect(extractVerses('plain prose, not JSON')).toEqual([]);
    expect(extractVerses({ sections: [{ verses: [{ verse_number: 0, text: 'heading' }, { verse_number: 5, text: '' }] }] })).toEqual([]);
  });
});

describe('firstVerseOfRange', () => {
  it('takes the opening verse of a range or list', () => {
    expect(firstVerseOfRange('13-17')).toBe(13);
    expect(firstVerseOfRange('4, 9')).toBe(4);
    expect(firstVerseOfRange('19')).toBe(19);
    expect(firstVerseOfRange(undefined)).toBeNull();
    expect(firstVerseOfRange('')).toBeNull();
  });
});

describe('pickVerse', () => {
  it('returns the verse the reading opens with', () => {
    expect(pickVerse(sectioned, '13-17')).toEqual({ number: 13, text: 'ከሰማይ ከወረደው' });
  });

  it('falls back to the first verse only when no verses were cited', () => {
    expect(pickVerse(sectioned, undefined)?.number).toBe(1);
  });

  it('returns null when the cited verse is not in the chapter — never a different verse', () => {
    expect(pickVerse(sectioned, '40-42')).toBeNull();
    expect(pickVerse({ sections: [] }, '1')).toBeNull();
  });
});
