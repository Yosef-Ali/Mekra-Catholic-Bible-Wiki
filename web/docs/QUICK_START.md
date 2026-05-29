# Quick Start - Extract Your PDF Bible Book

## Ready to Process Your PDF? Here's How:

### Step 1: Place Your PDF

Save your PDF file somewhere accessible, for example:
```
/Users/mekdesyared/Documents/my-bible-book.pdf
```

### Step 2: Run the Extraction

```bash
# Format:
pnpm extract:pdf <pdf_path> <english_name> <amharic_name> <chapter_number>

# Example with your file:
pnpm extract:pdf "/Users/mekdesyared/Documents/my-bible-book.pdf" "Genesis" "ኦሪት ዘፍጥረት" 1
```

### Step 3: Wait for Processing

You'll see:
```
📖 Reading PDF: /Users/mekdesyared/Documents/my-bible-book.pdf
🤖 Sending to Gemini Pro for extraction...
✅ Content extracted successfully

📝 Proofreading Genesis Chapter 1 with Gemini Pro...
✅ Proofread complete: 31 verses processed

💾 Saved processed content to: ./output/processed/genesis.json
📊 Saved SQL seed file to: ./output/seed/genesis.sql

✅ PROCESSING COMPLETE!
```

### Step 4: Review the Output

Open the generated files:

**JSON File** (`./output/processed/genesis.json`):
```json
{
  "bookName": "Genesis",
  "amharicName": "ኦሪት ዘፍጥረት",
  "chapters": [
    {
      "chapterNumber": 1,
      "verses": [
        { "verseNumber": 1, "text": "በመጀመሪያ እግዚአብሔር..." },
        { "verseNumber": 2, "text": "ምድርም ባዶና..." }
      ]
    }
  ]
}
```

### Step 5: Decide to Seed

✅ If content looks good → Proceed to seed the database
❌ If needs corrections → Edit the JSON file and re-run

### Step 6: Update Database Schema (First Time Only)

```bash
# Generate migration for new chapter_contents table
pnpm db:generate

# Push to database
pnpm db:push
```

### Step 7: Seed to Database

You can either:

**Option A: Use the SQL file**
```bash
psql $DATABASE_URL -f ./output/seed/genesis.sql
```

**Option B: Create a TypeScript seeder** (recommended)

I can create this for you! Just say "create the chapter seeder script"

## What the Script Does

1. **Extracts** all text from your PDF using Gemini's vision capabilities
2. **Proofreads** the text to fix any OCR errors
3. **Structures** it with verse numbers [1], [2], [3]...
4. **Formats** in both JSON (for review) and SQL (for seeding)
5. **Validates** Amharic text is preserved correctly

## Tips for Best Results

### PDF Quality Matters

✅ **Good PDFs:**
- Text is selectable (not scanned image)
- Amharic fonts are embedded
- Clear chapter/verse markers
- Good contrast and resolution

❌ **Problematic PDFs:**
- Scanned images only
- Very low resolution
- Missing font embeddings
- Mixed languages without clear separation

### Processing Time

- **Single chapter**: ~30-60 seconds
- **Whole book (50 chapters)**: ~30-45 minutes (with rate limiting)

### Cost Estimates

Using Gemini 2.0 Flash:
- **Single chapter**: ~$0.001 - $0.01
- **Whole Bible**: ~$0.50 - $2.00 (one-time cost)

Much cheaper than generating on-demand forever!

## Example: Process Your PDF Right Now

Let's say you have a PDF of Genesis Chapter 1. Here's the exact command:

```bash
pnpm extract:pdf \
  "./path/to/your/genesis.pdf" \
  "Genesis" \
  "ኦሪት ዘፍጥረት" \
  1
```

Replace `./path/to/your/genesis.pdf` with your actual file path!

## Common First-Time Questions

**Q: What if my PDF has multiple chapters?**
A: Process them one at a time, or use the batch processor with a config file.

**Q: What if the extracted text has errors?**
A: Review the JSON output and manually correct before seeding. The AI is usually 95%+ accurate, but verification is important for Scripture.

**Q: Can I process the whole Bible at once?**
A: Yes! Use the batch processor. See `PDF_EXTRACTION_GUIDE.md` for details.

**Q: What format should my PDF be?**
A: Any standard PDF with selectable text. Export from Word/InDesign works great.

**Q: What if I don't have PDFs?**
A: You can continue using the current Gemini AI generation system in the app. PDFs are optional for pre-seeding content.

## Next: After Extraction

Once you're happy with the extracted content:

1. **Seed the database** with the SQL files
2. **Update the frontend** to fetch chapters from database instead of generating
3. **Much faster app** - no waiting for AI generation
4. **Much cheaper** - one-time cost instead of per-view
5. **Offline capable** - works without internet

Would you like me to create the chapter seeder script next?
