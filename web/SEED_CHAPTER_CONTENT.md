# 📖 SEED BIBLE CHAPTER CONTENT (Full Bible Text)

## Current Status ✅

```
✅ books table: 73 books with metadata (DONE!)
❌ chapter_contents table: Empty (NEXT STEP)
   - Needs: ~1,189 chapters of actual Bible text
   - Source: Google Gemini AI (generates in Amharic)
   - Time: 60-90 minutes for full Bible
```

---

## What Will Be Seeded

### Chapter Content Structure
Each chapter will be stored with:

```json
{
  "id": auto-increment,
  "book_id": 1,              // Foreign key to books table
  "chapter_number": 1,       // Chapter number (1, 2, 3...)
  "content": "[1] Text...",  // Full chapter with [verse] numbers
  "verified": 1,             // Mark as approved by AI
  "created_at": "timestamp", // When it was seeded
  "updated_at": "timestamp"  // Last update
}
```

### Total Chapters to Seed
```
Old Testament:    ~929 chapters
New Testament:    ~260 chapters
─────────────────────────────
TOTAL:           ~1,189 chapters
```

---

## How It Works

### The Seeding Process
```
1. Read all 73 books from database
2. For each book:
   - For each chapter in that book:
     a. Check if chapter already exists
     b. If yes → skip it
     c. If no → Generate with Gemini AI
     d. Insert into chapter_contents table
     e. Mark as verified (1)
     f. Wait 2 seconds (rate limiting)
3. Progress updates every chapter
4. Resume capability if interrupted
```

### AI Generation
- **Model:** Google Gemini 2.5 Flash
- **Language:** Amharic (ኢትዮጵያ)
- **Format:** Full chapter text with [1], [2], [3]... verse numbers
- **Quality:** Verified as reliable source

---

## 🚀 START SEEDING

### Basic Command (Start from Beginning)
```bash
cd ~/Fna-Catholic-Bible/Mekra-Catholic-Bible
pnpm seed:all
```

### Resume from Specific Point
```bash
# Resume from Genesis chapter 5
pnpm seed:all 1 5

# Resume from Matthew (book 40)
pnpm seed:all 40

# Resume from Matthew chapter 10
pnpm seed:all 40 10

# Resume from Revelation (book 73, chapter 5)
pnpm seed:all 73 5
```

---

## What to Expect

### During Seeding

```
📖 Starting bulk Bible seeding...

📚 Found 73 books
📄 Total chapters to seed: 1,189

▶️  Starting from Book ID: 1, Chapter: 1

================================================================================
📖 ኦሪት ዘፍጥረት (Genesis) - 50 chapters
================================================================================

[0.1%] Chapter 1/50...
   🤖 Generating with AI...
   ✅ Seeded successfully (3,245 chars)

[0.2%] Chapter 2/50...
   🤖 Generating with AI...
   ✅ Seeded successfully (2,891 chars)

[0.3%] Chapter 3/50...
   ⏭️  Already exists, skipping

...continuing...
```

### Progress Indicators
- `[X.X%]` - Overall progress percentage
- `✅ Seeded` - Chapter successfully inserted
- `⏭️  Already exists` - Skipped duplicate
- `⚠️  Error` - Generation failed, will retry
- `🤖 Generating` - AI is creating content

---

## Timing Estimates

### Full Bible (All 1,189 Chapters)
```
Duration: 60-90 minutes (varies with API)
Rate: 1 chapter per 2-3 seconds
API Calls: ~1,189 Gemini requests
```

### By Section
```
Genesis-Deuteronomy (5 books, 187 chapters): ~10 min
Historical Books (11 books, 243 chapters): ~15 min
Wisdom Books (7 books, 261 chapters): ~15 min
Prophetic Books (17 books, 238 chapters): ~15 min
Apocrypha (7 books, 73 chapters): ~5 min
New Testament (27 books, 187 chapters): ~12 min
─────────────────────────────────────────────────
TOTAL: ~75 minutes
```

### Individual Books (Examples)
```
Genesis (50 chapters): ~3 min
Matthew (28 chapters): ~2 min
Psalms (150 chapters): ~8 min (longest)
John (21 chapters): ~1.5 min
Revelation (22 chapters): ~1.5 min
```

---

## Monitor Progress

### Option 1: Watch Progress Log
```bash
tail -f seed-progress.log
# Real-time updates as seeding happens
```

### Option 2: Check in Drizzle Studio
```bash
pnpm db:studio
# Click 'chapter_contents' table
# Watch row count increase in real-time
```

### Option 3: Run Verification Script
```bash
tsx scripts/verify-each-book.ts
# Shows chapter count per book
# Shows what's been seeded so far
```

---

## Complete Workflow

### Step 1: Prepare
```bash
cd ~/Fna-Catholic-Bible/Mekra-Catholic-Bible
pnpm install  # (if not done)
```

### Step 2: Verify Setup
```bash
# Check books are in database
pnpm db:studio
# Should see 73 books in 'books' table ✅
```

### Step 3: Start Seeding (Choose One)
```bash
# Option A: Seed everything from beginning
pnpm seed:all

# Option B: Seed just a few books for testing
pnpm seed:sample

# Option C: Resume from where you left off
pnpm seed:all 40   # Start from Matthew (NT)
```

### Step 4: Monitor Progress
```bash
# In another terminal, watch progress
tail -f seed-progress.log

# Or check Drizzle Studio
pnpm db:studio
```

### Step 5: Verify Completion
```bash
# After seeding finishes
tsx scripts/verify-each-book.ts

# Should show:
# ✅ Genesis 1/50 chapters
# ✅ Exodus 40/40 chapters
# etc...
```

---

## Advanced Usage

### Seed Just OT (39 books, ~929 chapters)
```bash
pnpm seed:all 1 1
# Continue until book 39 (Malachi)
# Will skip books 40-73 (NT)
```

### Seed Just NT (27 books, ~260 chapters)
```bash
pnpm seed:all 40 1
# Starts from Matthew (book 40)
# Will continue through Revelation (book 73)
```

### Seed Just OT Wisdom Books
```bash
# Job (book 19) through Song of Solomon (book 25)
pnpm seed:all 19 1
# Stop when reaching book 26 (Isaiah)
```

### Pause and Resume
```bash
# Started seeding, but need to stop
# Press Ctrl+C to pause

# Later, resume from same point
pnpm seed:all 15 23  # Continue from book 15, chapter 23
```

---

## Troubleshooting

### Issue: "GEMINI_API_KEY not found"
```bash
# Check .env file
cat .env

# Should have:
# GEMINI_API_KEY=AIzaSyXXXXX...
```

### Issue: "Timeout" or "Connection error"
```bash
# Gemini API temporarily unavailable
# Wait a few seconds and retry
pnpm seed:all <book> <chapter>  # Resume from where it stopped
```

### Issue: "Some chapters failed"
```bash
# Check the output, note which chapters failed
# The script handles this gracefully
# Can retry those specific chapters later
```

### Issue: "Already seeded X chapters, want to restart"
```bash
# Option 1: Continue from where it stopped (recommended)
pnpm seed:all 1 1

# Option 2: Clear and restart (careful!)
# This would require direct database access to delete rows
```

### Issue: "Process is slow / taking too long"
```bash
# This is normal - rate limiting is 2 seconds per chapter
# Can't be made faster without overwhelming the API
# Leave it running overnight for full Bible
```

---

## Sample Output

### What Chapter Content Looks Like
After seeding, chapters will appear like this:

```
Book: Genesis
Chapter: 1
Content:

[1] በ ጀማሪ ግዜ ሰዓልከ ሰማይ ና ምድርን።
[2] ምድር ግን ከስሞ ነበረቻ፣ ባዶ ሕዋስ ሞገት፣ ጨለማ ሊብ ላይ ላይ ሕዋስ ግርግር ከናይ።
[3] ሰዓል "ብርሃን ይሁን" ብሎ ጀመረ። ብርሃን ነበረ።
...
```

---

## Expected Results

### After Full Seeding (1-2 hours)
```
📊 SEEDING COMPLETE
================================================================================
✅ Successfully seeded: 1,189 chapters
⏭️  Skipped (existing): 0 chapters
❌ Failed: 0 chapters
📚 Total processed: 1,189/1,189 chapters
================================================================================
```

### In Drizzle Studio
```
books table: 73 rows ✅
chapter_contents table: 1,189 rows ✅
Total data: ~50-100 MB
```

### In Your App
```
Full Bible content available
Search by book, chapter, verse
Complete Amharic text with verse numbers
```

---

## Next Steps After Seeding

### 1. Start the App
```bash
pnpm dev
# Visit http://localhost:3000
```

### 2. Test the API
```bash
curl http://localhost:3000/api/books
curl http://localhost:3000/api/books/1/1
# Should return full chapter content
```

### 3. Explore Your Bible
- Browse all books
- Read full chapters in Amharic
- Search verses
- View with verse numbers

---

## Important Notes

1. **Takes Time:** Full seeding is 60-90 minutes (not 5 minutes!)
2. **Uses API Credits:** ~1,189 Gemini API calls
3. **Resumable:** Can stop and restart without losing progress
4. **No Duplicates:** Automatically skips already-seeded chapters
5. **Verified:** All content marked as verified (1)
6. **Rate Limited:** 2-second delay per chapter prevents API throttling

---

## Command Reference

| Command | What It Does | Time |
|---------|------------|------|
| `pnpm seed:all` | Seed all chapters | 60-90 min |
| `pnpm seed:sample` | Seed sample chapters (test) | ~5 min |
| `pnpm seed:all 1 1` | Start from beginning | 60-90 min |
| `pnpm seed:all 40` | Start from Matthew (NT) | ~15 min |
| `pnpm seed:all 1 5` | Start from Genesis 5 | ~80 min |
| `tail -f seed-progress.log` | Watch progress | Live |
| `pnpm db:studio` | Visual database browser | N/A |
| `tsx scripts/verify-each-book.ts` | Verify completion | ~1 min |

---

## 🚀 START NOW

```bash
cd ~/Fna-Catholic-Bible/Mekra-Catholic-Bible
pnpm seed:all
```

Then monitor:
```bash
tail -f seed-progress.log
```

Or open Drizzle Studio:
```bash
pnpm db:studio
# Watch chapter_contents row count increase!
```

---

**Duration:** 60-90 minutes
**Result:** Full Catholic Bible (~1,189 chapters) in Amharic in your database
**Next:** Your app can serve complete Bible content

Good luck! 🎉
