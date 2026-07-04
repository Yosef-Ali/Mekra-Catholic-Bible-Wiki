# Improvement Tasks — run with Opus/Sonnet (self-contained handoff)

**Written:** 2026-07-03 by a Fable session. Each task below is self-contained:
context, files, steps, and verification are all included so a fresh session
(any model) can execute one without prior conversation history. Run tasks
individually — paste one task section as the prompt.

**Global guardrails (apply to every task):**
- `raw/` in the wiki is immutable — never edit by hand; re-run extractor scripts instead.
- Any DB write: dry-run first, full-table backup before `--apply` (the fix scripts do this automatically), and log one line to `log.md` (append-only).
- Never invent Scripture citations or readings. Unverifiable data gets `verified=false` and a visible flag.
- The Emmaus PDF text layer is ground truth for Bible text: `/Users/mekdesyared/Mekra-Catholic-Bible/The Amharic Bible Catholic Edition - Emmaus.pdf` (pdftotext works; no OCR needed).
- App repo `/Users/mekdesyared/Mekra-Catholic-Bible` (DB scripts live in its `scripts/`); wiki repo `/Users/mekdesyared/Mekra-Catholic-Bible-Wiki` (web/ + mobile/ apps live HERE).
- Dev server: `npm run dev` from wiki root → http://localhost:5173 (Vite embeds the API middleware; restart after server-side changes).

---

## ✅ DONE 2026-07-03 — Task 1 — Clickable outline items in the book-introduction cards (S, quick win)

**Context:** All 73 books have printed introductions stored in `books.introduction`
(JSONB: `{display_title, introduction, outline_heading, outline[], source_page}`).
Three UIs render them as collapsible cards on chapter 1: `web/components/BibleReader.tsx`,
`web/components/desktop/DesktopBibleSelector.tsx`, `mobile/app/(tabs)/bible.tsx`.
Outline entries look like `የሕማማቱ ታሪክ (22፥1–23፥56)` — currently plain text.

**Do:** Parse the FIRST chapter number from the parenthesized range (Ethiopic colon
`፥` separates chapter፥verse; `–`/`‑`/`-` separate ranges) and make each outline item
tappable, jumping to that chapter of the SAME book. Desktop/web: call the existing
chapter-change mechanism (`goToChapter(n)` in DesktopBibleSelector; `setChapter(n)`
in BibleReader). Mobile: `openReader(selectedBook, n)`. Items without a parseable
range stay plain text.

**Verify:** dev server → Luke ch1 → open መግቢያ → tap «የሕማማቱ ታሪክ (22፥1–23፥56)» →
reader jumps to Luke 22. `cd mobile && npx tsc --noEmit` passes.

---

## ✅ DONE 2026-07-04 — Task 2 — Admin screen to verify/correct daily readings (M)

**Context:** Daily Mass readings live in DB table `daily_readings`
(date, rite 'roman'|'geez', celebration, readings JSONB, source, verified).
API: `GET /api/readings/:date` (both rites + computed liturgical context),
`PUT /api/readings/:date` body `{rite, celebration, readings:[{type,citation}], verified, source}`
— PUT re-parses citations into deep-linkable refs server-side
(`web/server/api/readings.ts`). Seeded/AI rows carry `verified=false` and the UI
shows «ያልተረጋገጠ · unverified».

**Do:** Add a "Daily Readings" panel to `web/components/desktop/DesktopSettings.tsx`
(admin area): date picker (default today), rite toggle, editable rows
(type dropdown: first/psalm/second/gospel + citation text input), celebration field,
and a "Save as verified" button calling the PUT. Show current verified/source status.
Follow the existing design tokens (parchment/cream/rule/oxblood, font-garamond/ethiopic).

**Verify:** edit today's Roman readings, save, reload home page → unverified flag gone.

---

## ✅ DONE 2026-07-04 — Task 3 — Roman lectionary imported (730 days, 2026–2027, cpbjr/catholic-readings-api MIT)

**Context:** Only Jul 3–5 2026 are seeded; other days depend on an AI fallback
(needs GEMINI_API_KEY in web/.env, stores unverified). A complete lectionary
reference table (day-identity → citations, cycles A/B/C + I/II) would make every
day exact and offline.

**Do:** Search GitHub for an open-license Catholic lectionary dataset
(JSON/CSV; search terms: "catholic lectionary json", "romcal readings",
"universalis lectionary data"). Validate license. Map its day-identities to the
computed ones from `web/server/liturgical.ts` (`romanDay()` returns season, week,
weekday, cycles, celebration). Write `scripts/import_lectionary.mjs` (app repo)
that fills `daily_readings` for the next 24 months, `source='lectionary-<name>'`,
`verified=false`. Spot-check ≥10 dates against USCCB (usccb.org/bible/readings)
before marking those verified.

**Verify:** `GET /api/readings/2026-12-25` returns the three Christmas Masses'
readings (or at least the Day Mass: Is 52:7-10 / Heb 1:1-6 / Jn 1:1-18).

---

## 🟡 IN PROGRESS, PAUSED 2026-07-04 — Task 4 — Geʽez-rite readings (ግጻዌ) ingestion (M)

**Context:** The Geʽez tab shows computed Ethiopian calendar context (date, feasts,
fasts — engine verified) but no readings. A source was found and fetched:
«መጽሐፈ ግጻዌ ከነምልክቱ በጣዖመ ዜማ ዘደብር ዓባይ» (Debre Abay edition, myorthodoxbooks.org),
archived at `raw/liturgical/gitsawe/source/metshafe-gitsawe.pdf`. It is a **scanned,
copy-protected PDF with no digital text layer** — extraction requires reading page
images visually, not `pdftotext`.

**Progress so far** (full detail in `raw/liturgical/gitsawe/README.md`):
- Confirmed the book's own 3-part structure and the daily reading formula (Matins
  psalm → 4-reading pre-Liturgy block + 2nd psalm → 1 rotating Liturgy Gospel),
  consistent across every day examined.
- Transcribed the complete book-name abbreviation legend (page 4 of the source).
- **Meskerem days 1–7 fully transcribed and calendar-anchored** (two independent
  confirmations: Day 1 = New Year, Day 7 = a distinctive commemoration text read
  identically twice). Some individual abbreviation cells within these 7 days carry
  `(?)` low-confidence flags — worth a fluent reader's spot-check.
- **Paused at Day 8**: the red day-of-month headers are in the same decorative
  Ge'ez numeral typeface that blocked chapter/verse extraction — illegible with
  confidence even at 500 DPI targeted crops. Sequential block-counting past Day 7
  cannot be independently verified, and one cross-check (a block mentioning ሚካኤል,
  whose monthly feast falls on a fixed day) suggested a possible drift. User decided
  (2026-07-04) to stop rather than publish unverified day numbers.
- Chapter/verse numbers were never attempted at all (same numeral problem, worse —
  smaller glyphs); one content-based guess at a verse was caught wrong on
  re-examination and discarded rather than reported.

**Do (when resuming):** Get a fluent reader to confirm day-of-month numbering for
printed pages 14–20 of the source (`raw/liturgical/gitsawe/source/pages/f010-016.png`
— page images already rendered, no PDF tools needed) using printed pages 9–13 as a
calibration check (those correspond to the already-confirmed Days 1–7). Once day
numbers are confirmed, continue the same transcription method through Meskerem
30, then the other 12 months. Only after day-numbering AND the (?)-flagged
abbreviation cells are confirmed should any of this be loaded into `daily_readings`
rite='geez' — do not load unverified data into the app DB.
Loader pattern (once data is trustworthy): follow `scripts/extract_book_intros.mjs`'s
structure; Ethiopian dates map to Gregorian via `toEthiopian()` in
`web/server/liturgical.ts`; Amharic book names → English via the `books` table.

**Verify:** Geʽez tab on the home page shows readings with working deep links.

---

## Task 5 — Applier for the priest's review decisions (M, run when marked files return)

**Context:** `docs/bible-review/` holds per-book review tables
(`| ጥቅስ | ጉዳይ | በመጽሐፉ | በአፑ | ውሳኔ |`, 10,704 items). The priest marks ውሳኔ with
✓ (print is right → fix the app), ✗ (keep app), or a correction text.
Single-verse fixes go through `app:scripts/set_verse_text.mjs <book> <ch> <v> "<text>"`
(audit-logs to `backups/verse-decisions.log`). Verifier:
`wiki:scripts/verify_bible_text.mjs <book>` shows remaining diffs.

**Do:** Write `app:scripts/apply_review_decisions.mjs <review-file.md> [--apply]`:
parse rows where ውሳኔ is non-empty; for ✓ rows compute the corrected verse text by
applying the በመጽሐፉ reading (fetch current verse via wiki:scripts/get_verse.mjs,
replace the በአፑ fragment with the በመጽሐፉ fragment); for correction text, apply it;
✗ rows → log "kept" decision. Dry-run prints every planned change; --apply uses
set_verse_text per verse. Then regenerate review files:
`wiki: node scripts/verify_bible_text.mjs --all --out /tmp/r.md && node scripts/generate_review_files.mjs /tmp/r.md`
and PDFs: `node scripts/convert_review_pdfs.mjs`.

**Verify:** run on one marked file; check 2–3 verses via get_verse.mjs; log to log.md.

---

## ✅ DONE 2026-07-03 — Task 6 — Commit the accumulated work (S, do soon)

**Context:** Both repos have large uncommitted changes from the text-repair and
feature sessions (see `git status`). Nothing has been committed on purpose —
the user controls git.

**Do:** Propose (don't push without confirmation) logical commit groups:
wiki repo: (1) verification/fix/review scripts + docs/bible-review + raw/bible/intros,
(2) web daily-readings feature + intro cards, (3) mobile equivalents, (4) log.md/qa.
App repo: (5) DB fix scripts + page_map correction + backups note (consider
.gitignore for backups/*.jsonl — they're large). Write clear messages; let the
user review each group.

---

## ✅ DONE 2026-07-04 — Task 7 — Wiki enrichment from book intros (M)

**Context:** `wiki:raw/bible/intros/NN-<Book>.md` holds all 73 printed introductions.
`wiki/bible/<Book>.md` synthesis pages exist for all books. Wiki rule: discuss
before writing across 30+ pages (CLAUDE.md guardrail #3) — present the plan,
get a yes, then run.

**Do:** Script `wiki:scripts/enrich_bible_pages_with_intros.mjs`: for each
wiki/bible page, add/refresh a section `## መግቢያ (ከኤማሁስ ኅትመት)` quoting the intro
prose as a `>` blockquote with citation `Emmaus PDF p. N`, keep outline as a list,
bump **Sources** count and **Last updated**. Idempotent (replace the section if
present). Then `npm run sync` (wiki→DB sync for the app's wiki viewer).

---

## ✅ DONE 2026-07-03 — Task 8 — soft-hyphen taints (queue 10,704→8,387) (M, technical)

**Context:** The word-fixer skipped PDF tokens containing soft hyphens (U+00AD)
as "tainted" — e.g. `በእግዚአ­ ብሔር` (word split across lines). Many are trivially
repairable: rejoining `X­ Y` → `XY` yields a valid word that matches the DB token,
meaning NO error existed (queue noise); others reveal real diffs.

**Do:** In `app:scripts/fix_bible_words.mjs`, pre-process PDF chapter text:
rejoin `­\s*` → `` (soft-hyphen + following whitespace) BEFORE tokenization
(mirror `prepText` in `app:scripts/rebuild_2corinthians.mjs`). Drop the taint
guard (it becomes unnecessary). Dry-run a few books; confirm no wrong joins
(the rejoined token must appear as one word in print — spot-check 2–3 against
page images via `pdftoppm`). Then full batch --apply (backup automatic), re-verify,
regenerate review files + PDFs. Expect several hundred queue items to resolve.

---

## ✅ DONE 2026-07-03 (no derived stores exist) — Task 9 — Refresh app derived data after text changes (S, investigate first)

**Context:** ~21,000 verses changed in `formatted_chapter_contents` during the
repair. If the app maintains derived stores (search index, embeddings, cached TTS
audio keyed by verse text), they may still hold pre-fix text.

**Do:** Search the app repo for derived tables/caches (`grep -ri "embedding\|search_index\|tsvector\|tts.*cache" api/ web/ services/`).
If found, regenerate for the changed rows (backups/*.jsonl from 2026-07-02/03 give
the changed row ids). If nothing found, close the task with a note in log.md.

---

**When a task completes:** append one line to `wiki:log.md` describing what ran
and what changed. That file is the project's memory across sessions.
