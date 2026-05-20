#!/usr/bin/env python3
"""
Fast PDF text extractor using PyMuPDF (fitz)
Extracts all text from PDF files instantly without AI
Perfect for large Amharic Bible PDFs
"""

import sys
import fitz  # PyMuPDF

def extract_pdf_text(pdf_path, output_path=None):
    """
    Extract all text from a PDF file
    
    Args:
        pdf_path: Path to the PDF file
        output_path: Optional path to save extracted text
    
    Returns:
        Extracted text as string
    """
    print(f"📖 Opening PDF: {pdf_path}")
    
    try:
        # Open the PDF
        doc = fitz.open(pdf_path)
        total_pages = len(doc)
        
        print(f"📊 Total Pages: {total_pages}")
        print(f"⏳ Extracting text from all pages...\n")
        
        # Extract text from all pages
        full_text = []
        for page_num in range(total_pages):
            page = doc[page_num]
            text = page.get_text()
            full_text.append(text)
            
            # Progress indicator every 10 pages
            if (page_num + 1) % 10 == 0:
                print(f"   Processed {page_num + 1}/{total_pages} pages...")
        
        doc.close()
        
        # Combine all text
        result = '\n'.join(full_text)
        
        # Save to file if output path provided
        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(result)
            print(f"\n✅ Extraction Complete!")
            print(f"💾 Saved to: {output_path}")
        
        # Statistics
        lines = result.count('\n')
        chars = len(result)
        words = len(result.split())
        
        print(f"\n📊 Statistics:")
        print(f"   Pages: {total_pages:,}")
        print(f"   Lines: {lines:,}")
        print(f"   Words: {words:,}")
        print(f"   Characters: {chars:,}")
        
        return result
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

def main():
    if len(sys.argv) < 2:
        print("""
📖 Fast PDF Text Extractor

USAGE:
    python3 scripts/fast-pdf-extract.py <pdf_path> [output_path]

EXAMPLES:
    python3 scripts/fast-pdf-extract.py "bible.pdf"
    python3 scripts/fast-pdf-extract.py "bible.pdf" "extracted.txt"

FEATURES:
    ✅ Instant extraction (no AI needed)
    ✅ Preserves Amharic text
    ✅ Works with large files
    ✅ Shows progress
""")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else 'extracted_text.txt'
    
    extract_pdf_text(pdf_path, output_path)

if __name__ == '__main__':
    main()
