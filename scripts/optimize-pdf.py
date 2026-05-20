#!/usr/bin/env python3
"""
Optimize PDF: Remove cover page and compress
"""
import sys
import os

try:
    import PyPDF2
except ImportError:
    print("❌ PyPDF2 not installed")
    print("Installing PyPDF2...")
    os.system("pip3 install PyPDF2 --break-system-packages --quiet")
    import PyPDF2

def optimize_pdf(input_path, output_path, remove_first_page=True):
    print(f"📄 Processing: {input_path}")
    print(f"📏 Original size: {os.path.getsize(input_path) / (1024*1024):.2f} MB\n")

    try:
        # Read PDF
        with open(input_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            writer = PyPDF2.PdfWriter()

            total_pages = len(reader.pages)
            print(f"📖 Total pages: {total_pages}")

            # Determine start page
            start_page = 1 if remove_first_page else 0
            print(f"✂️  Removing cover page: {remove_first_page}")
            print(f"📑 Keeping pages: {start_page + 1} to {total_pages}\n")

            # Copy pages (skip first if requested)
            for i in range(start_page, total_pages):
                page = reader.pages[i]

                # Compress page
                page.compress_content_streams()
                writer.add_page(page)

                if (i - start_page + 1) % 50 == 0:
                    print(f"  Processed {i - start_page + 1}/{total_pages - start_page} pages...")

            print(f"\n💾 Writing optimized PDF...")

            # Write optimized PDF
            with open(output_path, 'wb') as output_file:
                writer.write(output_file)

            # Stats
            original_size = os.path.getsize(input_path) / (1024*1024)
            new_size = os.path.getsize(output_path) / (1024*1024)
            reduction = ((original_size - new_size) / original_size) * 100

            print(f"\n✅ Optimization complete!")
            print(f"📊 Original: {original_size:.2f} MB")
            print(f"📊 Optimized: {new_size:.2f} MB")
            print(f"📊 Reduction: {reduction:.1f}%")
            print(f"📁 Saved to: {output_path}")

    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("""
📄 PDF Optimizer

USAGE:
  python3 scripts/optimize-pdf.py <input.pdf> [output.pdf] [--keep-cover]

EXAMPLES:
  python3 scripts/optimize-pdf.py bible.pdf
  python3 scripts/optimize-pdf.py bible.pdf optimized.pdf
  python3 scripts/optimize-pdf.py bible.pdf --keep-cover
        """)
        sys.exit(1)

    input_file = sys.argv[1]

    # Parse arguments
    keep_cover = '--keep-cover' in sys.argv
    output_file = None

    for arg in sys.argv[2:]:
        if not arg.startswith('--'):
            output_file = arg
            break

    if not output_file:
        base, ext = os.path.splitext(input_file)
        output_file = f"{base}_optimized{ext}"

    optimize_pdf(input_file, output_file, remove_first_page=not keep_cover)
