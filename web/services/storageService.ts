import { Bookmark, ChatSession, UserProfile } from '../types';

const STORAGE_KEY_BOOKMARKS = 'mekra_bookmarks';
const STORAGE_KEY_SESSIONS = 'mekra_chat_sessions';
const STORAGE_KEY_PROFILE = 'mekra_user_profile';

// --- BOOKMARKS ---
export const getBookmarks = (): Bookmark[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_BOOKMARKS);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Failed to load bookmarks", e);
    return [];
  }
};

export const saveBookmark = (bookmark: Omit<Bookmark, 'id' | 'date'>) => {
  try {
    const current = getBookmarks();
    const newBookmark: Bookmark = {
      ...bookmark,
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    };
    
    // Check if already exists (simple check based on content match)
    const exists = current.some(b => b.content === bookmark.content);
    if (exists) return;

    const updated = [newBookmark, ...current];
    localStorage.setItem(STORAGE_KEY_BOOKMARKS, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save bookmark", e);
  }
};

export const removeBookmark = (id: string) => {
  try {
    const current = getBookmarks();
    const updated = current.filter(b => b.id !== id);
    localStorage.setItem(STORAGE_KEY_BOOKMARKS, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to remove bookmark", e);
  }
};

export const isBookmarked = (content: string): boolean => {
  const current = getBookmarks();
  return current.some(b => b.content === content);
};

// --- CHAT SESSIONS ---
export const getChatSessions = (): ChatSession[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SESSIONS);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

export const saveChatSession = (session: ChatSession) => {
  try {
    const sessions = getChatSessions();
    const existingIndex = sessions.findIndex(s => s.id === session.id);
    
    let updatedSessions;
    if (existingIndex >= 0) {
      updatedSessions = [...sessions];
      updatedSessions[existingIndex] = session;
    } else {
      updatedSessions = [session, ...sessions];
    }
    
    // Limit to 50 sessions to save space
    if (updatedSessions.length > 50) updatedSessions.pop();

    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(updatedSessions));
  } catch (e) {
    console.error("Failed to save session", e);
  }
};

export const deleteChatSession = (id: string) => {
  try {
    const sessions = getChatSessions();
    const updated = sessions.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to delete session", e);
  }
};

// --- USER PROFILE ---
export const getUserProfile = (): UserProfile | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PROFILE);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
};

export const saveUserProfile = (profile: UserProfile) => {
  try {
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
  } catch (e) {
    console.error("Failed to save profile", e);
  }
};

// --- LAST-READ POSITION ---
// Where the reader was last open, so the app can resume there instead of
// always starting at John 1. New key, so it carries the app's current name;
// the older mekra_* keys above keep theirs because renaming them would
// discard what people have already saved.
const STORAGE_KEY_LAST_READ = 'emmaus_last_read';

export interface LastRead {
  book: string;        // English name, as in the books table — stable across sessions
  amharicName: string;
  chapter: number;
}

export const getLastRead = (): LastRead | null => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_LAST_READ) || 'null');
    if (stored && typeof stored.book === 'string' && Number.isInteger(stored.chapter) && stored.chapter > 0) {
      return { book: stored.book, amharicName: String(stored.amharicName ?? ''), chapter: stored.chapter };
    }
    return null;
  } catch {
    return null;
  }
};

export const saveLastRead = (position: LastRead): void => {
  try {
    localStorage.setItem(STORAGE_KEY_LAST_READ, JSON.stringify(position));
  } catch { /* full or private mode — resuming is a convenience */ }
};
