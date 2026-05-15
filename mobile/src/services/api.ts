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
  bible_refs?: string[];
  preview?: string;
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

/** Fetch a single wiki page by slug */
export async function fetchWikiPage(slug: string, type?: string): Promise<WikiPage | null> {
  const q = type ? `/wiki?slug=${slug}&type=${type}` : `/wiki?slug=${slug}`;
  return apiFetch<WikiPage>(q);
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
  return (await apiFetch<WikiPage[]>('/wiki?type=concepts')) ?? [];
}
