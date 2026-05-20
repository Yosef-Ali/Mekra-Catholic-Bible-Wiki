#!/usr/bin/env python3
"""
Local PDF Text Extractor
Extracts text from PDF without using API tokens
Then we can use Gemini just for proofreading
"""

import sys
import os

try:
    import PyPDF2
except ImportError:
    print("❌ PyPDF2 not installed")
    print("Install it with: pip3 install PyPDF2")
    sys.exit(1)

def extract_pdf_text(pdf_path, start_page=None, end_page=None):
    """Extract text from PDF pages"""

    print(f"📖 Opening PDF: {pdf_path}\n")

    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            total_pages = len(pdf_reader.pages)

            print(f"📊 Total pages: {total_pages}")

            # Determine page range
            start = (start_page - 1) if start_page else 0
            end = end_page if end_page else total_pages

            print(f"📄 Extracting pages {start + 1} to {end}...\n")

            extracted_text = []

            for page_num in range(start, min(end, total_pages)):
                print(f"  Processing page {page_num + 1}...", end='\r')
                page = pdf_reader.pages[page_num]
                text = page.extract_text()

                if text:
                    extracted_text.append(f"\n--- PAGE {page_num + 1} ---\n")
                    extracted_text.append(text)

            print("\n✅ Extraction complete!\n")

            full_text = '\n'.join(extracted_text)

            # Save to file
            output_dir = './output/extracted'
            os.makedirs(output_dir, exist_ok=True)

            output_file = f'{output_dir}/pages_{start + 1}-{end}.txt'

            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(full_text)

            print(f"💾 Saved to: {output_file}")
            print(f"📏 Extracted {len(full_text)} characters")
            print(f"📄 {end - start} pages processed\n")

            return full_text

    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("""
📖 Local PDF Text Extractor

USAGE:
  python3 scripts/local-pdf-extract.py <pdf_path> [start_page] [end_page]

EXAMPLES:
  python3 scripts/local-pdf-extract.py "./bible.pdf"
  python3 scripts/local-pdf-extract.py "./bible.pdf" 1 10
  python3 scripts/local-pdf-extract.py "./bible.pdf" 50 60

This extracts text locally (no API usage), then you can:
1. Review the extracted text
2. Use Gemini to proofread and structure it
        """)
        sys.exit(1)

    pdf_path = sys.argv[1]
    start_page = int(sys.argv[2]) if len(sys.argv) > 2 else None
    end_page = int(sys.argv[3]) if len(sys.argv) > 3 else None

    extract_pdf_text(pdf_path, start_page, end_page)
