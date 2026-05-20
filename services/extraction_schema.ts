export type ContentType =
  | 'book_title'
  | 'introduction_title'
  | 'introduction_text'
  | 'chapter_header'
  | 'section_header'
  | 'verse'
  | 'poetry'
  | 'footnote';

export interface ExtractedItem {
  type: ContentType;
  number?: number; // For chapters and verses
  text?: string; // Content for non-poetry items
  lines?: string[]; // Content for poetry items
  style?: 'bold' | 'italic' | 'regular'; // For visual fidelity
}

export interface ExtractedChapter {
  chapter_number: number;
  content: ExtractedItem[];
}

export interface ExtractedBook {
  book_name: string;
  book_name_amharic?: string;
  total_chapters: number;
  introduction?: ExtractedItem[];
  chapters: ExtractedChapter[];
}

export interface ExtractionResult {
  book: ExtractedBook;
  metadata: {
    source_pdf: string;
    extraction_date: string;
    model_used: string;
  };
}
