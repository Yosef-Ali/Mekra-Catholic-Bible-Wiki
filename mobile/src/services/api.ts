/**
 * Emmaus API client — talks to the web app's Express backend.
 *
 * The backend runs at the Vite dev server (same origin in dev),
 * or a deployed URL in production.
 *
 * For native (Expo Go on phone), we use expo-constants to
 * auto-detect the LAN IP the phone is already talking to.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

function getDevHost(): string {
  if (Platform.OS === 'web') return 'localhost';

  // Expo Go sets hostUri to "192.168.x.x:8085" — grab the IP part.
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip) return ip;
  }

  // Fallback to LAN IP
  return '192.168.1.3';
}

const DEV_HOST = getDevHost();

const API_BASE = __DEV__
  ? `http://${DEV_HOST}:5173/api`
  : 'https://mekra.app/api'; // TODO: set production URL

// Log the resolved API base so we can debug connection issues
if (__DEV__) {
  console.log(`[Emmaus API] base = ${API_BASE} (platform: ${Platform.OS})`);
}

export interface WikiPage {
  page_type: string;
  slug: string;
  title_en: string;
  title_am: string | null;
  compendium_q: string | null;
  sources: string | null;
  bible_ref_count: number;
  wiki_updated_at: string | null;
  // full page only:
  frontmatter?: Record<string, string>;
  body_md?: string;
  links?: string[];
  bible_refs?: BibleRef[];
  preview?: string;
}

/** A scripture reference attached to a wiki page. */
export interface BibleRef {
  book: string;
  chapter: number;
  verses: string;
}

/** A single rendered line in the Bible reader. */
export interface DisplayVerse {
  type: 'verse' | 'header' | 'subtitle';
  number: number;
  text: string;
  isNewParagraph?: boolean;
}

export interface ChapterContent {
  content: unknown;
  formattingRules: any | null;
}

export interface BibleBook {
  id: number;
  name: string;
  amharicName: string;
  chapters: number;
  section: 'OT' | 'NT' | 'Apocrypha';
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
  error?: string;
}

async function apiFetch<T>(path: string): Promise<T | null> {
  const url = `${API_BASE}${path}`;
  try {
    if (__DEV__) console.log(`[Emmaus API] GET ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
      if (__DEV__) console.warn(`[Emmaus API] ${res.status} from ${url}`);
      return null;
    }
    const json: ApiResponse<T> = await res.json();
    if (__DEV__) console.log(`[Emmaus API] OK ${path} — ${json.count ?? '?'} items`);
    return json.success ? json.data : null;
  } catch (e: unknown) {
    if (__DEV__) {
      console.warn(`[Emmaus API] FAILED ${url}`, e instanceof Error ? e.message : e);
    }
    return null;
  }
}

/** Fetch all teaching articles (slim list) */
export async function fetchTeachings(): Promise<WikiPage[]> {
  return (await apiFetch<WikiPage[]>('/wiki?type=teaching')) ?? [];
}

/**
 * Fetch a single wiki page by slug.
 *
 * `type` is an optional hint. Related-page links carry the *folder* name
 * (plural: `concepts`, `figures`, `places`, `themes`) while the DB stores the
 * singular `page_type` (`concept`, `figure`, ...), so a typed lookup can miss.
 * We try the typed lookup first (disambiguates slug collisions like
 * teaching/baptism vs comparative/baptism), then fall back to slug-only —
 * mirroring the web DesktopArticle, which fetches slug-only on purpose.
 * Slug is URI-encoded so Amharic-script slugs resolve.
 */
export async function fetchWikiPage(slug: string, type?: string): Promise<WikiPage | null> {
  const s = encodeURIComponent(slug);
  if (type) {
    const singular = type.replace(/s$/, '');
    const typed = await apiFetch<WikiPage>(`/wiki?slug=${s}&type=${encodeURIComponent(singular)}`);
    if (typed) return typed;
  }
  return apiFetch<WikiPage>(`/wiki?slug=${s}`);
}

/** Search wiki pages */
export async function searchWiki(query: string): Promise<WikiPage[]> {
  if (!query || query.length < 1) return [];
  return (await apiFetch<WikiPage[]>(`/wiki?search=${encodeURIComponent(query)}`)) ?? [];
}

/** Fetch all Bible books */
export async function fetchBooks(): Promise<BibleBook[]> {
  return (await apiFetch<BibleBook[]>('/books')) ?? [];
}

/** Fetch Bible books by section */
export async function fetchBooksBySection(section: 'OT' | 'NT' | 'Apocrypha'): Promise<BibleBook[]> {
  return (await apiFetch<BibleBook[]>(`/books/section/${section}`)) ?? [];
}

/** Fetch concept pages (glossary) */
export async function fetchConcepts(): Promise<WikiPage[]> {
  // DB page_type is singular ('concept'); the 'concepts' folder name won't match.
  return (await apiFetch<WikiPage[]>('/wiki?type=concept')) ?? [];
}

/** Fetch a single chapter's verse content from the database. */
export async function fetchChapterContent(
  bookId: number,
  chapter: number,
): Promise<ChapterContent | null> {
  const data = await apiFetch<{ content: unknown; formattingRules?: any }>(
    `/chapters/${bookId}/${chapter}`,
  );
  if (!data) return null;
  return { content: data.content, formattingRules: data.formattingRules ?? null };
}

/**
 * Parse raw chapter content into displayable verses.
 *
 * Handles the three shapes the backend can return:
 *   1. { sections: [{ title?, type?, verses: [{ verse_number, text, ... }] }] }
 *   2. an array of verse objects
 *   3. a plain string
 *
 * Strips any leading Ge'ez numeral prefix from verse text (the verse number
 * is rendered separately), matching the web reader.
 */
export function parseVerses(raw: unknown, rules: any | null): DisplayVerse[] {
  if (!raw) return [];
  const strip = (t: string) => (t || '').replace(/^[፩-፼]+/, '').trim();

  // Shape 1: structured sections
  if (typeof raw === 'object' && raw !== null && Array.isArray((raw as any).sections)) {
    const out: DisplayVerse[] = [];
    const paragraphBreaks: number[] = rules?.paragraphBreaks ?? [];
    const subtitleMap = new Map<number, string>(
      (rules?.subtitles ?? []).map((s: any) => [s.verse, s.text]),
    );
    for (const section of (raw as any).sections) {
      if (section.title) {
        out.push({ type: 'header', number: 0, text: section.title });
      }
      if (Array.isArray(section.verses)) {
        for (const v of section.verses) {
          const num = v.verse_number || v.number || 0;
          if (subtitleMap.has(num)) {
            out.push({ type: 'subtitle', number: num, text: subtitleMap.get(num)! });
          }
          out.push({
            type: 'verse',
            number: num,
            text: strip(v.text),
            isNewParagraph: paragraphBreaks.includes(num) || !!v.is_new_paragraph,
          });
        }
      }
    }
    return out;
  }

  // Shape 2: flat verse array
  if (Array.isArray(raw)) {
    return raw.map((v: any) => ({
      type: 'verse' as const,
      number: v.verse_number || v.number || 0,
      text: strip(v.text),
    }));
  }

  // Shape 3: plain string
  if (typeof raw === 'string') {
    return [{ type: 'verse', number: 1, text: raw }];
  }
  return [];
}

/**
 * Expand a verse-range string ("3", "3-12", "3,5,9") into a set of verse
 * numbers, used to highlight the verses a scripture link points at.
 */
export function parseVerseRange(verses?: string): Set<number> {
  const set = new Set<number>();
  if (!verses) return set;
  for (const part of verses.split(/[,;]/)) {
    const range = part.trim().match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (range) {
      const start = parseInt(range[1], 10);
      const end = parseInt(range[2], 10);
      for (let n = start; n <= end; n++) set.add(n);
    } else {
      const single = parseInt(part.trim(), 10);
      if (!Number.isNaN(single)) set.add(single);
    }
  }
  return set;
}

/**
 * Resolve a scripture-link book name (English or Amharic) to a loaded
 * BibleBook, mirroring the web reader's tolerant matching.
 */
export function matchBook(books: BibleBook[], name: string): BibleBook | undefined {
  const n = name.trim();
  return books.find(
    (b) =>
      b.name === n ||
      b.amharicName === n ||
      b.amharicName?.includes(n) ||
      b.name.toLowerCase() === n.toLowerCase(),
  );
}
