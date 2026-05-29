# 🔧 BIBLE DATABASE TROUBLESHOOTING GUIDE

## Issue: Books Table is Empty in Neon

### Root Cause
The `books` table was created (schema migrated) but the actual book data was never inserted into the database.

### Why This Happened
- ✅ Database schema created (drizzle migration ran)
- ✅ Tables exist in Neon (`books` and `chapter_contents`)
- ❌ **BUT** the 73 books were never seeded/inserted

---

## 🚀 QUICK FIX (Run This Now)

```bash
cd ~/Fna-Catholic-Bible/Mekra-Catholic-Bible
npx tsx seed-books-now.ts
```

**Duration:** ~30 seconds to 1 minute
**Result:** All 73 books will be in your `books` table

---

## ✅ VERIFICATION STEPS

### Step 1: Check in Drizzle Studio
```bash
pnpm db:studio
# Opens https://local.drizzle.studio
```
- Click on `books` table
- Should show 73 rows
- Each row has: id, name, amharic_name, chapters, section

### Step 2: Check via API
```bash
pnpm dev
# In another terminal:
curl http://localhost:3000/api/books
```
Should return JSON with 73 books

### Step 3: Check Database Directly (via Drizzle Studio)
```sql
SELECT COUNT(*) FROM books;
-- Should return: 73

SELECT * FROM books LIMIT 5;
-- Should show first 5 books
```

---

## 📊 WHAT GETS SEEDED

### Book Metadata
Each book gets 4 fields:

| Field | Example | Notes |
|-------|---------|-------|
| `name` | "Genesis" | English name |
| `amharic_name` | "ኦሪት ዘፍጥረት" | Amharic name |
| `chapters` | 50 | Number of chapters |
| `section` | "OT" | OT/NT/Apocrypha |

### All 73 Books
- **39 Old Testament** books
- **27 New Testament** books
- **7 Apocryphal** books

### Example Books to Expect
```
Genesis (ኦሪት ዘፍጥረት) - 50 chapters
Matthew (ወንጌል ማቴዎስ) - 28 chapters
Psalms (መዝሙረ ዳዊት) - 150 chapters
Revelation (ራእይ ዮሐንስ) - 22 chapters
Tobit (መጽሐፈ ጦቢት) - 14 chapters [Apocrypha]
```

---

## 🔄 AFTER BOOKS ARE SEEDED

### Next: Seed Chapter Contents
Once books are in the database, seed the actual Bible text:

```bash
# This will seed ~1,189 chapters with AI-generated content
pnpm seed:all

# Takes 60-90 minutes
# Uses Gemini API to generate content
```

### Track Progress
```bash
tail -f seed-progress.log
```

---

## ❓ COMMON ISSUES & FIXES

### Issue 1: "DATABASE_URL is not defined"
**Cause:** .env file missing or corrupted
**Fix:**
```bash
# Check if .env exists
cat .env

# Should have:
# DATABASE_URL=postgresql://...
# GEMINI_API_KEY=AIzaSy...
```

### Issue 2: "ENOENT: no such file or directory, open '.env'"
**Cause:** Running from wrong directory
**Fix:**
```bash
# Make sure you're in the right directory
cd ~/Fna-Catholic-Bible/Mekra-Catholic-Bible
pwd
# Should show: /Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible
```

### Issue 3: "ERR! not ok code 0"
**Cause:** pnpm/npm installation issue
**Fix:**
```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
npx tsx seed-books-now.ts
```

### Issue 4: "connection refused" or "timeout"
**Cause:** Neon database unreachable
**Fix:**
```bash
# Test database connection
# The .env DATABASE_URL should be valid:
postgresql://neondb_owner:npg_OpI80oWNlxQS@ep-spring-violet-ahv1tp3h-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### Issue 5: "relation 'books' does not exist"
**Cause:** Schema wasn't applied to database
**Fix:**
```bash
# Push schema to database
pnpm db:push

# Then seed
npx tsx seed-books-now.ts
```

---

## 📋 COMPLETE WORKFLOW

### Step-by-Step Setup

#### 1. Navigate to Project
```bash
cd ~/Fna-Catholic-Bible/Mekra-Catholic-Bible
```

#### 2. Install Dependencies
```bash
pnpm install
# Takes ~2 minutes
```

#### 3. Ensure Schema is Applied
```bash
pnpm db:push
# Applies schema to Neon database
```

#### 4. Seed Books (THE FIX)
```bash
npx tsx seed-books-now.ts
# Takes ~30 seconds
# Inserts all 73 books
```

#### 5. Verify in Drizzle Studio
```bash
pnpm db:studio
# Opens visual database browser
# Click 'books' table
# Should see 73 rows
```

#### 6. (Optional) Seed Chapter Content
```bash
pnpm seed:all
# Takes 60-90 minutes
# Generates ~1,189 chapters with AI
```

#### 7. Start Development Server
```bash
pnpm dev
# Runs on http://localhost:3000
```

---

## 🎯 SUCCESS CRITERIA

✅ You'll know it worked when:

1. **In Drizzle Studio:**
   - Click `books` table
   - See 73 rows
   - Each has English name, Amharic name, chapter count

2. **In API:**
   - `/api/books` returns 73 books as JSON
   - `/api/books/1` returns Genesis
   - `/api/books/section/NT` returns 27 New Testament books

3. **In Logs:**
   - `npx tsx seed-books-now.ts` shows "✅ Successfully inserted: 73 books"

---

## 📞 TROUBLESHOOTING CHECKLIST

- [ ] Are you in the correct directory? (`~/Fna-Catholic-Bible/Mekra-Catholic-Bible`)
- [ ] Does `.env` file exist with `DATABASE_URL`?
- [ ] Did you run `pnpm install`?
- [ ] Did you run `pnpm db:push` (to apply schema)?
- [ ] Is Neon database accessible? (test with Drizzle Studio)
- [ ] Did you run `npx tsx seed-books-now.ts`?
- [ ] Are books showing in Drizzle Studio now?

---

## 📝 SUMMARY

| Task | Command | Duration | Result |
|------|---------|----------|--------|
| Install | `pnpm install` | ~2 min | Dependencies ready |
| Apply Schema | `pnpm db:push` | ~1 min | Tables created |
| **Seed Books** | `npx tsx seed-books-now.ts` | ~30 sec | **73 books in database** ✅ |
| Verify | `pnpm db:studio` | N/A | Visual confirmation |
| Seed Content | `pnpm seed:all` | 60-90 min | ~1,189 chapters |
| Run App | `pnpm dev` | N/A | App working |

---

## 🎉 YOU'RE DONE!

Once you run `npx tsx seed-books-now.ts`, your database will have all 73 books.

Then proceed with:
1. Seed chapters (optional): `pnpm seed:all`
2. Start app: `pnpm dev`
3. View in browser: `http://localhost:3000`

Good luck! 🙌
