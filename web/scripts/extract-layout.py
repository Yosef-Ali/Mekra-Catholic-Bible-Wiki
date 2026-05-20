#!/usr/bin/env python3
"""
Extract text with rich layout metadata from the Bible PDF using PyMuPDF.

Outputs enriched text where layout is encoded as markers:
  [TITLE]   ...text...   - Chapter/book title (large font, centered)
  [HEAD]    ...text...   - Section heading (bold, smaller)
  [PARA]                 - Paragraph break
  [VERSE]   ...text...   - Regular verse text
  [POETRY]  ...text...   - Indented/poetry text
  [PAGE N]               - Page boundary marker

Usage:
  python3 scripts/extract-layout.py <start_page> <end_page> <book_name>

Output: JSON to stdout
  {
    "book": "Genesis",
    "pages": [{ "page": 9, "text": "...", "enriched": "..." }],
    "full_enriched": "..."
  }
"""

import sys
import json
import fitz  # PyMuPDF
import re

PDF_PATH = "The Amharic Bible Catholic Edition - Emmaus.pdf"

def is_amharic(text):
    """Check if text contains Amharic characters."""
    for ch in text:
        if '\u1200' <= ch <= '\u137f':
            return True
    return False

def classify_span(span, page_width, median_font_size):
    """Classify a text span based on font properties."""
    size = span["size"]
    flags = span["flags"]  # bit 0=italic, bit 1=serifed, bit 2=bold, etc.
    is_bold = bool(flags & 2**4)  # superscript bit also sometimes used
    origin_x = span["origin"][0]

    # Check position: centered text = title/heading
    bbox = span["bbox"]
    span_width = bbox[2] - bbox[0]
    center_x = (bbox[0] + bbox[2]) / 2
    page_center = page_width / 2
    is_centered = abs(center_x - page_center) < (page_width * 0.15)

    # Indent level
    indent = origin_x / page_width  # 0.0 = left edge, 1.0 = right edge

    if size >= median_font_size * 1.4 or (size >= median_font_size * 1.2 and is_centered):
        return "TITLE"
    elif is_bold and size >= median_font_size * 1.1:
        return "HEAD"
    elif indent > 0.25:  # indented = poetry
        return "POETRY"
    else:
        return "VERSE"

def extract_pages(start_page: int, end_page: int, book_name: str) -> dict:
    doc = fitz.open(PDF_PATH)
    total = len(doc)

    start_idx = max(0, start_page - 1)
    end_idx = min(total - 1, end_page - 1)

    page_results = []
    full_enriched_parts = []

    for page_idx in range(start_idx, end_idx + 1):
        page = doc[page_idx]
        page_width = page.rect.width

        # Get text with detailed dict including spans
        blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]

        # Collect all spans to compute median font size
        all_spans = []
        for block in blocks:
            if block["type"] != 0:  # type 0 = text block
                continue
            for line in block["lines"]:
                for span in line["spans"]:
                    text = span["text"].strip()
                    if text and (is_amharic(text) or text.replace(" ", "").replace(".", "").replace(":", "").isdigit()):
                        all_spans.append(span)

        if not all_spans:
            continue

        font_sizes = [s["size"] for s in all_spans]
        median_font_size = sorted(font_sizes)[len(font_sizes) // 2]

        page_lines = []
        prev_y = None

        for block in blocks:
            if block["type"] != 0:
                continue

            block_y = block["bbox"][1]

            # Large Y gap between blocks = paragraph break
            if prev_y is not None and (block_y - prev_y) > (median_font_size * 2.5):
                page_lines.append("[PARA]")

            for line in block["lines"]:
                line_parts = []
                line_type = "VERSE"
                line_y = line["bbox"][1]

                # Check for verse number (small superscript or leading number)
                for span in line["spans"]:
                    text = span["text"].strip()
                    if not text:
                        continue

                    span_type = classify_span(span, page_width, median_font_size)

                    # Superscript/small numbers = verse numbers
                    is_superscript = bool(span["flags"] & 2**0)
                    if is_superscript and re.match(r'^\d+$', text):
                        line_parts.append(f"[{text}]")
                        continue

                    if span_type in ("TITLE", "HEAD"):
                        line_type = span_type
                    elif span_type == "POETRY" and line_type == "VERSE":
                        line_type = "POETRY"

                    line_parts.append(text)

                line_text = " ".join(line_parts).strip()
                if not line_text:
                    continue

                if line_type == "TITLE":
                    page_lines.append(f"[TITLE] {line_text}")
                elif line_type == "HEAD":
                    page_lines.append(f"[HEAD] {line_text}")
                elif line_type == "POETRY":
                    page_lines.append(f"[POETRY] {line_text}")
                else:
                    page_lines.append(f"[VERSE] {line_text}")

                prev_y = line["bbox"][3]

            prev_y = block["bbox"][3]

        page_text = "\n".join(page_lines)
        page_results.append({
            "page": page_idx + 1,
            "enriched": page_text,
        })

        full_enriched_parts.append(f"[PAGE {page_idx + 1}]")
        full_enriched_parts.append(page_text)

    doc.close()

    return {
        "book": book_name,
        "start_page": start_page,
        "end_page": end_page,
        "total_extracted_pages": len(page_results),
        "pages": page_results,
        "full_enriched": "\n".join(full_enriched_parts),
    }

def main():
    if len(sys.argv) < 4:
        print("Usage: python3 extract-layout.py <start_page> <end_page> <book_name>", file=sys.stderr)
        sys.exit(1)

    start_page = int(sys.argv[1])
    end_page = int(sys.argv[2])
    book_name = sys.argv[3]

    result = extract_pages(start_page, end_page, book_name)
    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()
