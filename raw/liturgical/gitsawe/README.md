# መጽሐፈ ግጻዌ (Gitsawe Lectionary) — pilot findings, መስከረም

**Source:** «መጽሐፈ ግጻዌ ከነምልክቱ በጣዖመ ዜማ ዘደብር ዓባይ» — the Debre Abay monastery's edition,
comp. ሊቀ ሊቃውንት አባ ጥዑመ ልሳን ኪ/ማርያም ዘደብር ዓባይ, Addis Ababa, 2006 ዓ.ም.
Downloaded from myorthodoxbooks.org/geez/ (2026-07-04). 182 pages, scanned (RC4-encrypted,
copy-protected, no digital text layer — every page had to be read visually, page image by
page image; `pdftotext` returns only a fragmented watermark on every page).

**Status:** structure-only pilot for መስከረም (PDF pages 5–16 = printed pages 9–20).
No chapter/verse numbers are recorded — see "Why no verse numbers" below.

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

## Day-by-day book assignments — Meskerem 1–10 (confidence noted; NOT independently
## re-verified against a second source — treat as a careful first pass)

| Day | ዘንጉህ | ወንጌል ዘቅዳሴ (Gospel · Pauline · Catholic · Acts) | ቅዳሴ Gospel |
|---|---|---|---|
| 1 (እንቁጣጣሽ — New Year) | ምስባክ | ሉቃስ · ቆር.[ordinal uncertain] · ያዕቆብ · ግብ.ሐዋ | ማቴዎስ |
| 2 | ምስባክ | ማቴዎስ · ተሰሎ.ቀ · ዮሐ.ቀ · ግብ.ሐዋ | ማርቆስ |
| 3 | ምስባክ | ማቴዎስ · ጢሞ.[ordinal uncertain] · ኤፌ(?) · ግብ.ሐዋ | ማቴዎስ |
| 4 (Abune Samuel of Debre Abay — this monastery's own patron) | ምስባክ | ሉቃስ · ሮሜ · ጴጥ.ቀ · ግብ.ሐዋ | ዮሐንስ |
| 5 | ምስባክ | ሉቃስ · ዕብራ(?) · ያዕቆብ · ግብ.ሐዋ | ማርቆስ |
| 6 | ምስባክ | ሉቃስ · ዕብራ(?) · ይሁዳ · ግብ.ሐዋ | ማቴዎስ |
| 7 | ምስባክ | ማቴዎስ · ሮሜ · ያዕቆብ · ግብ.ሐዋ | ማቴዎስ |
| 8 | ምስባክ | ማቴዎስ · ዕብራ · ያዕቆብ · ግብ.ሐዋ | ሉቃስ |
| 9 | ምስባክ | ማቴዎስ · ቆር.ቀ · ይሁዳ · ግብ.ሐዋ | ማቴዎስ |
| 10 | ምስባክ | ሉቃስ · ቆር.ቀ · ኤፌ(?) · ግብ.ሐዋ | ማቴዎስ |

Days 11–30 (PDF pages 11–16) show the identical structural pattern but were not
transcribed to the same level of per-cell confidence in this pass — the abbreviation
cells for the Pauline/Catholic epistle slots are the recurring soft spot (small,
sometimes-ambiguous marks distinguishing e.g. ኤፌ vs a similar-looking neighbor, or
the ቀ/ካ ordinal marks). Continuing days 11–30 at the same care level, or having a
fluent reader spot-check the (?) entries above, are the natural next steps.

## Recommendation

This confirms option 3 is achievable and the book/reading-source data has real value
(a priest could use "on this day, at ቅዳሴ read from ሉቃስ; at ወንጌል ዘቅዳሴ read Romans,
James, Acts" even without exact verse numbers — a native reader knows the passage from
the book+context). But precision matters here the same way it did for the Bible text
itself: the (?)-flagged entries above should not be treated as final until confirmed
by someone who reads this specific book's notation fluently.
