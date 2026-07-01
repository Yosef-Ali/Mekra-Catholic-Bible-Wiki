#!/usr/bin/env python3
"""
extract_liturgical.py — extract clean markdown from KMCC liturgical sources.

Turns the KMCC Divine Liturgy PowerPoints and hymn sources dropped into
raw/liturgical/{qidase,hymns}/ into RAG-navigable markdown, mirroring the
per-unit pattern used by scripts/extract_compendium_digital.mjs.

- .pptx  -> paragraph-aware, one "### N" block per slide (line breaks preserved
           within a slide so priest/deacon/people rubrics stay separate).
- .pdf   -> pdftotext -raw (correct reading order for two-column hymn sheets;
           note that some intra-line spaces are dropped by the source encoding).

Every output file carries bold-field frontmatter (Type / Language / Source file
/ Slides|Pages / Extracted / Extractor), consistent with the rest of the vault.
Archaic Ge'ez/Amharic forms are preserved verbatim — nothing is normalized.

Usage:
    python3 scripts/extract_liturgical.py
Run from the vault root. Idempotent: overwrites the .md outputs in place.
"""

import os
import re
import subprocess
import zipfile
from datetime import date
from xml.etree import ElementTree as ET

A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
VAULT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TODAY = date.today().isoformat()


def slide_lines(xml_bytes):
    """Return the non-empty paragraph lines of a slide, in order."""
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return []
    lines = []
    for p in root.iter(A + "p"):
        text = "".join(r.text for r in p.iter(A + "t") if r.text).strip()
        if text:
            lines.append(text)
    return lines


def pptx_to_md(src, out, title, language):
    z = zipfile.ZipFile(src)
    names = sorted(
        (n for n in z.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", n)),
        key=lambda n: int(re.search(r"(\d+)", n.rsplit("/", 1)[-1]).group(1)),
    )
    blocks = []
    for i, name in enumerate(names, 1):
        lines = slide_lines(z.read(name))
        if not lines:
            continue
        blocks.append(f"### {i}\n" + "\n".join(lines))
    header = (
        f"# {title}\n\n"
        f"**Type:** liturgical-source\n"
        f"**Language:** {language}\n"
        f"**Source file:** {os.path.basename(src)}\n"
        f"**Slides:** {len(names)}\n"
        f"**Extracted:** {TODAY}\n"
        f"**Extractor:** scripts/extract_liturgical.py\n\n"
        f"---\n\n"
    )
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(header + "\n\n".join(blocks) + "\n")
    print(f"  {os.path.relpath(out, VAULT)}  ({len(blocks)} non-empty slides)")


def pdf_pages(src):
    try:
        info = subprocess.run(
            ["pdfinfo", src], capture_output=True, text=True, check=True
        ).stdout
        m = re.search(r"^Pages:\s+(\d+)", info, re.M)
        return m.group(1) if m else "?"
    except Exception:
        return "?"


def pdf_to_md(src, out, title, language, caveat=None):
    text = subprocess.run(
        ["pdftotext", "-raw", "-nopgbrk", src, "-"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    header = (
        f"# {title}\n\n"
        f"**Type:** liturgical-source\n"
        f"**Language:** {language}\n"
        f"**Source file:** {os.path.basename(src)}\n"
        f"**Pages:** {pdf_pages(src)}\n"
        f"**Extracted:** {TODAY}\n"
        f"**Extractor:** scripts/extract_liturgical.py (pdftotext -raw)\n"
    )
    if caveat:
        header += f"**Caveat:** {caveat}\n"
    header += "\n---\n\n"
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(header + text + "\n")
    print(f"  {os.path.relpath(out, VAULT)}  ({len(text)} chars)")


def main():
    lit = os.path.join(VAULT, "raw", "liturgical")
    q = os.path.join(lit, "qidase")
    h = os.path.join(lit, "hymns")

    print("Qidase:")
    pptx_to_md(
        os.path.join(q, "ቅዳሴ KMCC_Geez.pptx"),
        os.path.join(q, "qidase-geez.md"),
        "መስዋዕተ ቅዳሴ — Divine Liturgy (KMCC, Ge'ez)",
        "Ge'ez (Amharic rubrics)",
    )
    pptx_to_md(
        os.path.join(q, "ቅዳሴ KMCC_Amharic.pptx"),
        os.path.join(q, "qidase-amharic.md"),
        "የቅዳሴ ጸሎት — Divine Liturgy (KMCC, Amharic)",
        "Amharic",
    )

    print("Hymns:")
    pptx_to_md(
        os.path.join(h, "All in one 1.pptx"),
        os.path.join(h, "all-in-one.md"),
        "All in One — Amharic worship-song collection",
        "Amharic",
    )
    pdf_to_md(
        os.path.join(h, "easter-mezmur.pdf"),
        os.path.join(h, "easter-mezmur.md"),
        "Easter Mezmur — Amharic resurrection hymns",
        "Amharic",
        caveat="Two-column source; -raw preserves reading order but drops some "
               "intra-line spaces (source-font artifact, not an edit).",
    )


if __name__ == "__main__":
    main()
