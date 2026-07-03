export enum View {
  DEVOTION = 'devotion',
  READER = 'reader',
  CHAT = 'chat',
  BOOKMARKS = 'bookmarks',
  WIKI = 'wiki',
  ADMIN_EDIT = 'admin_edit', // Now mapped to SettingsPage
  CONTENT_EDITOR = 'content_editor', // The actual Bible Content Editor
}

export interface BookIntroduction {
  display_title: string | null;   // e.g. የጌታችን የኢየሱስ ክርስቶስ ወንጌል · ቅዱስ ሉቃስ እንደ ጻፈው
  introduction: string;           // መግቢያ prose from the printed Emmaus edition
  outline_heading: string | null; // usually አጠቃላይ የመጽሐፉ ይዘት
  outline: string[];              // outline entries with verse ranges
  source_page: number | null;     // Emmaus PDF page
}

export interface BibleBook {
  id: number; // Database ID - required for API calls
  name: string; // English name for API ease
  amharicName: string;
  chapters: number;
  section: 'OT' | 'NT' | 'Apocrypha';
  heroImage?: string;
  introduction?: BookIntroduction | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isLoading?: boolean;
  englishText?: string;
  groundingLinks?: { title: string; url: string }[];
}

export interface ChatSession {
  id: string;
  title: string;
  date: string; // ISO string
  preview: string;
  messages: ChatMessage[];
}

export interface UserProfile {
  name: string;
  role: 'Layperson' | 'Student' | 'Priest' | 'Nun' | 'Theologian' | 'Catechist';
  ageGroup: 'Child' | 'Youth' | 'Adult' | 'Elder';
  interests: string[]; // e.g. "Liturgy", "History", "Apologetics"
}

export interface MassReading {
  type: 'First Reading' | 'Responsorial Psalm' | 'Second Reading' | 'Gospel';
  reference: string;
  text: string;
}

export interface DailyMassContent {
  date: string;
  liturgicalFeast: string; // e.g. "Tuesday of the 1st Week of Advent"
  readings: MassReading[];
  reflection: {
    title: string;
    authorStyle: string; // e.g. "In the spirit of Fulton Sheen"
    content: string;
  };
}

export interface DailyVerse {
  verse: string;
  reference: string;
  reflection: string;
}

export interface Bookmark {
  id: string;
  type: 'verse' | 'chat';
  content: string; // The verse text or chat response
  reference: string; // "Matthew 5:3" or "Theology on Grace"
  date: string;
  note?: string;
}
