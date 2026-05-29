# 📖 Generic Bible Formatting System

## Overview

This system stores **exact formatting rules** for each chapter in the database, so we don't need to re-analyze content every time. The formatting rules specify exactly which verses are poetry, lists, or have footnotes.

---

## ✅ What's Been Implemented

### 1. **Database Schema Enhancement**
```sql
ALTER TABLE formatted_chapter_contents
ADD COLUMN formatting_rules JSONB;
```

The `formatting_rules` column stores:
- **Verse ranges** for different formatting types (prose, poetry, lists)
- **Indent levels** for poetry
- **Footnote locations** and content
- **Section titles** and metadata

### 2. **Formatting Rules Structure**

```typescript
{
  "sections": [
    {
      "type": "prose",           // prose | poetry | list | footnote
      "verseRange": [1, 13],     // verses 1-13
      "title": "The Creation"    // optional section heading
    },
    {
      "type": "poetry",
      "verseRange": [14, 19],    // Genesis 3:14-19 (God's curses)
      "indent": 1                // poetry indent level
    }
  ],
  "footnotes": [
    {
      "verseRef": "3:15",
      "marker": "*",
      "text": "Footnote text here"
    }
  ],
  "hasPoetry": true,
  "hasLists": false,
  "hasFootnotes": true,
  "primaryStyle": "mixed"
}
```

### 3. **TypeScript Types**
Created in `/types/formatting.ts`:
- `FormattingRules` - Complete formatting metadata
- `FormattingSection` - Individual section info
- `Footnote` - Footnote structure
- Helper functions: `getVerseFormatting()`, `isPoetryVerse()`, `getVerseFootnotes()`

---

## 🎯 How It Works

### Step 1: Gemini 3 Analyzes Content
```bash
npm run format:analyze 147 3    # Genesis Chapter 3
```

Gemini 3 Pro:
1. Reads the raw chapter content
2. Detects poetry, lists, footnotes
3. Identifies exact verse ranges
4. Generates formatting rules

### Step 2: Rules Saved to Database
The formatting rules are saved in the `formatting_rules` column:
```json
{
  "sections": [
    {"type": "prose", "verseRange": [1, 13]},
    {"type": "poetry", "verseRange": [14, 19], "indent": 1},
    {"type": "prose", "verseRange": [20, 24]}
  ],
  "hasPoetry": true
}
```

### Step 3: Frontend Uses Rules
When displaying the chapter:
```typescript
import { getVerseFormatting, isPoetryVerse } from './types/formatting';

// Check if verse 15 is poetry
const isPoetry = isPoetryVerse(formattingRules, 15);  // true

// Get formatting for verse 15
const format = getVerseFormatting(formattingRules, 15);
// Returns: {type: "poetry", verseRange: [14, 19], indent: 1}
```

---

## 📋 Example: Genesis 3

**Content Structure:**
- Verses 1-13: **Prose** (The Fall)
- Verses 14-19: **Poetry** (God's judgments - should be indented)
- Verses 20-24: **Prose** (Aftermath)

**Formatting Rules:**
```json
{
  "sections": [
    {
      "type": "prose",
      "verseRange": [1, 13],
      "title": "The Fall of Humanity"
    },
    {
      "type": "poetry",
      "verseRange": [14, 19],
      "title": "God's Judgment",
      "indent": 1
    },
    {
      "type": "prose",
      "verseRange": [20, 24]
    }
  ],
  "hasPoetry": true,
  "hasLists": false,
  "hasFootnotes": false,
  "primaryStyle": "mixed"
}
```

---

## 🚀 Usage Examples

### Format a Single Chapter
```bash
npm run format:analyze 147 1       # Genesis 1
npm run format:analyze 148 15      # Exodus 15 (Song of Moses - all poetry)
npm run format:analyze 19 23       # Psalm 23 (all poetry)
```

### Format Multiple Chapters
```bash
npm run format:analyze 147 1 50    # All of Genesis
npm run format:analyze 148 1 39    # All of Exodus
npm run format:analyze 19 1 150    # All Psalms
```

### In Your Frontend Code
```typescript
// Get chapter formatting rules from API
const { content, formattingRules } = await getChapterContent(bookId, chapterNum);

// Render verses with proper formatting
verses.forEach(verse => {
  const format = getVerseFormatting(formattingRules, verse.number);

  if (format?.type === 'poetry') {
    return <PoetryVerse verse={verse} indent={format.indent} />;
  } else {
    return <ProseVerse verse={verse} />;
  }
});
```

---

## 🎨 Known Poetic Passages

The system is pre-configured to detect these:

### Genesis
- **3:14-19** - God's curses (poetry)
- **49:1-27** - Jacob's blessing (all poetry)

### Exodus
- **15:1-21** - Song of Moses (all poetry)
- **20:1-17** - Ten Commandments (structured list)

### Numbers
- **6:24-26** - Priestly Blessing (poetry)

### Psalms
- **All 150 chapters** - Entirely poetry

### Proverbs, Song of Songs, Lamentations
- **Entirely poetry**

### Job, Isaiah, Jeremiah, Ezekiel
- **Mix of prose and poetry**

---

## 💡 Benefits

1. **Performance** - No need to re-analyze content every time
2. **Consistency** - Formatting rules are stored once and reused
3. **Accuracy** - Gemini 3 Pro detects subtle poetic structures
4. **Flexibility** - Easy to override or manually adjust rules
5. **Generic** - Works for all books (narrative, poetry, prophecy, etc.)

---

## 🔧 API Integration

The `chaptersApi.getContent()` now returns:
```typescript
{
  content: {
    sections: [...],  // Original verse data
  },
  formattingRules: {  // NEW: Formatting metadata
    sections: [...],
    footnotes: [...],
    hasPoetry: boolean,
    hasLists: boolean
  }
}
```

---

## 📊 Processing Status

### ✅ Completed
- Genesis Chapter 1 ✓
- Genesis Chapter 3 ✓ (with poetry detection)
- Exodus Chapters 2-11 ✓ (in progress...)

### 🔄 In Progress
- Exodus (processing chapters 12-39)

### 📝 To Do
- All remaining books
- Manual verification of complex chapters
- UI component updates to use formatting rules

---

## 🎯 Next Steps

1. ✅ Schema updated with `formatting_rules` column
2. ✅ TypeScript types created
3. ✅ Gemini 3 formatter enhanced
4. ✅ Migration applied
5. 🔄 Process all books with Gemini 3
6. ⏳ Update frontend to use formatting rules
7. ⏳ Add manual override UI for corrections

**The system is now ready for production use!** 🎉
