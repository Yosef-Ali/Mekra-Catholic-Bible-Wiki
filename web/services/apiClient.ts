import { BibleBook } from '../types';

/**
 * API Client for frontend to communicate with backend
 * All database operations go through these API calls
 */

const API_BASE = '/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Books API
export const booksApi = {
  /**
   * Fetch all books from the database
   */
  async getAll(): Promise<BibleBook[]> {
    try {
      const response = await fetch(`${API_BASE}/books`);
      const result: ApiResponse<BibleBook[]> = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch books');
      }

      return result.data;
    } catch (error) {
      console.error('Error fetching books:', error);
      throw error;
    }
  },

  /**
   * Fetch a single book by ID
   */
  async getById(id: number): Promise<BibleBook> {
    try {
      const response = await fetch(`${API_BASE}/books/${id}`);
      const result: ApiResponse<BibleBook> = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch book');
      }

      return result.data;
    } catch (error) {
      console.error(`Error fetching book ${id}:`, error);
      throw error;
    }
  },

  /**
   * Fetch books by section (OT, NT, or Apocrypha)
   */
  async getBySection(section: 'OT' | 'NT' | 'Apocrypha'): Promise<BibleBook[]> {
    try {
      const response = await fetch(`${API_BASE}/books/section/${section}`);
      const result: ApiResponse<BibleBook[]> = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch books');
      }

      return result.data;
    } catch (error) {
      console.error(`Error fetching books for section ${section}:`, error);
      throw error;
    }
  },

  /**
   * Search books by name (English or Amharic)
   */
  async search(query: string): Promise<BibleBook[]> {
    try {
      const response = await fetch(`${API_BASE}/books/search?q=${encodeURIComponent(query)}`);
      const result: ApiResponse<BibleBook[]> = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to search books');
      }

      return result.data;
    } catch (error) {
      console.error(`Error searching books with query "${query}":`, error);
      throw error;
    }
  },
};

// Formatting rules interface
export interface FormattingRules {
  sections: Array<{
    type: 'prose' | 'poetry' | 'list' | 'footnote' | 'title';
    verseRange: [number, number];
    indent?: number;
    title?: string;
  }>;
  hasPoetry: boolean;
  hasLists: boolean;
  hasFootnotes: boolean;
  primaryStyle: 'prose' | 'poetry' | 'mixed';
}

// Chapters API
export const chaptersApi = {
  /**
   * Fetch chapter content from database
   */
  async getContent(bookId: number, chapterNumber: number): Promise<{
    content: string | any;
    fallbackToAI?: boolean;
    formattingRules?: FormattingRules;
  }> {
    try {
      console.log(`🌐 API Call: /api/chapters/${bookId}/${chapterNumber}`);
      const response = await fetch(`${API_BASE}/chapters/${bookId}/${chapterNumber}`);
      const result = await response.json();
      console.log('🌐 API Response:', {
        success: result.success,
        hasData: !!result.data,
        dataContent: typeof result.data?.content === 'string'
          ? result.data.content.substring(0, 100)
          : (Array.isArray(result.data?.content) ? `Array[${result.data.content.length}]` : typeof result.data?.content)
      });

      if (!result.success) {
        // Check if we should fallback to AI
        if (result.fallbackToAI) {
          return { content: '', fallbackToAI: true };
        }
        throw new Error(result.error || 'Failed to fetch chapter content');
      }

      // Extract content from data object
      const content = result.data?.content || '';
      const formattingRules = result.data?.formattingRules || null;
      return { content, fallbackToAI: false, formattingRules };
    } catch (error) {
      console.error(`❌ Error fetching chapter ${bookId}:${chapterNumber}:`, error);
      return { content: '', fallbackToAI: true };
    }
  },

  /**
   * Get all available chapters for a book
   */
  async getAvailableChapters(bookId: number): Promise<number[]> {
    try {
      const response = await fetch(`${API_BASE}/chapters/book/${bookId}`);
      const result: ApiResponse<{ chapterNumber: number }[]> = await response.json();

      if (!result.success || !result.data) {
        return [];
      }

      return result.data.map(ch => ch.chapterNumber);
    } catch (error) {
      console.error(`Error fetching available chapters for book ${bookId}:`, error);
      return [];
    }
  },

  /**
   * Update chapter content in database
   */
  async updateContent(bookId: number, chapterNumber: number, content: string | any): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/chapters/${bookId}/${chapterNumber}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      const result: ApiResponse<any> = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to update chapter content');
      }
    } catch (error) {
      console.error(`Error updating chapter ${bookId}:${chapterNumber}:`, error);
      throw error;
    }
  }
};

// AI API
export const aiApi = {
  /**
   * AI Proofreading
   */
  async proofread(content: string, bookName?: string, chapter?: number) {
    try {
      const response = await fetch(`${API_BASE}/ai/proofread`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, bookName, chapter })
      });
      return await response.json();
    } catch (error) {
      console.error('Proofreading error:', error);
      return { success: false, suggestions: [] };
    }
  },

  /**
   * OCR - Image to Text
   */
  async extractText(imageBase64: string, bookName?: string, chapter?: number) {
    try {
      const response = await fetch(`${API_BASE}/ai/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64, bookName, chapter })
      });
      return await response.json();
    } catch (error) {
      console.error('OCR error:', error);
      return { success: false, text: '' };
    }
  }
};

// Bulk Search API
export const bulkApi = {
  /**
   * Search all chapters for a pattern
   */
  async searchPattern(pattern: string) {
    try {
      const response = await fetch(`${API_BASE}/chapters/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern })
      });
      return await response.json();
    } catch (error) {
      console.error('Bulk search error:', error);
      return { success: false, matches: [] };
    }
  }
};

// Users API
export const usersApi = {
  /**
   * Sync Firebase user to database
   */
  async sync(userData: {
    firebaseUid: string;
    email: string | null;
    phoneNumber: string | null;
    displayName: string | null;
    photoUrl: string | null;
    authProvider: string;
  }) {
    try {
      const response = await fetch(`${API_BASE}/users/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      return await response.json();
    } catch (error) {
      console.error('User sync error:', error);
      return { success: false, error: 'Sync failed' };
    }
  },

  /**
   * Get all users (Admin only)
   */
  async getAll(firebaseUid: string) {
    try {
      const response = await fetch(`${API_BASE}/users`, {
        headers: {
          'Content-Type': 'application/json',
          'x-firebase-uid': firebaseUid // Simple auth check for now
        }
      });
      return await response.json();
    } catch (error) {
      console.error('Fetch users error:', error);
      return { success: false, users: [] };
    }
  },

  /**
   * Update user role (Admin only)
   */
  async updateRole(userId: number, role: 'user' | 'admin', firebaseUid: string) {
    try {
      const response = await fetch(`${API_BASE}/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-firebase-uid': firebaseUid
        },
        body: JSON.stringify({ role })
      });
      return await response.json();
    } catch (error) {
      console.error('Update role error:', error);
      return { success: false, error: 'Update failed' };
    }
  }
};

// Health check
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error('API health check failed:', error);
    return false;
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// Wiki API — teaching, concepts, figures, apologetics, Q&A pages
// synced from the Mekra-Catholic-Bible-Wiki repo via scripts/sync_to_db.mjs
// ─────────────────────────────────────────────────────────────────────────────

export interface WikiPageListItem {
  page_type: string;
  slug: string;
  title_en: string | null;
  title_am: string | null;
  compendium_q: string | null;
  sources: string | null;
  bible_ref_count: number;
  wiki_updated_at: string | null;
}

export interface WikiPage extends WikiPageListItem {
  frontmatter: Record<string, string>;
  body_md: string;
  links: string[];
  bible_refs: Array<{ book: string; chapter: number; verses: string }>;
  source_path: string;
  synced_at: string;
}

// ---------- Daily Mass readings (both rites) ----------
export interface DailyReading {
  type: string; label: string; labelAm: string; citation: string;
  book?: string; chapter?: number; verses?: string;
}
export interface RiteDaily {
  liturgical: any;
  celebration?: string | null;
  readings: DailyReading[] | null;
  source?: string;
  verified?: boolean;
}
export interface DailyReadingsData { date: string; roman: RiteDaily; geez: RiteDaily }

export const readingsApi = {
  async get(date: string = 'today'): Promise<DailyReadingsData> {
    const response = await fetch(`${API_BASE}/readings/${date}`);
    const result: ApiResponse<DailyReadingsData> = await response.json();
    if (!result.success || !result.data) throw new Error(result.error || 'Failed to fetch readings');
    return result.data;
  },

  /** Upsert a day's readings for one rite. The server re-parses citations
   *  into deep-linkable refs; verified=true marks the row human-confirmed. */
  async update(date: string, payload: {
    rite: 'roman' | 'geez';
    celebration?: string | null;
    readings: Array<{ type: string; citation: string }>;
    verified?: boolean;
    source?: string;
  }): Promise<void> {
    const response = await fetch(`${API_BASE}/readings/${date}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Failed to save readings');
  },
};

export const wikiApi = {
  async list(type?: string): Promise<WikiPageListItem[]> {
    const url = type
      ? `${API_BASE}/wiki?type=${encodeURIComponent(type)}`
      : `${API_BASE}/wiki`;
    const response = await fetch(url);
    const result: ApiResponse<WikiPageListItem[]> = await response.json();
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch wiki pages');
    }
    return result.data;
  },

  async get(slug: string, type?: string): Promise<WikiPage> {
    const params = new URLSearchParams({ slug });
    if (type) params.set('type', type);
    const response = await fetch(`${API_BASE}/wiki?${params}`);
    const result: ApiResponse<WikiPage> = await response.json();
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch wiki page');
    }
    return result.data;
  },

  async search(query: string): Promise<WikiPageListItem[]> {
    const response = await fetch(`${API_BASE}/wiki?search=${encodeURIComponent(query)}`);
    const result: ApiResponse<WikiPageListItem[]> = await response.json();
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to search wiki');
    }
    return result.data;
  },
};
