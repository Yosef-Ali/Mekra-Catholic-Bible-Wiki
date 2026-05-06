# NEXT STEPS — Catechism OCR

_Written 2026-04-08 at the end of a Phase A+B session. Phase C (OCR) and beyond are the work for next session._

## What's done

- ✅ **Phase A** — Wiki vault scaffolded at `/Users/mekdesyared/Mekra-Catholic-Bible-Wiki/`
- ✅ **Phase A** — Canonical Compendium scans identified and copied to `raw/catechism/source_tif/` (151 files, 278 MB)
- ✅ **Phase A** — Originals left untouched in `/Users/mekdesyared/Pictures/cc/` as backup
- ✅ **Phase B** — TIFs converted to JPEG 300 DPI quality 90 at `raw/catechism/source_jpg/` (151 files, 95 MB)
- ✅ Page 1 visually verified — confirmed Amharic fidel, confirmed this is the Compendium not the full CCC
- ✅ `raw/catechism/MANIFEST.md` written

## What's NOT done

- ❌ `CLAUDE.md` at the vault root is only half written (Layers + page format + ingest operation). Still need: query, lint, Amharic rules, liturgical, guardrails, session-start. See `CLAUDE.md` — it ends mid-section.
- ❌ The `CLAUDE.md` was originally drafted Bible-centric. It needs to be rewritten teaching-centric now that we've confirmed the Compendium is the first real raw source. The folder structure under `wiki/` also needs to shift from `wiki/books/`, `wiki/concepts/` (Bible-focused) to `wiki/teaching/`, `wiki/apologetics/`, `wiki/figures/`, `wiki/comparative/` (teaching-focused). See the earlier chat turn where this was proposed.
- ❌ No OCR has been run yet. The `source_jpg/` folder is ready to feed to Gemini but the extraction hasn't happened.
- ❌ Reordering: the JPG filenames sort string-alphabetically, which means page 10 comes before page 2. Before OCR, we should either rename files with zero-padding (`001.jpg`, `002.jpg`, ...) OR have the OCR pipeline sort numerically. Renaming is cleaner — tomorrow-Yosef should decide.

## Phase C — the next session's work

### Step 1: Resolve the page-order question

Two options, pick one:

**Option 1a — Zero-pad filenames (recommended).** Rename the 151 JPGs to `cc_body_001.jpg` through `cc_body_137.jpg` for the `-2-page-a/b` set and `cc_front_01.jpg` through `cc_front_14.jpg` for the `-tc` set. This makes everything downstream simpler. A one-liner shell script can do it.

**Option 1b — Leave filenames, sort numerically in the OCR pipeline.** More fragile, but preserves the original scanner filenames for traceability.

### Step 2: Figure out the a/b interleaving

The `-2-page-a` and `-2-page-b` files are the left and right halves of physical book spreads. But we don't yet know: does `a 1` + `b 1` together make spread 1 (so the reading order is a1, b1, a2, b2, ...)? Or does `-2-page-a` contain all odd pages and `-2-page-b` all even pages (so the reading order is a1, b1, a2, b2, ...)? Or something else entirely?

**Check this before OCR** by opening `-2-page-a 1.tif` and `-2-page-b 1.tif` in Preview side by side. If they look like consecutive pages of a book (one continues from the other), you have the answer. If they look unrelated, we need to look at more samples.

Once you know, the renaming step in Step 1 can interleave them correctly.

### Step 3: Use amharic-ocr-extractor

Your existing `amharic-ocr-extractor` at https://amharic-ocr-extractor.vercel.app and the `my-claude-skills` repo already has the pipeline. Two ways to run it:

**Option A — Use the web app.** Upload JPGs in batches, save extracted text. Slow for 151 files but lowest-risk.

**Option B — Run the Gemini API directly** from the `my-claude-skills/amharic-text-processor` skill, pointing at `source_jpg/`. Faster, but you need to write a small batch script.

Either way, the output should go to `raw/catechism/extracted/` as one markdown file per source JPG, named to match (e.g., `cc_body_001.md`).

### Step 4: Custom prompt for the Compendium

The OCR prompt should be Compendium-specific. Suggested prompt additions on top of your existing Amharic OCR prompt:

```
This is a page from the Amharic edition of the "Compendium of the Catechism
of the Catholic Church" — a Q&A-format book with 598 numbered questions.
Each question starts with a number (for example ፩ ወይም 1) followed by the
Amharic question text, then the answer.

When extracting:
- Preserve question numbers exactly as they appear (Ethiopic numerals OR Arabic numerals — do not convert)
- Put each question number on its own line with a ## heading
- Put the question text on the line after the heading, prefixed with **Q:**
- Put the answer on the line after that, prefixed with **A:**
- If you see a marginal reference like [CCC 1322-1327], preserve it
- If text is cut off at the edge, mark it with [...] and flag the page in a "needs_review" note
- Do NOT normalize Amharic spelling; preserve exactly what's in the image
```

### Step 5: Verify against the Vatican Compendium

The Vatican publishes the Compendium in English at https://www.vatican.va — find the official index and for each OCR'd Q&A, spot-check that the Amharic question number and topic align with the English version. Any mismatch is a strong signal of OCR error.

### Step 6: Ingest into wiki/teaching/

ONLY after OCR is verified. This is where we rewrite `CLAUDE.md` for teaching-centric structure and then run the first real ingest.

## Cost estimate

151 pages at ~600 KB per JPG, sent to Gemini 2.5 Pro or Flash. Rough estimate:
- Gemini 2.5 Flash: ~$0.50–1.00 total for the whole extraction
- Gemini 2.5 Pro: ~$5–10 total

Flash is probably fine for this — you used it successfully on the Emmaus Bible. Start with Flash; if accuracy on Amharic is poor, upgrade to Pro for a second pass on the problem pages only.

## Files to find tomorrow

```
/Users/mekdesyared/Mekra-Catholic-Bible-Wiki/
├── CLAUDE.md                                    ← half-written, needs finishing AND restructuring
├── raw/catechism/
│   ├── MANIFEST.md                              ← read this first
│   ├── NEXT-STEPS.md                            ← this file
│   ├── source_tif/                              ← 151 original TIFs (don't touch)
│   ├── source_jpg/                              ← 151 JPGs, ready for OCR ← START HERE
│   └── extracted/                               ← empty, OCR output goes here
└── wiki/                                        ← empty folders, not yet populated
    ├── books/ people/ places/ concepts/ themes/
    ├── liturgical/feasts/ liturgical/seasons/
    ├── qa/ glossary/
```

## Open questions for future-Yosef

1. **Should the wiki vault be its own git repo?** Recommended yes, separately from the Mekra app repo. Lets you version-control the wiki and roll back bad ingests.
2. **Should it also be an Obsidian vault?** Yes — just open the folder in Obsidian. That's where the graph view and link-browsing pay off.
3. **Which is the primary user interface?** The Mekra app (users ask questions, app reads wiki to answer), or Obsidian (you browse the wiki directly)? Both work, but the answer changes what we optimize for.
