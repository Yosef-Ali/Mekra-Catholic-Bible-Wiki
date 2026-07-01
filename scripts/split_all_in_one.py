#!/usr/bin/env python3
"""
split_all_in_one.py — split the "All in One" hymn deck into per-song RAG units.

The deck (raw/liturgical/hymns/All in one 1.pptx, ~5,478 slides) is one giant
PowerPoint holding hundreds of Amharic hymns back-to-back. This script segments
it into one markdown file per song under raw/liturgical/hymns/songs/, plus an
index.md, so each hymn is an independent retrieval unit (like the per-Q
Compendium units in raw/catechism-digital/).

Segmentation is two-tier:

  TIER 1 — title placeholders (the author's own markers).
    Most songs put their title in a PowerPoint *title* placeholder on the first
    slide (ph type="title"), while verse slides use only *body* placeholders.
    A song boundary is a title-bearing slide whose predecessor is NOT
    title-bearing. This also collapses the ~65 songs where the author put a
    title box on every slide (a run of consecutive title slides => one song).

  TIER 2 — refrain cycles (for segments the author left untitled).
    A handful of regions are long blobs (up to 125 slides) because only the
    first song in the run got a title. Within any Tier-1 segment longer than
    THRESH slides, we detect refrains (a normalized slide text that repeats)
    and cut when the refrain changes — the classic verse/refrain (አዝማች)
    alternation. A merge-back pass rejoins any fragment under MIN_LEN slides
    into the previous song, so songs with two alternating refrain variants
    don't shatter. Merge-back is scoped to the segment, so the cleanly-titled
    majority of songs are never altered.

Two long entries (>25 slides) survive with no clean refrain cycle; they are
likely genuine long praise medleys and are left whole by design.

Archaic Amharic forms are preserved verbatim. Idempotent: wipes and rebuilds
raw/liturgical/hymns/songs/ each run.

Usage:  python3 scripts/split_all_in_one.py   (run from the vault root)
"""

import os
import re
import shutil
import zipfile
from collections import Counter
from datetime import date
from xml.etree import ElementTree as ET

A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
P = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
VAULT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HYMNS = os.path.join(VAULT, "raw", "liturgical", "hymns")
SRC = os.path.join(HYMNS, "All in one 1.pptx")
OUT = os.path.join(HYMNS, "songs")
TODAY = date.today().isoformat()

THRESH = 16   # only refrain-split Tier-1 segments longer than this
MIN_LEN = 3   # merge Tier-2 fragments shorter than this back into previous

# Hand-verified overrides for the long auto-segments that bundled multiple
# hymns the auto-splitter could not separate (medleys where only the first
# song was titled, songs whose 2nd hymn has no repeating refrain, and blocks
# holding liturgical rubric/blank slides). Keyed by the auto-song (start,end);
# value = the corrected sub-song ranges. Slides omitted from the sub-ranges
# (e.g. ንባባት/ምስባክ/ወንጌል rubric headers, trailing blanks) are intentionally
# dropped — they are not hymns and remain in the master all-in-one.md.
# Derived by eyeballing first-lines + refrain (አዝማች) cycles (2026-07-01).
MANUAL_SPLITS = {
    (265, 281):  [(265, 269), (270, 281)],
    (942, 959):  [(942, 949), (950, 959)],
    (977, 999):  [(977, 986), (987, 994), (995, 999)],
    (1205, 1223): [(1205, 1215), (1216, 1223)],
    (1381, 1398): [(1381, 1387), (1388, 1398)],
    (1473, 1489): [(1473, 1481), (1482, 1489)],
    (1670, 1688): [(1670, 1680), (1681, 1688)],
    (1828, 1846): [(1828, 1834), (1835, 1846)],
    (2001, 2017): [(2001, 2008), (2009, 2015), (2016, 2017)],
    (2184, 2199): [(2184, 2191), (2192, 2199)],
    (2273, 2289): [(2280, 2289)],
    (2341, 2359): [(2341, 2344), (2345, 2351), (2352, 2359)],
    (2433, 2458): [(2433, 2435), (2436, 2439), (2440, 2442),
                   (2443, 2445), (2446, 2448), (2449, 2458)],
    (2685, 2717): [(2685, 2691), (2710, 2717)],
    (3179, 3196): [(3180, 3186), (3187, 3196)],
    (3841, 3862): [(3841, 3841), (3842, 3848), (3849, 3856), (3857, 3862)],
    (4047, 4062): [(4047, 4055)],
    (4091, 4106): [(4091, 4100), (4101, 4106)],
    (4405, 4424): [(4405, 4410), (4411, 4416), (4420, 4424)],
    (4891, 4909): [(4891, 4897), (4898, 4909)],
    (5047, 5063): [(5047, 5054), (5055, 5061), (5062, 5063)],
    (5454, 5469): [(5454, 5459), (5460, 5469)],
}


def load_slides():
    z = zipfile.ZipFile(SRC)
    total = len([n for n in z.namelist()
                 if re.match(r"ppt/slides/slide\d+\.xml$", n)])
    info = {}
    for n in range(1, total + 1):
        root = ET.fromstring(z.read(f"ppt/slides/slide{n}.xml"))
        title, lines = "", []
        for sp in root.iter(P + "sp"):
            ph = sp.find(f".//{P}ph")
            typ = ph.get("type") if ph is not None else None
            ls = []
            for p in sp.iter(A + "p"):
                t = "".join(r.text for r in p.iter(A + "t") if r.text).strip()
                if t:
                    ls.append(t)
            if typ in ("title", "ctrTitle") and ls and not title:
                title = ls[0]
            lines += ls
        info[n] = (title, lines)
    return info, total


def norm(lines):
    return re.sub(r"[\s፡።፣፤፥/()0-9]+", "", "".join(lines))


def segment(info, total):
    has_title = {n: bool(info[n][0]) for n in info}
    starts = [n for n in range(1, total + 1)
              if has_title[n] and not has_title.get(n - 1, False)]
    seg = [(starts[i], (starts[i + 1] - 1 if i + 1 < len(starts) else total))
           for i in range(len(starts))]

    def refrain_split(s, e):
        rng = [n for n in range(s, e + 1) if norm(info[n][1])]
        if not rng:
            return [(s, e)]
        texts = {n: norm(info[n][1]) for n in rng}
        counts = Counter(texts.values())
        refrains = {t for t, k in counts.items() if k >= 2 and len(t) >= 6}
        if not refrains:
            return [(s, e)]
        out, ss, cur, last = [], rng[0], None, None
        for n in rng:
            t = texts[n]
            if t in refrains:
                if cur is None or t == cur:
                    cur, last = t, n
                else:
                    out.append((ss, last))
                    ss, cur, last = last + 1, t, n
        out.append((ss, e))
        merged = []
        for span in out:
            if merged and (span[1] - span[0] + 1) < MIN_LEN:
                merged[-1] = (merged[-1][0], span[1])
            else:
                merged.append(list(span))
        return [tuple(x) for x in merged]

    songs = []
    for s, e in seg:
        songs += refrain_split(s, e) if (e - s + 1 > THRESH) else [(s, e)]
    # drop wholly-empty spans
    return [(s, e) for s, e in songs
            if any(norm(info[n][1]) for n in range(s, e + 1))]


# Short, recognizable incipits for songs whose source title box held a whole
# verse/refrain (often a doubled refrain like "PHRASE PHRASE (2)"). Keyed by
# the song's start slide (stable across re-runs). Applied to both the heading
# and the filename slug. Hand-assigned 2026-07-01.
TITLE_OVERRIDES = {
    175: "በተሰበሰበ ምስጋና",
    232: "ስለኛ ብሎ ልጅሽ ተሰቅሎ",
    435: "እኔ አልሻም",
    440: "ሰው በሚያየው በዚህ ይረካል",
    950: "ምህረት ባህሪው ነው",
    960: "ፍቅርህ መጠጊያዬ",
    1184: "ጌታዬ ዛሬም ታማኝ ነው",
    1381: "ፍቅርህ መጠጊያዬ",
    1388: "ታሪኩ የሚገርም",
    1418: "አልለወጥ ያለኝ",
    1473: "በሰማይም በምድርም",
    1752: "ጉዳይ አለህ ከታናናሾች ጋር",
    2016: "እኔ የማምነው አንድ ነገር",
    2192: "አቁመኝ በአላማዬ",
    2200: "ጉዳይ አለህ ከታናናሾች ጋር",
    2242: "አልለወጥ ያለኝ",
    2280: "እኔ የማምነው አንድ ነገር",
    2424: "ምፅዋትን ከሰጠህ ለታይታ",
    2433: "እግዚአብሔር እኮ ቀን አለው",
    2436: "ይሆናል በእርሱ ይሆናል",
    2440: "አንተን ትቶ",
    2443: "አቤቱ እንደቸርነትህ መጠን ማረኝ",
    2446: "ጌታ ማረን",
    2685: "ጉዳይ አለህ ከታናናሾች ጋር",
    3531: "ጌታዬ ዛሬም ታማኝ ነው",
    3725: "አቁመኝ በአላማዬ",
    3732: "ፀጋን የሞላሽ ማርያም",
    3833: "ምህረት እውነት ስለበዛ",
    3841: "በፅድቅህ ፊትህን እናየዋለን",
    3842: "ፀጋን የሞላሽ ማርያም",
    3857: "ወደ ተራራማው ወደ ይሁዳ",
    4405: "ጉዳይ አለህ ከታናናሾች ጋር",
    4411: "በሰማይም በምድርም",
    4432: "ጌታዬ ዛሬም ታማኝ ነው",
    4438: "ፍቅርህ መጠጊያዬ",
    4485: "ጌታዬ ዛሬም ታማኝ ነው",
    5062: "እኔ የማምነው አንድ ነገር",
    5454: "ጉዳይ አለህ ከታናናሾች ጋር",
    5470: "በነጋ በጠባ ጠላቴ ሲከሰኝ",
}


def slugify(title, fallback):
    t = title or fallback
    t = re.sub(r'[/()\[\]{}.,:;!?"\'፡።፣፤፥#*×•\-–—]+', " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    slug = "-".join(t.split(" ")[:7])[:50].strip("-")
    return slug or "untitled"


# --- season/theme tagging ---------------------------------------------------
# Keyword classification over each song's text using high-precision Amharic
# markers (archaic forms included). A song may carry several tags; ~38% carry
# none (general worship/testimony) and are left blank rather than force-fit.
# TAG_LEGEND fixes both the Amharic↔English glossary and the tag display order
# (liturgical seasons first, then themes). Eucharist also fires on a ሥጋ+ደም
# co-occurrence — a small soft spot where a few incarnation references may slip
# in. Verified against the song corpus 2026-07-01.
TAG_LEGEND = [
    ("ልደት", "Christmas/Nativity"),
    ("ስቅለት", "Cross/Passion"),
    ("ትንሣኤ", "Easter/Resurrection"),
    ("መንፈስ ቅዱስ", "Pentecost/Holy Spirit"),
    ("ማርያም", "Marian"),
    ("ቁርባን", "Eucharist/Communion"),
    ("ምስጋና", "Praise/Thanksgiving"),
    ("ምሕረት", "Mercy"),
    ("እምነት", "Trust/Faith"),
    ("ፈውስ", "Petition/Healing"),
]
_TAG_KW = {
    "ልደት": r"ተወለደ|ልደት|ቤተልሔም|በበረት|ጨቅላ",
    "ስቅለት": r"መስቀል|ተሰቀለ|ተሰቅሎ|ስቅለት|ቀራንዮ|ሕማም|ጎኑን|ችንካር|ተቸነከረ",
    "ትንሣኤ": r"ትንሣኤ|ትንሳኤ|ፋሲካ|ተነሥ|ተነስቷል|ተንሥ|ከሙታን|ከመቃብር|መቃብር ፈንቅሎ"
             r"|ሞትን ድል|ሞትን አሸነፈ|ሞትን ረታ",
    "መንፈስ ቅዱስ": r"መንፈስ ቅዱስ|ጰራቅሊጦስ|ጴራቅሊጦስ",
    "ማርያም": r"ማርያም|እመቤት|ድንግል|ወላዲተ|እመቤታችን",
    "ምስጋና": r"ምስጋና|አመሰግን|ተመስገን|አወድስ|ውዳሴ|ላመስግን|እናመሰግን|አሞግስ|ዝማሬ",
    "ምሕረት": r"ምሕረት|ምህረት|ይቅርታ|ማረኝ|ማረን|ይቅር በለኝ",
    "እምነት": r"መታመኛ|ተማመን|መጠጊያ|አምባ|መሸሸጊያ|ታመንኩ|ምርኩዝ|ዐለት",
    "ፈውስ": r"ፈውስ|ፈውሰኝ|አድነኝ|እባክህ|ጩኸት|ለምኜ|ማልደኝ",
}


def classify(text):
    tags = []
    for tag, _ in TAG_LEGEND:
        if tag == "ቁርባን":
            hit = bool(re.search(
                r"ቁርባን|ማዕድ|መሠዊያ|መሰዊያ|ሥጋህን|ሥጋህ|ሥጋውን|ሥጋሽን|ሥጋ ወደም|ሥጋና ደም",
                text)) or (("ሥጋ" in text or "ስጋ" in text) and "ደም" in text)
        else:
            hit = bool(re.search(_TAG_KW[tag], text))
        if hit:
            tags.append(tag)
    return tags


def main():
    info, total = load_slides()
    songs = segment(info, total)
    # apply hand-verified overrides for the multi-hymn medleys
    corrected = []
    for span in songs:
        corrected += MANUAL_SPLITS.get(span, [span])
    songs = corrected
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)

    # build song records (title / file / body / tags) in one pass
    n_songs = len(songs)
    records = []
    for i, (s, e) in enumerate(songs, 1):
        title = TITLE_OVERRIDES.get(s) or info[s][0].strip() \
            or (info[s][1][0] if info[s][1] else "")
        title = title.strip() or f"(untitled {i})"
        slug = slugify(title, f"song-{i}")
        fname = f"{i:04d}-{slug}.md"
        chunks = [  # every slide's lines, blank line between slides
            "\n".join(info[n][1]) for n in range(s, e + 1) if info[n][1]
        ]
        body = "\n\n".join(chunks)
        tags = classify(title + "\n" + body)
        records.append((i, s, e, title, fname, body, tags))

    tag_counts = Counter(t for r in records for t in r[6])
    n_untagged = sum(1 for r in records if not r[6])

    index = ["# All in One — song index", "",
             "**Type:** hymn-index",
             "**Collection:** All in One",
             f"**Songs:** {n_songs}",
             f"**Source file:** All in one 1.pptx ({total} slides)",
             f"**Extracted:** {TODAY}",
             "**Extractor:** scripts/split_all_in_one.py",
             "",
             "Segmented by the author's own PowerPoint title markers, with",
             "refrain-cycle splitting inside over-long untitled blobs, then a",
             "hand-verified pass (MANUAL_SPLITS) that separated the multi-hymn",
             "medleys the auto-splitter could not. Rubric/blank slides (ንባባት,",
             "ምስባክ, ወንጌል, empty) inside those medleys were dropped as non-songs.",
             f"{sum(1 for s,e in songs if e-s+1>15)} entries still exceed 15 slides "
             "(refrain-less praise clusters kept whole by design).",
             "",
             "## Tags (season/theme)",
             "",
             "Keyword-classified; a song may carry several tags. "
             f"{n_untagged} songs are untagged (general worship/testimony).",
             "",
             "| Tag | English | Songs |",
             "|---|---|---|"]
    for tag, eng in TAG_LEGEND:
        index.append(f"| {tag} | {eng} | {tag_counts.get(tag, 0)} |")
    index += ["",
              "## Songs",
              "",
              "| # | Title | Tags | Slides | File |",
              "|---|---|---|---|---|"]

    for i, s, e, title, fname, body, tags in records:
        page = (
            f"# {title}\n\n"
            f"**Type:** hymn\n"
            f"**Amharic:** {title}\n"
            f"**Collection:** All in One\n"
            f"**Tags:** {', '.join(tags) if tags else '—'}\n"
            f"**Song #:** {i} of {n_songs}\n"
            f"**Source slides:** {s}–{e}\n"
            f"**Source file:** All in one 1.pptx\n"
            f"**Extracted:** {TODAY}\n"
            f"**Related:** [[liturgical/hymns]]\n\n"
            f"---\n\n"
            f"{body}\n"
        )
        with open(os.path.join(OUT, fname), "w", encoding="utf-8") as fh:
            fh.write(page)
        index.append(
            f"| {i} | {title[:50]} | {', '.join(tags)} | {s}–{e} | `{fname}` |")

    with open(os.path.join(OUT, "index.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(index) + "\n")

    print(f"wrote {n_songs} song files + index.md to "
          f"{os.path.relpath(OUT, VAULT)}/")


if __name__ == "__main__":
    main()
