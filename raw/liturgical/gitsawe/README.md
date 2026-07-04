# መጽሐፈ ግጻዌ (Gitsawe Lectionary) — pilot findings, መስከረም

**Source:** «መጽሐፈ ግጻዌ ከነምልክቱ በጣዖመ ዜማ ዘደብር ዓባይ» — the Debre Abay monastery's edition,
comp. ሊቀ ሊቃውንት አባ ጥዑመ ልሳን ኪ/ማርያም ዘደብር ዓባይ, Addis Ababa, 2006 ዓ.ም.
Downloaded from myorthodoxbooks.org/geez/ (2026-07-04). 182 pages, scanned (RC4-encrypted,
copy-protected, no digital text layer — every page had to be read visually, page image by
page image; `pdftotext` returns only a fragmented watermark on every page).

**Status:** structure-only pilot for መስከረም (PDF pages 5–16 = printed pages 9–20).
**Days 1–7 confirmed and usable; paused at Day 8 pending a fluent reader's
confirmation of day-of-month numbering** (see "PAUSED at Day 8" below).
No chapter/verse numbers are recorded anywhere — see "Why no verse numbers" below.

## The book's own structure (from its preface, pages 2–3)

Three parts:
1. **ዘወትር** — the daily readings (what this pilot covers)
2. Saints'/martyrs' commemorations by month and day (the red-text headers above each
   day's table — who is commemorated, shown alongside the readings)
3. **የእሁድ ሥርዓት** — the Sunday-cycle system, governed by separate charts elsewhere in
   the book (not yet examined) — this is almost certainly the "formula" that's hard to
   follow: Ethiopian tradition assigns each liturgical year to one of the four
   Evangelists (ዓመተ ማቴዎስ/ማርቆስ/ሉቃስ/ዮሐንስ, a 4-year rotation), and Sunday readings likely
   vary by which Evangelist's year it is — analogous to, but distinct from, the Roman
   3-year Sunday cycle (A/B/C) our app already computes in `web/server/liturgical.ts`.
   Worth investigating as a separate, focused follow-up once someone who knows the
   system can confirm how it works.

## The daily reading formula (confirmed — same structure, all 10+ days examined)

Every ordinary day has exactly three moments, always in this order:

| ገጽ (moment) | What's read |
|---|---|
| **ዘንጉህ** (Matins) | One ምስባክ (Psalm response) only |
| **ወንጌል ዘቅዳሴ** (pre-Liturgy block) | Four readings in fixed order — a Gospel, a Pauline epistle, a Catholic epistle (ያዕቆብ/ጴጥሮስ/ዮሐንስ/ይሁዳ), and ግብረ ሐዋርያት (Acts) — followed by a second ምስባክ |
| **ቅዳሴ** (the Liturgy proper) | One Gospel reading, rotating day to day among ማቴዎስ/ማርቆስ/ሉቃስ/ዮሐንስ |

This is the same skeleton as the Byzantine/Coptic/Ethiopian daily-office pattern:
Epistle → Catholic Epistle → Acts → Psalm/Alleluia → Gospel, with a separate Matins
psalm before all of it.

## Book-name abbreviation key (page 4 of the source, transcribed in full)

| Full name | Abbreviation |
|---|---|
| ወደ ሮሜ ሰዎች | ሮሜ |
| 1ኛ ወደ ቆሮንቶስ | ቆር.ቀ |
| 2ኛ ወደ ቆሮንቶስ | ቆር.ካ |
| ወደ ገላትያ | ገላ |
| ወደ ኤፌሶን | ኤፌ |
| ወደ ፊልጵስዩስ | ፊልጵ |
| ወደ ቆላስይስ | ቆላስ |
| 1ኛ ወደ ተሰሎንቄ | ተሰሎ.ቀ |
| 2ኛ ወደ ተሰሎንቄ | ተሰሎ.ካ |
| 1ኛ ጢሞቴዎስ | ጢሞ.ቀ |
| 2ኛ ጢሞቴዎስ | ጢሞ.ካ |
| ወደ ቲቶ | ቲቶ |
| ወደ ፊልሞና | ፊልሞ |
| ወደ ዕብራውያን | ዕብራ |
| የያዕቆብ መልእክት | ያዕቆ |
| 1ኛ ጴጥሮስ | ጴጥ.ቀ |
| 2ኛ ጴጥሮስ | ጴጥ.ካ |
| 1ኛ ዮሐንስ | ዮሐ.ቀ |
| 2ኛ ዮሐንስ | ዮሐ.ካ |
| 3ኛ ዮሐንስ | ዮሐ.ሣ |
| የይሁዳ መልእክት | ይሁዳ |
| የዮሐንስ ራእይ | ራእ.ዮሐ |
| ግብረ ሐዋርያት | ግብ.ሐዋ |
| ምስባክ (Psalm response) | ምስባ |
| ወንጌል ዘማቴዎስ | ማቴ |
| ወንጌል ዘማርቆስ | ማር |
| ወንጌል ዘሉቃስ | ሉቃ |
| ወንጌል ዘዮሐንስ | ዮሐ |
| ቅዳሴ (the liturgy text itself) | ቅዳ |

Note: no Old Testament books appear in this legend — the daily office readings in this
tradition draw only from Psalms + New Testament. OT readings, if any, live elsewhere
in the book (e.g. within the ቅዳሴ/Anaphora text itself) or in the saints'-day part.

## Why no verse numbers

The ም. (chapter) / ቁ. (verse) columns are printed in a decorative Ge'ez numeral
typeface. Even at 600 DPI single-cell crops, the glyphs could not be distinguished
from ordinary consonant letters with confidence. A first attempt at identifying a
verse from its incipit's content (assuming Day 1's Psalm was the classic New Year
verse, Ps 65:11) turned out to be a pattern-match guess that didn't match the actual
crop once re-examined carefully — exactly the kind of error this whole project is
built to avoid. Getting exact verse ranges out of this source needs either a cleaner
scan or a reader fluent in this book's numeral notation.

## Day-by-day book assignments — CONFIRMED for Meskerem 1–7 only

These 7 days are anchored two independent ways: Day 1 is the book's own opening
(እንቁጣጣሽ, New Year — unmistakable), and Day 7's commemoration text («አባ ቢሦራ...
ቅዱስ ሚካኤል») was read identically on two separate occasions in this session,
including before any pilot was planned. Sequential day-block counting between
these two anchors is internally consistent (7 blocks, 7 days, no skips or merges).

| Day | ዘንጉህ | ወንጌል ዘቅዳሴ (Gospel · Pauline · Catholic · Acts) | ቅዳሴ Gospel |
|---|---|---|---|
| 1 (እንቁጣጣሽ — New Year) | ምስባክ | ሉቃስ · ቆር.[ordinal uncertain] · ያዕቆብ · ግብ.ሐዋ | ማቴዎስ |
| 2 | ምስባክ | ማቴዎስ · ተሰሎ.ቀ · ዮሐ.ቀ · ግብ.ሐዋ | ማርቆስ |
| 3 | ምስባክ | ማቴዎስ · ጢሞ.[ordinal uncertain] · ኤፌ(?) · ግብ.ሐዋ | ማቴዎስ |
| 4 (Abune Samuel of Debre Abay — this monastery's own patron) | ምስባክ | ሉቃስ · ሮሜ · ጴጥ.ቀ · ግብ.ሐዋ | ዮሐንስ |
| 5 | ምስባክ | ሉቃስ · ዕብራ(?) · ያዕቆብ · ግብ.ሐዋ | ማርቆስ |
| 6 | ምስባክ | ሉቃስ · ዕብራ(?) · ይሁዳ · ግብ.ሐዋ | ማቴዎስ |
| 7 | ምስባክ | ማቴዎስ · ሮሜ · ያዕቆብ · ግብ.ሐዋ | ማቴዎስ |

## PAUSED at Day 8 — day-numbering could not be independently verified (2026-07-04)

Continuing past Day 7, I hit the same root problem that blocked chapter/verse
numbers, one level up: **the red day-of-month headers are also in a Ge'ez numeral
typeface that I could not reliably distinguish**, even with targeted high-resolution
crops (attempted at 500 DPI on PDF pages 8–9; the glyphs remained ambiguous, and my
own coordinate-guessing for where to crop kept missing the target — itself a sign of
how dense this particular scan is).

Two candidate methods disagreed and I could not resolve which was right:
- **Sequential block-counting** (treat the 8th red header found, in order, as
  Meskerem 8) — simple, but silently wrong if any block was mis-split or merged
  earlier, and unverifiable without reading the numerals.
- **Numeral reading** of the header itself — the numerals looked plausible but I
  cannot certify them at this print quality (same issue as verse numbers).

One internal cross-check flagged a likely mismatch: a block in this range mentions
**ሚካኤል** (Michael) in its commemoration text. Michael's monthly feast in Ethiopian
tradition falls on a fixed day-of-month, and if that's day 12 (general practice —
not independently re-verified in this project), it wouldn't line up with that
block's sequential position. That discrepancy is exactly why I stopped rather than
publish a guessed day number.

**Decision (user, 2026-07-04): stop and get a fluent reader to confirm day
numbering before continuing.** This matches the same discipline applied throughout
this project — no unverified citation gets published as fact.

### What a reviewer needs

- `source/pages/f009-009.png` through `f016-016.png` — the 12 rendered page images
  (PDF pages 5–16, printed pages 9–20), already in this folder; no PDF tools needed.
- Printed pages 9–13 (`f005`–`f009`) cover the confirmed Days 1–7 — useful as a
  calibration check for a reviewer to confirm they're reading the same numeral
  shapes I read for Days 1 and 7 before moving into the unconfirmed range.
- Printed pages 14–20 (`f010`–`f016`) are the unconfirmed territory: please read
  off the actual day-of-month number from each red header directly, rather than
  assuming sequential order continues cleanly.
- `source/metshafe-gitsawe.pdf` — the full source, if higher-resolution re-crops
  of specific headers are wanted (`pdftoppm -f <pdf-page> -l <pdf-page> -r 500 ...`).

## Recommendation

Days 1–7 have real, usable value now (a priest could use "on this day, at ቅዳሴ read
from ሉቃስ; at ወንጌል ዘቅዳሴ read Romans, James, Acts" even without exact verse numbers —
a native reader knows the passage from the book + context). The `(?)`-flagged cells
within those 7 days should still be confirmed before being treated as final. Days
8–30 need a fluent reader's day-number confirmation before any further transcription
work is worth doing — otherwise correctly-read content risks being filed under the
wrong date.
