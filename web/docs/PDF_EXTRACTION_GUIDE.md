# PDF Bible Book Extraction Guide

## Overview

This guide explains how to extract, proofread, and structure Bible book content from PDF files using Gemini Pro AI.

## Features

✅ **PDF Text Extraction** - Extract all text from PDF files
✅ **AI Proofreading** - Use Gemini Pro to proofread and correct OCR errors
✅ **Auto-Structuring** - Automatically add verse numbers and formatting
✅ **Amharic Support** - Preserves Amharic text accurately
✅ **Database Ready** - Outputs SQL files ready for seeding
✅ **Batch Processing** - Process multiple books at once

## Prerequisites

1. **Gemini API Key** - Ensure `GEMINI_API_KEY` is set in `.env`
2. **PDF Files** - Place your PDF books in a folder (e.g., `./books/`)
3. **Dependencies** - All required packages are already installed

## Quick Start

### Single Book Extraction

```bash
pnpm extract:pdf <pdf_path> <book_name> <amharic_name> [chapter]
```

**Example:**
```bash
pnpm extract:pdf ./books/genesis_ch1.pdf "Genesis" "ኦሪት ዘፍጥረት" 1
```

### Batch Processing

```bash
pnpm extract:batch <input_directory> [config_file]
```

**Example:**
```bash
pnpm extract:batch ./books ./books-config.json
```

## Step-by-Step Instructions

### Step 1: Organize Your PDFs

Create a folder structure:
```
project/
├── books/
│   ├── genesis.pdf
│   ├── exodus.pdf
│   ├── matthew.pdf
│   └── ...
├── output/
│   ├── processed/  (will be created automatically)
│   └── seed/       (will be created automatically)
└── books-config.json (for batch processing)
```

### Step 2: Create Configuration File (For Batch Processing)

Create `books-config.json`:

```json
[
  {
    "filename": "genesis.pdf",
    "bookName": "Genesis",
    "amharicName": "ኦሪት ዘፍጥረት",
    "chapters": 50
  },
  {
    "filename": "exodus.pdf",
    "bookName": "Exodus",
    "amharicName": "ኦሪት ዘጸአት",
    "chapters": 40
  },
  {
    "filename": "matthew.pdf",
    "bookName": "Matthew",
    "amharicName": "የማቴዎስ ወንጌል",
    "chapters": 28
  }
]
```

### Step 3: Process Your PDFs

#### Option A: Single File

```bash
pnpm extract:pdf ./books/genesis.pdf "Genesis" "ኦሪት ዘፍጥረት" 1
```

#### Option B: Batch Processing

```bash
pnpm extract:batch ./books
```

### Step 4: Review the Output

The script creates:

**1. Processed JSON** (`./output/processed/genesis.json`):
```json
{
  "bookName": "Genesis",
  "amharicName": "ኦሪት ዘፍጥረት",
  "chapters": [
    {
      "chapterNumber": 1,
      "verses": [
        {
          "verseNumber": 1,
          "text": "በመጀመሪያ እግዚአብሔር ሰማይንና ምድርን ፈጠረ።"
        },
        {
          "verseNumber": 2,
          "text": "ምድርም ባዶና ሐዋሥ ነበረች..."
        }
      ]
    }
  ]
}
```

**2. SQL Seed File** (`./output/seed/genesis.sql`):
```sql
-- Genesis Chapter 1
INSERT INTO chapters (book_id, chapter_number, content) VALUES (
  (SELECT id FROM books WHERE name = 'Genesis'),
  1,
  '[1] በመጀመሪያ እግዚአብሔር ሰማይንና ምድርን ፈጠረ። [2] ምድርም ባዶና ሐዋሥ ነበረች...'
);
```

### Step 5: Verify and Approve

1. **Open the JSON file** - Review the extracted content
2. **Check accuracy** - Verify verse numbers and text
3. **Compare with source** - Ensure no content was lost
4. **Approve for seeding** - Once verified, you can seed the database

### Step 6: Seed the Database

#### Option 1: Manual SQL Execution

```bash
# Connect to your database and run the SQL file
psql $DATABASE_URL -f ./output/seed/genesis.sql
```

#### Option 2: Create a Custom Seed Script

Create `scripts/seed-chapters.ts` to import the JSON data:

```typescript
import { db } from '../services/db';
import { books, chapters } from '../services/schema';
import fs from 'fs';

async function seedChapters(jsonPath: string) {
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  for (const chapter of data.chapters) {
    const chapterText = chapter.verses
      .map(v => `[${v.verseNumber}] ${v.text}`)
      .join(' ');

    await db.insert(chapters).values({
      bookId: (await db.select().from(books).where(eq(books.name, data.bookName)))[0].id,
      chapterNumber: chapter.chapterNumber,
      content: chapterText
    });
  }

  console.log(`✅ Seeded ${data.bookName}`);
}

seedChapters('./output/processed/genesis.json');
```

## How It Works

### 1. PDF Text Extraction

The script reads the PDF file and sends it to Gemini Pro, which:
- Extracts all visible text
- Preserves Amharic characters
- Maintains structure and formatting

### 2. AI Proofreading

Gemini Pro then:
- **Fixes OCR errors** - Corrects common OCR mistakes
- **Adds verse numbers** - Automatically numbers verses [1], [2], etc.
- **Structures content** - Organizes into proper JSON format
- **Preserves accuracy** - Maintains biblical text integrity
- **Uses Arabic numerals** - Ensures 1, 2, 3 (not ፩, ፪, ፫)

### 3. Output Generation

Creates two outputs:
- **JSON** - Human-readable, easy to review
- **SQL** - Ready to seed into database

## Advanced Usage

### Custom Processing

You can import and use the functions directly:

```typescript
import { processPdfBook, extractPdfContent, proofreadAndStructure } from './scripts/pdf-extractor';

// Custom processing
const content = await processPdfBook(
  './my-book.pdf',
  'Custom Book',
  'ብጽሕት መጽሐፍ',
  1,
  10  // Process chapters 1-10
);
```

### Error Handling

If extraction fails:
1. **Check PDF quality** - Ensure text is selectable (not scanned image)
2. **Verify Gemini API** - Check API key and quotas
3. **Review file path** - Ensure correct absolute/relative path
4. **Check file size** - Very large PDFs may timeout

### Rate Limiting

The batch processor includes automatic delays:
- **2 seconds** between chapters
- **5 seconds** between books

Adjust in `batch-process-pdfs.ts` if needed.

## Quality Assurance

### Manual Review Checklist

Before seeding to database:

- [ ] All verses are numbered correctly
- [ ] No verses are missing
- [ ] Amharic text is accurate
- [ ] Chapter divisions are correct
- [ ] Special characters preserved
- [ ] No extra whitespace
- [ ] Matches source PDF content

### Automated Validation

You can create a validation script:

```typescript
function validateChapter(chapter: ChapterContent): boolean {
  // Check sequential verse numbers
  for (let i = 0; i < chapter.verses.length; i++) {
    if (chapter.verses[i].verseNumber !== i + 1) {
      console.error(`Missing verse ${i + 1}`);
      return false;
    }
  }

  // Check for empty verses
  const hasEmpty = chapter.verses.some(v => !v.text || v.text.trim() === '');
  if (hasEmpty) {
    console.error('Found empty verses');
    return false;
  }

  return true;
}
```

## Troubleshooting

### Common Issues

**Issue: "Cannot read PDF file"**
- Ensure file path is correct
- Check file permissions
- Verify PDF is not corrupted

**Issue: "Gemini API error"**
- Check `GEMINI_API_KEY` in `.env`
- Verify API quota/rate limits
- Try smaller PDF files first

**Issue: "Verses not numbered correctly"**
- Review source PDF - may not have clear verse markers
- Manually number in JSON output
- Adjust proofreading prompt for this book's format

**Issue: "Amharic text corrupted"**
- Check PDF encoding
- Ensure Amharic fonts are embedded in PDF
- Try different PDF generation method

## Database Schema Update

To store chapter content, you'll need to update the schema:

```typescript
// services/schema.ts
export const chapters = pgTable("chapters", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").references(() => books.id).notNull(),
  chapterNumber: integer("chapter_number").notNull(),
  content: text("content").notNull(), // Full chapter text with [verse] numbers
  createdAt: timestamp("created_at").defaultNow()
});
```

Then run:
```bash
pnpm db:generate
pnpm db:push
```

## Next Steps

1. **Process all your PDF books**
2. **Review each output carefully**
3. **Update database schema** if adding chapter content
4. **Seed approved content** to database
5. **Update frontend** to fetch chapters from DB instead of Gemini

## Benefits

### Before (Current System)
- ❌ Generates content on-demand with Gemini (slow)
- ❌ Costs API credits per chapter view
- ❌ Content may vary each time
- ❌ Requires internet connection

### After (With PDF Extraction)
- ✅ All content pre-loaded in database (fast)
- ✅ One-time AI cost for processing
- ✅ Consistent, verified content
- ✅ Works offline once seeded

## Support

For issues or questions:
1. Check this guide first
2. Review error messages carefully
3. Test with small PDF first
4. Verify API keys and database connection
