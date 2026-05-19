# Outstanding Data Issues — Phase 8 Status

**Type:** qa
**Date:** 2026-05-09
**Question:** What DB and source-data issues remain after the catechist's-review batch (Phase 8)?
**Last updated:** 2026-05-09
**Related:** [[qa/2026-05-06-romans-db-mapping]], [[qa/2026-05-06-fourth-commandment-mismatch]], [[qa/2026-05-06-scripture-populate]]

## Summary

After the May 6 db-fix batch, the major Pauline mappings (Romans, 1 Corinthians, 2 Corinthians, Colossians) are confirmed correct. The remaining outstanding issues are:

| Issue | Status | Blocked on |
|---|---|---|
| Romans 6:3 returns wrong content | ✅ FIXED (verified 2026-05-09) | — |
| Colossians 1:1–3 mismaps to 1 Timothy | ✅ FIXED (verified 2026-05-09) | — |
| Sirach 1:1 returns Isaiah commentary text | ❌ STILL BROKEN | Requires re-extraction of Sirach pages (390–409) from PDF, then DB reimport |
| 5 missing Compendium scan pages: 14, 46, 143, 174, 238 | ❌ PENDING | Physical rescan of source book by user |
| Q485–502 (chastity body content) | ❌ PARTIAL | Likely on missing scan pages — same blocker |
| fourth-commandment.md page-content mismatch | ⏸ KNOWN | Q reattribution complete in batch 5; synthesis still flagged |

## DB verification commands run (2026-05-09)

```sh
node scripts/get_verse.mjs Romans 6 3
# → returns "ወይስ ከክርስቶስ ኢየሱስ ጋር አንድ ለመሆን የተጠመቅን ሁላችን..." ✅

node scripts/get_verse.mjs Colossians 1 1-3
# → returns "በእግዚአብሔር ፈቃድ የኢየሱስ ክርስቶስ ሐዋርያ የሆነ ጳውሎስ..." ✅

node scripts/get_verse.mjs Sirach 1 1-3
# → returns Isaiah-1-39 chapter introduction text ❌
```

## Sirach issue — root cause analysis

Source data inspection:

- `extraction_output/page_map.json` correctly maps Sirach to pages **390–409** with **51 expected chapters**.
- `extraction_output/structure_page_390.json` contains a valid Sirach chapter-1 structure with subtitles (የምሳሌዎች መድብል, የጥበብ ምንጭ, etc.) but the `verses` array is **empty**.
- The DB sync therefore had nothing valid to import for Sirach; what is in the DB now appears to be content imported under the wrong book label or contamination from another book's extraction.

### Fix path (deferred)

1. Re-run Gemini structured extraction on `pages/page_390.png` through `pages/page_409.png` with a tighter prompt that forces verse extraction.
2. Validate output against `expected_chapters: 51` and reasonable verse counts per chapter.
3. Write a Sirach-specific reimport script (modeled on `scripts/reimport-pauline.mjs`).
4. Re-run `node scripts/get_verse.mjs Sirach 1 1` and verify against the printed Bible.

This is a several-hour task with API spend; deferred until prioritized.

## Compendium missing-scan blocker

The five missing printed pages (14, 46, 143, 174, 238) hold:
- **p.14**: Q5–7 area (faith)
- **p.46**: Q21, Q23 area (revelation)
- **p.143**: Q263–264 area (baptism)
- **p.174**: Q422–426 area (grace)
- **p.238**: Lord's Prayer area

Q gaps in the OCR'd corpus (historical, from the legacy `raw/catechism/extracted/` archive):
```
5, 6, 7, 21, 23, 113, 114, 115, 122, 177, 178, 181, 182, 408, 417, 455, 483, 484, 485, 557
```

*Resolved 2026-05-19: All but Q417 are now present in the canonical digital extraction at `raw/catechism-digital/`. Q417 is absent from the publisher's source itself (a publication anomaly, not extraction defect). The OCR archive has been removed.*

## Q485–502 chastity content status

Per the batch-5 commandment audit (commit `2905918`), the **sixth-and-ninth-commandments** teaching page expects Q485–502 (chastity body content) but only partially has them. Q&As actually present per qa_index:
- Q485: ❌ missing
- Q486: ❌ missing
- Q487–Q502: present ✅ (per qa_index)
- Q503+: covered in fourth-commandment Q range

The missing Q485–486 likely live on a partial scan that needs re-OCR. Not catastrophic — sixth-and-ninth-commandments has working synthesis text and the Q&As that did extract.

## What Phase 8 accomplished

- ✅ Verified the major Pauline DB fixes from May 6 are stable.
- ❌ Could not auto-fix Sirach — root cause is upstream of the DB (extraction-side empty verses).
- 📝 Documented all remaining issues with concrete fix paths.

## Recommended user action

When time permits:
1. **Rescan** Compendium pages 14, 46, 143, 174, 238 → drop into `source_jpg/`.
2. **Re-OCR** by running `node scripts/ocr_compendium.mjs` (idempotent — only processes new files).
3. **Sirach** — schedule a focused extraction pass on PDF pages 390–409. The structure_page JSONs need their `verses` arrays populated.

## Sources

- `scripts/get_verse.mjs` (live DB query)
- `extraction_output/page_map.json`
- `extraction_output/structure_page_390.json`
- Prior batches: db-validate (2026-05-06), db-fix (2026-05-06), batch 5 (2026-05-08)
