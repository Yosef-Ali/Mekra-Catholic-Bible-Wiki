# Catechism — Source Manifest

**Book:** Compendium of the Catechism of the Catholic Church (Amharic edition)
**Amharic title:** የካቶሊክ ቤተ ክርስቲያን ትምህርተ ክርስቶስ አጭር ማብራሪያ
**Original work:** Compendium of the CCC, promulgated by Pope Benedict XVI, 2005
**Structure:** 598 numbered Q&A items across 4 parts (Creed, Sacraments, Commandments, Prayer), plus appendices

## Why this book

The Compendium has stable question numbers (1–598) that are identical across all language editions worldwide. This means every Amharic Q&A can be cross-verified against the official Vatican English/Italian/Latin editions. This is a stronger foundation for a Catholic teaching wiki than the full CCC would be, because the paragraph-number alignment across languages is cleaner.

## What's in the source_tif/ folder

151 TIF files copied (not moved) from `/Users/mekdesyared/Pictures/cc/` on 2026-04-08. Originals left in place as backup.

Canonical scan set chosen: **`-2-page-a` + `-2-page-b` + `-tc` + `-tc-new`**

Rationale:
- `-2-page-a/b` set has 137 files, ~2 MB each, named with the left/right book-spread convention used by VueScan. This is clearly the final clean scan pass.
- `-tc` / `-tc-new` set (13 files) contains the front matter (title page, ma'wuča/table of contents, preface). Without these, the book body wouldn't have its chapter/section headings in context.
- The older `1-38` set and loose `-2 1/2/3.tif` fragments were NOT copied. They appear to be earlier incomplete scan passes. Left in `Pictures/cc/` untouched in case we need them later.

## What's in source_jpg/

151 JPEGs converted from the TIFs using macOS `sips`:
- Format: JPEG, quality 90
- DPI: 300×300
- Typical dimensions: ~1011×1394 pixels (matches the original scan resolution; sips preserves the pixel count while normalizing DPI metadata)
- Total size: ~95 MB (down from 278 MB TIF)

This is the folder to feed to the Gemini OCR pipeline.

## Verification of page 1 (the sample we looked at)

One page was visually verified in this session: `compendium of the catecism of the catholics-tc 3.tif` (front matter, ma'wuča / table of contents, page marked "ii" at the bottom). The scan is clean, two-column layout, clearly Amharic fidel script, minor rotation (~1°), minor ghosting from reverse page, no cutoff. Quality is good enough for Gemini OCR without additional preprocessing. If OCR accuracy is poor on the first real pass, we should try ImageMagick deskew (`-deskew 40%`) before re-running.
