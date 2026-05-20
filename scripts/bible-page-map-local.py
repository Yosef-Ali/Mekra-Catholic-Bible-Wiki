#!/usr/bin/env python3
"""
Build an accurate page map by scanning the PDF locally with PyMuPDF.
No API needed — detects book starts from Amharic title patterns.

Usage: python3 scripts/bible-page-map-local.py
Output: extraction_output/page_map.json
"""
import json, re, fitz, os, sys

PDF_PATH = "The Amharic Bible Catholic Edition - Emmaus.pdf"
OUT_PATH = "extraction_output/page_map.json"

# All 73 books with Amharic name fragments to search for
BOOKS = [
    # Search terms are more specific to avoid matching cross-references.
    # Terms like "መጽሐፈ ሩት" match the book title heading, not footnote refs.
    {"name": "Genesis",         "amharic": "ኦሪት ዘፍጥረት",  "search": ["ዘፍጥረት"],                     "expected_chapters": 50},
    {"name": "Exodus",          "amharic": "ኦሪት ዘፀአት",    "search": ["ዘፀአት"],                      "expected_chapters": 40},
    {"name": "Leviticus",       "amharic": "ኦሪት ዘሌዋውያን",  "search": ["ዘሌዋውያን"],                    "expected_chapters": 27},
    {"name": "Numbers",         "amharic": "ኦሪት ዘኍልቍ",    "search": ["ዘኍልቊ","ዘኍልቍ","ዘኁልቁ"],        "expected_chapters": 36},
    {"name": "Deuteronomy",     "amharic": "ኦሪት ዘዳግም",    "search": ["ዘዳግም"],                      "expected_chapters": 34},
    {"name": "Joshua",          "amharic": "መጽሐፈ ኢያሱ",    "search": ["መጽሐፈ ኢያሱ"],                  "expected_chapters": 24},
    {"name": "Judges",          "amharic": "መጽሐፈ መሣፍንት",  "search": ["መጽሐፈ መሳፍንት","መጽሐፈ መሣፍንት"],   "expected_chapters": 21},
    {"name": "Ruth",            "amharic": "መጽሐፈ ሩት",     "search": ["መጽሐፈ ሩት"],                   "expected_chapters": 4},
    {"name": "1_Samuel",        "amharic": "1ኛ ሳሙኤል",      "search": ["1ኛ መጽሐፈ ሳሙኤል","አንደኛ መጽሐፈ ሳሙኤል"], "expected_chapters": 31},
    {"name": "2_Samuel",        "amharic": "2ኛ ሳሙኤል",      "search": ["2ኛ መጽሐፈ ሳሙኤል","ሁለተኛ መጽሐፈ ሳሙኤል"], "expected_chapters": 24},
    {"name": "1_Kings",         "amharic": "1ኛ ነገሥት",      "search": ["1ኛ መጽሐፈ ነገሥት","አንደኛ መጽሐፈ ነገሥት"], "expected_chapters": 22},
    {"name": "2_Kings",         "amharic": "2ኛ ነገሥት",      "search": ["2ኛ መጽሐፈ ነገሥት","ሁለተኛ መጽሐፈ ነገሥት"], "expected_chapters": 25},
    {"name": "1_Chronicles",    "amharic": "1ኛ ዜና መዋዕል",   "search": ["1ኛ ዜና መዋዕል",["አንደኛ","ዜና መዋዕል"]],   "expected_chapters": 29},
    {"name": "2_Chronicles",    "amharic": "2ኛ ዜና መዋዕል",   "search": ["2ኛ ዜና መዋዕል",["ሁለተኛ","ዜና መዋዕል"]],   "expected_chapters": 36},
    {"name": "Ezra",            "amharic": "መጽሐፈ ዕዝራ",    "search": ["መጽሐፈ ዕዝራ"],                  "expected_chapters": 10},
    {"name": "Nehemiah",        "amharic": "መጽሐፈ ነህምያ",   "search": ["መጽሐፈ ነህምያ"],                 "expected_chapters": 13},
    {"name": "Tobit",           "amharic": "መጽሐፈ ጦቢት",    "search": ["መጽሐፈ ጦቢት"],                  "expected_chapters": 14},
    {"name": "Judith",          "amharic": "መጽሐፈ ይሁዲት",   "search": ["መጽሐፈ ይሁዲት","ዮዲት"],            "expected_chapters": 16},
    {"name": "Esther",          "amharic": "መጽሐፈ አስቴር",    "search": ["መጽሐፈ አስቴር"],                  "expected_chapters": 10},
    {"name": "1_Maccabees",     "amharic": "1ኛ መቃብያን",     "search": ["1ኛ መቃብያን","አንደኛ መቃብያን"],       "expected_chapters": 16},
    {"name": "2_Maccabees",     "amharic": "2ኛ መቃብያን",     "search": ["2ኛ መቃብያን","ሁለተኛ መቃብያን"],       "expected_chapters": 15},
    {"name": "Job",             "amharic": "መጽሐፈ ኢዮብ",    "search": ["መጽሐፈ ኢዮብ"],                  "expected_chapters": 42},
    {"name": "Psalms",          "amharic": "መዝሙረ ዳዊት",    "search": ["መዝሙረ ዳዊት"],  "title_only": True, "expected_chapters": 150},
    {"name": "Proverbs",        "amharic": "መጽሐፈ ምሳሌ",    "search": ["መጽሐፈ ምሳሌ"],                  "expected_chapters": 31},
    {"name": "Ecclesiastes",    "amharic": "መጽሐፈ መክብብ",   "search": ["መጽሐፈ መክብብ"],                 "expected_chapters": 12},
    {"name": "Song_of_Songs",   "amharic": "መኃልየ መኃልይ",   "search": ["መኃልየ መኃልይ","መሃልይ"],            "expected_chapters": 8},
    {"name": "Wisdom",          "amharic": "መጽሐፈ ጥበብ",    "search": ["መጽሐፈ ጥበብ"],                  "expected_chapters": 19},
    {"name": "Sirach",          "amharic": "መጽሐፈ ሲራክ",    "search": ["መጽሐፈ ሲራክ"],                  "expected_chapters": 51},
    {"name": "Isaiah",          "amharic": "ትንቢተ ኢሳይያስ",  "search": ["ትንቢተ ኢሳይያስ","ትንቢተ ኢሳያስ"],     "expected_chapters": 66},
    {"name": "Jeremiah",        "amharic": "ትንቢተ ኤርምያስ",  "search": ["ትንቢተ ኤርምያስ"],                "expected_chapters": 52},
    {"name": "Lamentations",    "amharic": "ሰቆቃወ ኤርምያስ",  "search": ["ሰቆቃወ ኤርምያስ"],                "expected_chapters": 5},
    {"name": "Baruch",          "amharic": "መጽሐፈ ባሮክ",    "search": ["መጽሐፈ ባሮክ"],                  "expected_chapters": 6},
    {"name": "Ezekiel",         "amharic": "ትንቢተ ሕዝቅኤል",  "search": ["ትንቢተ ሕዝቅኤል"],                "expected_chapters": 48},
    {"name": "Daniel",          "amharic": "ትንቢተ ዳንኤል",   "search": ["ትንቢተ ዳንኤል"],                 "expected_chapters": 14},
    {"name": "Hosea",           "amharic": "ትንቢተ ሆሴዕ",    "search": ["ትንቢተ ሆሴዕ"],                  "expected_chapters": 14},
    {"name": "Joel",            "amharic": "ትንቢተ ኢዩኤል",   "search": ["ትንቢተ ኢዩኤል"],                 "expected_chapters": 4},
    {"name": "Amos",            "amharic": "ትንቢተ አሞጽ",    "search": ["ትንቢተ አሞጽ"],                  "expected_chapters": 9},
    {"name": "Obadiah",         "amharic": "ትንቢተ አብድዩ",   "search": ["ትንቢተ አብድዩ"],                 "expected_chapters": 1},
    {"name": "Jonah",           "amharic": "ትንቢተ ዮናስ",    "search": ["ትንቢተ ዮናስ"],                  "expected_chapters": 4},
    {"name": "Micah",           "amharic": "ትንቢተ ሚክያስ",   "search": ["ትንቢተ ሚክያስ"],                 "expected_chapters": 7},
    {"name": "Nahum",           "amharic": "ትንቢተ ናሆም",    "search": ["ትንቢተ ናሆም"],                  "expected_chapters": 3},
    {"name": "Habakkuk",        "amharic": "ትንቢተ ዕንባቆም",  "search": ["ትንቢተ ዕንባቆም"],                "expected_chapters": 3},
    {"name": "Zephaniah",       "amharic": "ትንቢተ ሶፎንያስ",  "search": ["ትንቢተ ሶፎንያስ"],                "expected_chapters": 3},
    {"name": "Haggai",          "amharic": "ትንቢተ ሐጌ",     "search": ["ትንቢተ ሐጌ"],                   "expected_chapters": 2},
    {"name": "Zechariah",       "amharic": "ትንቢተ ዘካርያስ",  "search": ["ትንቢተ ዘካርያስ"],                "expected_chapters": 14},
    {"name": "Malachi",         "amharic": "ትንቢተ ሚልክያስ",  "search": ["ትንቢተ ሚልክያስ"],                "expected_chapters": 4},
    {"name": "Matthew",         "amharic": "የማቴዎስ ወንጌል",  "search": ["የማቴዎስ ወንጌል"],                "expected_chapters": 28},
    {"name": "Mark",            "amharic": "የማርቆስ ወንጌል",  "search": ["የማርቆስ ወንጌል"],                "expected_chapters": 16},
    {"name": "Luke",            "amharic": "የሉቃስ ወንጌል",   "search": ["የሉቃስ ወንጌል"],                 "expected_chapters": 24},
    {"name": "John",            "amharic": "የዮሐንስ ወንጌል",  "search": ["የዮሐንስ ወንጌል"],                "expected_chapters": 21},
    {"name": "Acts",            "amharic": "የሐዋርያት ሥራ",  "search": ["የሐዋርያት ሥራ"],                 "expected_chapters": 28},
    {"name": "Romans",          "amharic": "ወደ ሮሜ ሰዎች",  "search": ["ወደ ሮሜ"],                     "expected_chapters": 16},
    {"name": "1_Corinthians",   "amharic": "1ኛ ወደ ቆሮንቶስ", "search": ["1ኛ ወደ ቆሮንቶስ","አንደኛ ወደ ቆሮንቶስ"], "expected_chapters": 16},
    {"name": "2_Corinthians",   "amharic": "2ኛ ወደ ቆሮንቶስ", "search": ["2ኛ ወደ ቆሮንቶስ","ሁለተኛ ወደ ቆሮንቶስ"], "expected_chapters": 13},
    {"name": "Galatians",       "amharic": "ወደ ገላትያ",     "search": ["ወደ ገላትያ"],                   "expected_chapters": 6},
    {"name": "Ephesians",       "amharic": "ወደ ኤፌሶን",     "search": ["ወደ ኤፌሶን"],                   "expected_chapters": 6},
    {"name": "Philippians",     "amharic": "ወደ ፊልጵስዩስ",   "search": ["ወደ ፊልጵስዩስ"],                 "expected_chapters": 4},
    {"name": "Colossians",      "amharic": "ወደ ቆላስይስ",    "search": ["ወደ ቆላስይስ","ቈላስይስ"],           "expected_chapters": 4},
    {"name": "1_Thessalonians", "amharic": "1ኛ ወደ ተሰሎንቄ", "search": ["1ኛ ወደ ተሰሎንቄ","አንደኛ ወደ ተሰሎንቄ"], "expected_chapters": 5},
    {"name": "2_Thessalonians", "amharic": "2ኛ ወደ ተሰሎንቄ", "search": ["2ኛ ወደ ተሰሎንቄ","ሁለተኛ ወደ ተሰሎንቄ",["ሁለተኛ","ተሰሎንቄ"]], "expected_chapters": 3},
    {"name": "1_Timothy",       "amharic": "1ኛ ወደ ጢሞቴዎስ", "search": ["1ኛ ወደ ጢሞቴዎስ","አንደኛ ወደ ጢሞቴዎስ"], "expected_chapters": 6},
    {"name": "2_Timothy",       "amharic": "2ኛ ወደ ጢሞቴዎስ", "search": ["2ኛ ወደ ጢሞቴዎስ","ሁለተኛ ወደ ጢሞቴዎስ",["ሁለተኛ","ጢሞቴዎስ"]], "expected_chapters": 4},
    {"name": "Titus",           "amharic": "ወደ ቲቶ",       "search": ["ወደ ቲቶ"],                     "expected_chapters": 3},
    {"name": "Philemon",        "amharic": "ወደ ፊሊሞና",     "search": ["ወደ ፊሊሞና","ወደ ፊልሞና","ፊልሞና"],   "expected_chapters": 1},
    {"name": "Hebrews",         "amharic": "ወደ ዕብራውያን",   "search": ["ወደ ዕብራውያን"],                 "expected_chapters": 13},
    {"name": "James",           "amharic": "የያዕቆብ መልእክት",  "search": ["የያዕቆብ መልእክት"],               "expected_chapters": 5},
    {"name": "1_Peter",         "amharic": "1ኛ የጴጥሮስ",    "search": ["1ኛ የጴጥሮስ","አንደኛ የጴጥሮስ"],      "expected_chapters": 5},
    {"name": "2_Peter",         "amharic": "2ኛ የጴጥሮስ",    "search": ["2ኛ የጴጥሮስ","ሁለተኛ የጴጥሮስ",["ሁለተኛ","የጴጥሮስ"]], "expected_chapters": 3},
    {"name": "1_John",          "amharic": "1ኛ የዮሐንስ",    "search": ["1ኛ የዮሐንስ","አንደኛ የዮሐንስ"],      "expected_chapters": 5},
    {"name": "2_John",          "amharic": "2ኛ የዮሐንስ",    "search": ["2ኛ የዮሐንስ","ሁለተኛ የዮሐንስ",["ሁለተኛ","የዮሐንስ"]], "expected_chapters": 1},
    {"name": "3_John",          "amharic": "3ኛ የዮሐንስ",    "search": ["3ኛ የዮሐንስ","ሦስተኛ የዮሐንስ",["ሦስተኛ","የዮሐንስ"]], "expected_chapters": 1},
    {"name": "Jude",            "amharic": "የይሁዳ መልእክት",  "search": ["የይሁዳ መልእክት",["ሰላምታ","የይሁዳ"]], "expected_chapters": 1},
    {"name": "Revelation",      "amharic": "የዮሐንስ ራዕይ",   "search": ["የዮሐንስ ራዕይ","የዮሐንስ ራእይ"],        "expected_chapters": 22},
]

# Pages that contain only footnotes/cross-references (no chapter 1 text)
# These look like "1:1 ..." reference pages and should be skipped
FOOTNOTE_PATTERN = re.compile(r'^[\s\d፥፤።]+$')

def is_chapter_one_page(text: str) -> bool:
    """Check if this page contains 'ምዕራፍ 1' = Chapter 1."""
    return 'ምዕራፍ 1' in text or 'ምዕ. 1' in text

def page_is_mostly_footnotes(text: str) -> bool:
    """Check if page is mostly cross-reference footnotes (short lines with numbers)."""
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    if not lines:
        return True
    # If most lines are short and numeric/punctuation-heavy, it's footnotes
    short = sum(1 for l in lines if len(l) < 40)
    return short / len(lines) > 0.7

def get_heading_spans(page) -> list[str]:
    """
    Extract text spans that are formatted as headings (large font or bold).
    These are actual chapter/book titles, not footnote cross-references.
    """
    blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]

    # Collect all font sizes first to find median
    sizes = []
    for block in blocks:
        if block["type"] != 0: continue
        for line in block["lines"]:
            for span in line["spans"]:
                if span["text"].strip():
                    sizes.append(span["size"])

    if not sizes:
        return []

    median = sorted(sizes)[len(sizes) // 2]

    headings = []
    for block in blocks:
        if block["type"] != 0: continue
        for line in block["lines"]:
            line_text = ""
            is_heading = False
            for span in line["spans"]:
                text = span["text"].strip()
                if not text: continue
                size = span["size"]
                flags = span["flags"]
                is_bold = bool(flags & 16)
                # Heading = larger than median OR bold AND not tiny
                if size >= median * 1.15 or (is_bold and size >= median * 0.9):
                    is_heading = True
                line_text += span["text"]

            line_text = line_text.strip()
            if is_heading and line_text:
                headings.append(line_text)

    return headings


def term_matches(heading: str, term) -> bool:
    """Match a single search term against normalized heading text.
    Term can be a string (substring match) or list of strings (all must appear).
    """
    if isinstance(term, list):
        return all(t in heading for t in term)
    return term in heading


def book_matches_headings(book: dict, headings_norm: str) -> bool:
    for term in book["search"]:
        if term_matches(headings_norm, term):
            return True
    return False


def find_book_starts(pdf_path: str) -> dict[str, int]:
    """
    Use PyMuPDF font metadata to find actual chapter-1 headings.
    Only considers text with heading-level font size, ignoring footnote cross-refs.
    Two passes:
      1. Find multi-chapter books via 'ምዕራፍ 1' in headings (prefer current-page match).
      2. Find single-chapter books by title alone (no 'ምዕራፍ 1' required).
    """
    doc = fitz.open(pdf_path)
    total = len(doc)
    print(f"Scanning {total} pages using font-aware heading detection...\n")

    found: dict[str, int] = {}

    # ── Pass 1: books with "ምዕራፍ 1" ──────────────────────────────────────────
    for page_idx in range(total):
        page = doc[page_idx]
        headings = get_heading_spans(page)
        heading_text = " | ".join(headings)

        # Only process pages that have a chapter-1 heading
        has_ch1_heading = any('ምዕራፍ 1' in h for h in headings)
        if not has_ch1_heading:
            continue

        page_num = page_idx + 1

        # Normalize current and previous page headings
        curr_norm = heading_text.replace('\xa0', ' ').replace('\u200b', '').replace('\xad', '')
        prev_headings = get_heading_spans(doc[page_idx - 1]) if page_idx > 0 else []
        prev_norm = " | ".join(prev_headings).replace('\xa0', ' ').replace('\u200b', '').replace('\xad', '')

        matched = None

        # Prefer match in current page headings (avoids prev-page "bleed" mismatches)
        for book in BOOKS:
            if book["name"] in found:
                continue
            if book_matches_headings(book, curr_norm):
                matched = book
                break

        # Fallback: check combined (handles books where title page precedes ch-1 page)
        if not matched:
            combined_norm = prev_norm + " | " + curr_norm
            for book in BOOKS:
                if book["name"] in found:
                    continue
                if book_matches_headings(book, combined_norm):
                    matched = book
                    break

        if matched:
            found[matched["name"]] = page_num
            print(f"  ✅ {matched['name']:20s} → PDF page {page_num}  headings: {heading_text[:80]}")
        else:
            print(f"  ❓ Page {page_num}: ምዕራፍ 1 heading found but no book matched")
            print(f"     Headings: {heading_text[:100]}")

    # ── Pass 2: single-chapter books + books with non-standard chapter numbering ─
    # These use title headings rather than "ምዕራፍ 1" (e.g. Psalms uses መዝሙር not ምዕራፍ)
    title_scan_books = [b for b in BOOKS if b.get("expected_chapters") == 1 or b.get("title_only")]
    missing_title = [b for b in title_scan_books if b["name"] not in found]

    if missing_title:
        print(f"\n--- Pass 2: finding {len(missing_title)} book(s) by title ---")
        for page_idx in range(total):
            if not missing_title:
                break
            page = doc[page_idx]
            headings = get_heading_spans(page)
            if not headings:
                continue
            heading_norm = " | ".join(headings).replace('\xa0', ' ').replace('\u200b', '').replace('\xad', '')
            still_missing = []
            for book in missing_title:
                if book_matches_headings(book, heading_norm):
                    found[book["name"]] = page_idx + 1
                    print(f"  ✅ {book['name']:20s} → PDF page {page_idx + 1}  headings: {' | '.join(headings)[:80]}")
                else:
                    still_missing.append(book)
            missing_title = still_missing

    # Report missing
    for book in BOOKS:
        if book["name"] not in found:
            print(f"  ❌ {book['name']:20s} → NOT FOUND")

    doc.close()
    return found

def build_page_map(found: dict[str, int], total_pages: int) -> list:
    page_map = []
    for i, book in enumerate(BOOKS):
        name = book["name"]
        start = found.get(name, 0)

        # end_page = next book's start - 1
        next_start = None
        for j in range(i + 1, len(BOOKS)):
            ns = found.get(BOOKS[j]["name"], 0)
            if ns > 0:
                next_start = ns
                break

        if start > 0:
            end = (next_start - 1) if next_start else total_pages
            end = max(end, start)  # never less than start
        else:
            end = None

        page_map.append({
            "name": name,
            "amharic": book["amharic"],
            "start_page": start,
            "end_page": end,
            "expected_chapters": book["expected_chapters"],
        })
    return page_map

def main():
    if not os.path.exists(PDF_PATH):
        print(f"ERROR: PDF not found: {PDF_PATH}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

    doc = fitz.open(PDF_PATH)
    total_pages = len(doc)
    doc.close()

    found = find_book_starts(PDF_PATH)

    print(f"\n{'='*50}")
    print(f"Found: {len(found)}/73 books")
    missing = [b["name"] for b in BOOKS if b["name"] not in found]
    if missing:
        print(f"Missing: {', '.join(missing)}")

    page_map = build_page_map(found, total_pages)

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump({"books": page_map}, f, ensure_ascii=False, indent=2)

    print(f"\n💾 Saved to: {OUT_PATH}")
    print("\nPage map summary:")
    for b in page_map:
        if b["start_page"]:
            pages = (b["end_page"] or 0) - b["start_page"] + 1
            print(f"  {b['name']:20s} pages {b['start_page']:3d}–{b['end_page'] or '?':3} ({pages} pages, {b['expected_chapters']} ch)")
        else:
            print(f"  {b['name']:20s} ❌ NOT FOUND")

if __name__ == "__main__":
    main()
