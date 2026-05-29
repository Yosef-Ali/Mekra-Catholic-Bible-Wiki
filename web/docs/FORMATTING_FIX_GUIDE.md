# Bible Formatting Fix Guide

## 📊 Current Status

- **Total chapters in database:** 1,299
- **Chapters needing formatting:** 1,299 (100%)
- **Test result:** Genesis 3 successfully analyzed - poetry in verses 14-19 detected ✅

## 🛠️ Scripts Created

### 1. `scripts/batch-fix-formatting.ts`
Main batch processing script with:
- Gemini 2.0 Flash integration
- Rate limiting (2s between calls)
- Progress tracking & resume capability
- Known poetry passage hints

### 2. `scripts/test-genesis3-formatting.ts`
Quick test script for Genesis 3 - PASSED ✅

### 3. `scripts/diagnose-formatting.ts`
Diagnostic tool to check current state

## 📋 Commands to Run

### Test First (Already Done)
```bash
cd "/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible"
npx tsx scripts/test-genesis3-formatting.ts
```

### Process All Books (Full Run)
```bash
# Process ALL 1,299 chapters (~43 minutes at 30 chapters/min)
npx tsx scripts/batch-fix-formatting.ts
```

### Process Specific Book
```bash
# Genesis only (50 chapters)
npx tsx scripts/batch-fix-formatting.ts --book 147

# Psalms only (150 chapters) 
npx tsx scripts/batch-fix-formatting.ts --book 169

# Exodus only (40 chapters)
npx tsx scripts/batch-fix-formatting.ts --book 148
```

### Resume After Interruption
```bash
npx tsx scripts/batch-fix-formatting.ts --resume
```

### Check Progress
```bash
npx tsx scripts/diagnose-formatting.ts
```

## 📚 Book IDs Reference

| Book | ID | Chapters | Poetry |
|------|-----|----------|--------|
| Genesis | 147 | 50 | Ch 3, 9, 49 |
| Exodus | 148 | 40 | Ch 15, 20 |
| Leviticus | 149 | 27 | - |
| Numbers | 150 | 36 | Ch 6, 21-24 |
| Deuteronomy | 151 | 34 | Ch 32-33 |
| Psalms | 169 | 150 | All |
| Proverbs | 170 | 31 | All |
| Isaiah | 175 | 66 | Most |
| Job | 168 | 42 | Most |

## ⏱️ Estimated Time

- **Rate:** ~30 chapters/minute (with 2s delay)
- **Total chapters:** 1,299
- **Estimated time:** ~43 minutes for full run

## 🔧 Formatting Rules Structure

Each chapter gets a `formatting_rules` JSONB column with:

```json
{
  "sections": [
    {"type": "prose", "verseRange": [1, 13]},
    {"type": "poetry", "verseRange": [14, 19], "indent": 1},
    {"type": "prose", "verseRange": [20, 24]}
  ],
  "hasPoetry": true,
  "hasLists": false,
  "hasFootnotes": false,
  "primaryStyle": "prose" // or "poetry" or "mixed"
}
```

## ✅ Genesis 3 Test Result

```
Poetry sections found: 1
Poetry ranges: Verses 14-19
Curses (14-19) detected as poetry: ✅ Yes
```

## 🚀 Recommended Next Steps

1. **Run full batch:** `npx tsx scripts/batch-fix-formatting.ts`
2. **Monitor progress:** Check `formatting-progress.json`
3. **If interrupted:** `npx tsx scripts/batch-fix-formatting.ts --resume`
4. **Verify completion:** `npx tsx scripts/diagnose-formatting.ts`
5. **Update UI:** Apply formatting rules in frontend rendering
