# Hymns & Mezmur (መዝሙር) — index

**Type:** liturgical
**Amharic:** መዝሙር / ዝማሬ
**Sources:** 2
**Last updated:** 2026-07-01
**Related:** [[liturgical/qidase]], [[liturgical/feasts/ፋሲካ]], [[liturgical/seasons/Easter]], [[teaching/the-mass]], [[figures/ማርያም]]

## What this is

An index of the **Amharic Catholic hymnody (መዝሙር / ዝማሬ)** now held in the vault. Hymns are the sung prayer that surrounds the Qidase and the liturgical seasons — praise (ምስጋና), Marian song, communion hymns, and the great resurrection hymns of Fasika. The full text lives in `raw/liturgical/hymns/`; this page is the map to it.

Two sources so far:

| Source | File | Size | Content |
|---|---|---|---|
| **All in One** collection | `raw/liturgical/hymns/all-in-one.md` + `songs/` | 5,478 slides → **697 songs** | Large general Amharic worship-song book — praise, Marian, communion, seasonal |
| **Easter Mezmur** | `raw/liturgical/hymns/easter-mezmur.md` | 5 pp | Focused sheet of resurrection (ትንሣኤ) hymns |

Both keep the archaic Amharic forms of the source verbatim (see the vault's Amharic rules).

## Easter Mezmur (የትንሣኤ መዝሙር)

A compact sheet of resurrection hymns — the songs of Fasika. The songs in it, in order:

1. **ይህን ኢየሱሴን** — "This Jesus" (what shall I do for him?)
2. **እልል እልል** — "Rejoice, rejoice" (መቃብር ፈንቅሎ ኢየሱስ ተነሣ)
3. **የአዲስ ኪዳን በግ** — "Lamb of the New Covenant"
4. **አቤቱ ጉልበቴ ሆይ እወድሀለሁ** — "Lord my strength, I love you" (after Ps. 18)
5. **ዳንኩኝ** — "I am saved" (በጌታዬ ደም ድኛለው)
6. **የእግዚአብሔር ምህረቱ** — "The mercy of God" (after Ps. 103)
7. **ሀሌሉያ ተነስቷል** — "Hallelujah, He is risen"
8. **ከባርነት አገር ወደ አንተ ያመጣኸን** — "You who brought us out of the land of slavery"
9. **እግዚአብሔር ኃያል ነህ** — "God, you are mighty"
10. **ቀራንዮ መስቀል ላይ** — "At Calvary, on the cross"
11. **ኦ ድል ኢየሱስ ሃያል** — "O victory, mighty Jesus"
12. **ገናናዉ የእኛ ኢየሱሱ** — "Our majestic Jesus"
13. **ስራዬን ሁሉ እግዚአብሔር ሰራ** — "God has done all my work"
14. **በምድረ በዳ ልጄ** — "In the wilderness, my child"

> መቃብር ፈንቅሎ ኢየሱስ ተነሣ
> — *እልል እልል*, `raw/liturgical/hymns/easter-mezmur.md`

**Caveat:** the Easter sheet was a two-column PDF; extraction preserves reading order but drops some intra-line spaces (a source-font artifact, not an edit). Titles above are normalized for readability; the raw text is verbatim.

Use these with [[liturgical/feasts/ፋሲካ]] and [[liturgical/seasons/Easter]].

## The "All in One" collection

A large general-purpose Amharic worship-song book — **5,478 slides**, now split into **697 individual songs** under `raw/liturgical/hymns/songs/` (one `NNNN-<title>.md` file per hymn, with `index.md` as the lookup table). It is Christ- and praise-centered, with a strong Marian layer. A rough profile (slides mentioning each term):

- ጌታ (Lord) — 1,372 · ኢየሱስ (Jesus) — 703 · ምስጋና/አመሰግን (praise/thanks) — 602
- ማርያም (Mary) — 368 · መስቀል (cross) — 166 · መንፈስ ቅዱስ (Holy Spirit) — 70 · ቁርባን (communion) — 39

A few representative opening lines (sampled across the book):

- **መጣሁ ላመሰግንህ** — "I have come to praise you"
- **ነፍሴ አንተን ተጠማች** — "My soul thirsts for you"
- **ብርቱ ነው** — "He is mighty"
- **ኦ መንፈስ ቅዱስ ሆይ አንጸባራቂ ብርሃን ና** — "O Holy Spirit, radiant light, come" (Pentecost)
- **ብፅዕት ነሽ ማርያም** — "Blessed art thou, Mary" (Marian)
- **የእግዚአብሔርን ፍቃድ ይሁን ብለሽ ማርያም** — "Mary, who said 'let God's will be done'"

### How to find a hymn

Browse `raw/liturgical/hymns/songs/index.md` (title → tags → slide range → file), or search the per-song files directly:

```sh
grep -rl "ብፅዕት ነሽ ማርያም" raw/liturgical/hymns/songs/    # by a remembered line
grep -rl "^\*\*Tags:\*\*.*ትንሣኤ" raw/liturgical/hymns/songs/   # all Easter hymns
```

Each song file is self-contained (bold-field frontmatter + full text), carries a `**Tags:**` field, and records its `**Source slides:**` range back into `all-in-one.md` for provenance.

### How the split was made

`scripts/split_all_in_one.py` segments the deck three ways: (1) by the author's own PowerPoint **title placeholders** — most songs mark their start with a title box; (2) inside the few over-long untitled **blobs**, by **refrain (አዝማች) cycles** — a new song begins when the repeating refrain line changes, with a merge-back pass so songs with two refrain variants don't shatter; (3) a **hand-verified override table** (`MANUAL_SPLITS`) for the 22 long entries the auto-splitter couldn't separate — medleys where only the first hymn was titled, or where a second hymn had no repeating refrain. Liturgical rubric slides (ንባባት/ምስባክ/ወንጌል) and trailing blanks embedded in those medleys were dropped as non-songs (they remain in the master `all-in-one.md`). The result is **697 songs** (median 8 slides, none over 15). The split is idempotent — re-running the script rebuilds `songs/` from scratch.

### Season & theme tags

Each song carries a `**Tags:**` field, keyword-classified by `classify()` in the same script (high-precision Amharic markers, archaic forms included). A song may carry several tags; **262 (38%) are untagged** — general worship/testimony that hits no specific theme, left blank rather than force-fit. Counts (full legend in `songs/index.md`):

| Tag | English | Songs | | Tag | English | Songs |
|---|---|---|---|---|---|---|
| ማርያም | Marian | 109 | | ስቅለት | Cross/Passion | 41 |
| ምስጋና | Praise/Thanksgiving | 199 | | ትንሣኤ | Easter/Resurrection | 25 |
| ምሕረት | Mercy | 127 | | ልደት | Christmas/Nativity | 20 |
| ፈውስ | Petition/Healing | 60 | | መንፈስ ቅዱስ | Pentecost/Holy Spirit | 17 |
| ቁርባን | Eucharist/Communion | 51 | | እምነት | Trust/Faith | 36 |

Seasonal tags (ልደት/ስቅለት/ትንሣኤ/መንፈስ ቅዱስ) map onto the liturgical year: use them with [[liturgical/seasons/Advent]], [[liturgical/seasons/Lent]], [[liturgical/seasons/Easter]], and [[liturgical/feasts/ፋሲካ]]. **Caveat:** the Eucharist tag also fires on a ሥጋ+ደም (flesh-and-blood) co-occurrence, so a few incarnation/salvation references may be tagged ቁርባን without being strictly communion songs.

## Open questions / future work

- **Cross-link major hymns to their Scripture** — several are psalm settings (Ps. 18, Ps. 103) and could cite the Emmaus DB verse via `scripts/get_verse.mjs`.
- **Promote favourites to `wiki/`** — high-use hymns could get their own synthesis pages linking to teaching and Scripture.

## Sources

- `raw/liturgical/hymns/all-in-one.md` + `raw/liturgical/hymns/songs/` (697 files + `index.md`) — from `All in one 1.pptx`
- `raw/liturgical/hymns/easter-mezmur.md` — from `easter mezmur.pdf`
- Extractors: `scripts/extract_liturgical.py`, `scripts/split_all_in_one.py`
