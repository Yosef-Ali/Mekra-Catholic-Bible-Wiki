/**
 * Formatting Rules Types
 *
 * These define the structure for storing chapter formatting metadata
 * in the database. This allows us to preserve exact formatting information
 * (poetry, lists, footnotes) without re-analyzing every time.
 */

export interface VerseRange {
  start: number;
  end: number;
}

export type SectionType = 'prose' | 'poetry' | 'list' | 'footnote' | 'title';
export type ListType = 'numbered' | 'bulleted' | 'genealogy' | 'commandments';

export interface FormattingSection {
  type: SectionType;
  verseRange: [number, number]; // [start, end] inclusive
  indent?: number; // For poetry: 0=main line, 1=first indent, 2=second indent
  title?: string; // Optional section heading
  listType?: ListType; // If type is 'list'
}

export interface Footnote {
  verseRef: string; // e.g., "3:15" or "3:15-16"
  marker: string; // e.g., "*", "†", "1", "a"
  text: string; // The footnote content
}

export interface ListSection {
  verseRange: [number, number];
  listType: ListType;
  numbered?: boolean; // Whether items are numbered
}

/**
 * Complete formatting rules for a chapter
 */
export interface FormattingRules {
  sections: FormattingSection[];
  footnotes?: Footnote[];
  lists?: ListSection[];

  // Quick lookup metadata
  hasPoetry: boolean;
  hasLists: boolean;
  hasFootnotes: boolean;
  primaryStyle: 'prose' | 'poetry' | 'mixed';
}

/**
 * Helper function to get formatting for a specific verse
 */
export function getVerseFormatting(
  rules: FormattingRules,
  verseNumber: number
): FormattingSection | null {
  for (const section of rules.sections) {
    const [start, end] = section.verseRange;
    if (verseNumber >= start && verseNumber <= end) {
      return section;
    }
  }
  return null;
}

/**
 * Helper to check if a verse is poetry
 */
export function isPoetryVerse(rules: FormattingRules, verseNumber: number): boolean {
  const format = getVerseFormatting(rules, verseNumber);
  return format?.type === 'poetry';
}

/**
 * Helper to get footnotes for a verse
 */
export function getVerseFootnotes(
  rules: FormattingRules,
  verseNumber: number
): Footnote[] {
  if (!rules.footnotes) return [];

  return rules.footnotes.filter(fn => {
    // Handle single verse: "3:15"
    if (fn.verseRef.includes('-')) {
      const [start, end] = fn.verseRef.split(':')[1].split('-').map(Number);
      return verseNumber >= start && verseNumber <= end;
    } else {
      const refVerse = parseInt(fn.verseRef.split(':')[1]);
      return refVerse === verseNumber;
    }
  });
}
