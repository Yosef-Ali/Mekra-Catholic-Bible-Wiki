# Romans DB Mapping Issue — Chapter 6 Returns Wrong Book Content

**Type:** qa
**Date:** 2026-05-06
**Question:** Why does querying "Romans" (ወደ ሮሜ ሰዎች) chapter 6 through the Neon DB return 1 Corinthians 6 content instead?
**Last updated:** 2026-05-06
**Related:** [[teaching/baptism]], [[teaching/sin]]

## Answer

A Neon database mapping bug causes the `Romans` book entry (Amharic: ወደ ሮሜ ሰዎች) to return wrong chapter content. Specifically, chapter 6 of Romans returns the text of **1 Corinthians 6** instead of the real Romans 6.

### Impact

- **Romans 6:3–4** (baptism into Christ's death and resurrection) is **not accessible**. This is a critical passage for the [[teaching/baptism]] page, which includes it as a foundational Scripture reference.
- **Romans 6:23** ("the wages of sin is death") appears on [[teaching/sin]] but the text shown is actually 1 Corinthians 6:23 (which does not exist — 1 Corinthians 6 has only 20 verses), meaning the verse reference resolves to stale or wrong content.
- Any teaching page referencing Romans by Amharic name may return content from 1 Corinthians instead.

### Diagnosis

The issue was discovered during Phase 2 Scripture population (2026-05-06) when `scripts/get_verse.mjs` was invoked for Romans 6. The script returned 1 Corinthians 6 verse text instead of Romans 6 text. The root cause is likely a `books` table row with a mis-mapped `id` foreign key in the `formatted_chapter_contents` table, or a book-name lookup collision between the two Pauline epistles.

### Workaround

Until the Neon DB is fixed, Romans 6 references on wiki pages carry a `[DB-issue]` marker. No fallback text source is available in the wiki itself.

## Sources

- Neon DB query via `scripts/get_verse.mjs Romans 6` (2026-05-06) — returned 1 Corinthians 6 content
- `wiki/teaching/baptism.md` — Open questions line 36: DB mapping needs fixing
- `wiki/teaching/sin.md` — Romans 6:23 citation line 114 (content may be unreliable)
- `log.md` line 18 — "DB issue found: Romans 6 maps to 1 Corinthians 6 content"
