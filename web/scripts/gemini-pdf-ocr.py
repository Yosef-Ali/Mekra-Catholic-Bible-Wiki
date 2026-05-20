#!/usr/bin/env python3
"""
Gemini 2.5 Pro Amharic Bible Text Extractor
Uses Gemini's native Amharic understanding (NOT OCR)
"""

import sys
import os
import argparse
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print("❌ PyMuPDF not installed")
    print("Installing PyMuPDF...")
    os.system("pip3 install pymupdf --break-system-packages --quiet")
    import fitz

try:
    from PIL import Image
except ImportError:
    print("❌ Pillow not installed")
    print("Installing Pillow...")
    os.system("pip3 install pillow --break-system-packages --quiet")
    from PIL import Image

try:
    import google.generativeai as genai
except ImportError:
    print("❌ google-generativeai not installed")
    print("Installing google-generativeai...")
    os.system("pip3 install google-generativeai --break-system-packages --quiet")
    import google.generativeai as genai

try:
    from dotenv import load_dotenv
except ImportError:
    print("❌ python-dotenv not installed")
    print("Installing python-dotenv...")
    os.system("pip3 install python-dotenv --break-system-packages --quiet")
    from dotenv import load_dotenv

import io
import time

# Configuration
TARGET_SIZE = 2048   # Optimal for Gemini 3 Pro
PDF_DPI = 200        # Good quality from PDF
MODEL_NAME = "gemini-3-pro-preview"  # Gemini 3 Pro - Latest and best for Amharic

def resize_for_gemini(image, target=2048):
    """
    Resize image to optimal size for Gemini 3 Pro
    Uses LANCZOS for high quality
    """
    width, height = image.size

    # Calculate new dimensions
    if width > height:
        if width > target:
            new_width = target
            new_height = int(height * (target / width))
        else:
            return image
    else:
        if height > target:
            new_height = target
            new_width = int(width * (target / height))
        else:
            return image

    return image.resize((new_width, new_height), Image.Resampling.LANCZOS)

def pdf_page_to_image(pdf_path, page_num, dpi=200):
    """
    Convert PDF page to PIL Image
    """
    doc = fitz.open(pdf_path)
    page = doc[page_num]

    # Render at specified DPI
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat)

    # Convert to PIL Image
    img_data = pix.tobytes("png")
    image = Image.open(io.BytesIO(img_data))

    doc.close()
    return image

def extract_text_with_gemini(image, api_key, model_name=MODEL_NAME):
    """
    Use Gemini 3 Pro to understand and extract Amharic text
    """
    # Configure Gemini
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name)

    # Prepare prompt in Amharic
    prompt = """
    እባክዎ በዚህ ምስል ላይ ያለውን የአማርኛ ጽሑፍ በትክክል ያንብቡ እና ይተርጉሙ።

    Please extract ALL Amharic text from this Bible page exactly as written.
    Include:
    - Chapter and verse numbers
    - All text content
    - Preserve exact formatting and line breaks

    Format each verse as:
    ቁጥር [number]: [text]

    Extract the text exactly as it appears, maintaining all Ge'ez numerals and punctuation.
    """

    try:
        # Send to Gemini
        response = model.generate_content([prompt, image])
        return response.text
    except Exception as e:
        return f"Error: {str(e)}"

def main():
    parser = argparse.ArgumentParser(
        description="Extract Amharic text from Bible PDF using Gemini 2.5 Pro"
    )
    parser.add_argument("pdf_path", help="Path to PDF file")
    parser.add_argument("--api-key", help="Gemini API key (or set GEMINI_API_KEY env)")
    parser.add_argument("--start", type=int, default=1, help="Start page (1-indexed)")
    parser.add_argument("--end", type=int, help="End page (default: all)")
    parser.add_argument("--output", default="./extracted_text.txt", help="Output file")
    parser.add_argument("--model", default=MODEL_NAME, help=f"Model name (default: {MODEL_NAME})")

    args = parser.parse_args()

    # Load environment variables
    load_dotenv()

    # Get API key
    api_key = args.api_key or os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("❌ Error: No API key provided")
        print("Use --api-key or set GEMINI_API_KEY environment variable")
        sys.exit(1)

    # Check PDF exists
    if not os.path.exists(args.pdf_path):
        print(f"❌ Error: PDF not found: {args.pdf_path}")
        sys.exit(1)

    # Get page count
    doc = fitz.open(args.pdf_path)
    total_pages = len(doc)
    doc.close()

    start_page = args.start - 1  # Convert to 0-indexed
    end_page = (args.end - 1) if args.end else (total_pages - 1)

    print(f"\n📄 Extracting from: {args.pdf_path}")
    print(f"📊 Pages: {start_page + 1} to {end_page + 1} (of {total_pages})")
    print(f"🤖 Model: {args.model}")
    print(f"📏 Image size: {TARGET_SIZE}px max\n")

    # Create output directory
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Extract pages
    with open(output_path, 'w', encoding='utf-8') as f:
        for page_num in range(start_page, end_page + 1):
            print(f"📖 Page {page_num + 1}/{end_page + 1}...")

            try:
                # Convert PDF page to image
                image = pdf_page_to_image(args.pdf_path, page_num, dpi=PDF_DPI)
                print(f"   Original size: {image.size}")

                # Resize for Gemini
                resized = resize_for_gemini(image, target=TARGET_SIZE)
                print(f"   Resized to: {resized.size}")

                # Extract text
                print(f"   🤖 Sending to Gemini 2.0 Flash...")
                text = extract_text_with_gemini(resized, api_key, args.model)

                # Write to file
                f.write(f"\n{'='*60}\n")
                f.write(f"PAGE {page_num + 1}\n")
                f.write(f"{'='*60}\n\n")
                f.write(text)
                f.write("\n\n")

                print(f"   ✅ Extracted {len(text)} characters\n")

                # Rate limiting
                if page_num < end_page:
                    time.sleep(2)  # 2 seconds between requests

            except Exception as e:
                print(f"   ❌ Error: {e}\n")
                f.write(f"\n[ERROR on page {page_num + 1}: {e}]\n\n")
                time.sleep(5)  # Longer delay on error

    print(f"\n✅ Extraction complete!")
    print(f"📁 Saved to: {output_path}")
    print(f"📊 File size: {output_path.stat().st_size / 1024:.1f} KB")

if __name__ == "__main__":
    main()
