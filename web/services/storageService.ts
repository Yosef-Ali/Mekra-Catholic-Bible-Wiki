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

// --- DAILY READINGS CACHE ---
const CACHE_KEY_DAILY_READINGS = 'mekra_daily_readings_cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedDailyReadings {
  data: any;
  timestamp: number;
  dateKey: string; // Format: "YYYY-MM-DD"
}

/**
 * Get the date key for cache comparison (today's date in YYYY-MM-DD format)
 */
const getTodayDateKey = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/**
 * Check if cached data is still valid (same day and not expired)
 */
export const isCacheValid = (cache: CachedDailyReadings | null): boolean => {
  if (!cache) return false;
  
  const now = Date.now();
  const todayKey = getTodayDateKey();
  
  // Cache is valid if it's for today AND within TTL
  return cache.dateKey === todayKey && (now - cache.timestamp) < CACHE_TTL_MS;
};

/**
 * Get cached daily readings from localStorage
 */
export const getCachedDailyReadings = (): CachedDailyReadings | null => {
  try {
    const stored = localStorage.getItem(CACHE_KEY_DAILY_READINGS);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (e) {
    console.error("Failed to load cached daily readings", e);
    return null;
  }
};

/**
 * Save daily readings to localStorage cache
 */
export const setCachedDailyReadings = (data: any): void => {
  try {
    const cache: CachedDailyReadings = {
      data,
      timestamp: Date.now(),
      dateKey: getTodayDateKey()
    };
    localStorage.setItem(CACHE_KEY_DAILY_READINGS, JSON.stringify(cache));
  } catch (e) {
    console.error("Failed to cache daily readings", e);
  }
};