import os
import json
from pathlib import Path
from pdf2image import convert_from_path
import pytesseract
from PIL import Image
import pandas as pd
import re

def extract_text_from_pdf(pdf_path):
    """Convert PDF to image and extract text using OCR."""
    try:
        # Convert PDF to image
        images = convert_from_path(pdf_path)
        
        # Extract text from all pages
        text = ""
        for image in images:
            text += pytesseract.image_to_string(image, lang='deu')  # Using German language
        return text
    except Exception as e:
        print(f"Error processing {pdf_path}: {str(e)}")
        return ""

def extract_article_names(text):
    """Extract article names from the OCR text."""
    # Split text into lines and look for article names
    lines = text.split('\n')
    articles = []
    
    # Look for lines that might contain article names
    # This pattern might need adjustment based on the actual PDF structure
    for line in lines:
        # Skip empty lines and lines that look like headers/footers
        if line.strip() and not line.strip().startswith(('Seite', 'Page')):
            # Try to find article names in the line
            articles.append(line.strip())
    
    return articles

def save_pdf_content(section_name, pdf_name, articles):
    """Save the content of a single PDF to its own JSON file."""
    # Create output directory if it doesn't exist
    output_dir = Path('data/extracted')
    output_dir.mkdir(exist_ok=True, parents=True)
    
    # Create a sanitized filename (replace spaces and special characters)
    safe_section_name = section_name.replace('/', '_').replace(' ', '_')
    safe_pdf_name = pdf_name.replace(' ', '_')
    output_filename = f"{safe_section_name}_{safe_pdf_name}.json"
    output_path = output_dir / output_filename
    
    # Create the data structure
    data = {
        "section": section_name,
        "pdf_name": pdf_name,
        "articles": articles
    }
    
    # Save to JSON file
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"Saved data to: {output_path}")

def process_pdfs():
    """Process all PDFs in the plan directory and create individual JSON files."""
    base_dir = Path('data/plan')
    
    # Walk through all directories in plan folder
    for root, dirs, files in os.walk(base_dir):
        current_path = Path(root)
        if current_path == base_dir:
            continue
            
        # Get relative path from base_dir
        rel_path = current_path.relative_to(base_dir)
        section_name = str(rel_path)
        
        # Process each PDF in the directory
        for file in files:
            if file.lower().endswith('.pdf'):
                pdf_path = current_path / file
                print(f"\nProcessing: {pdf_path}")
                
                # Extract text from PDF
                text = extract_text_from_pdf(pdf_path)
                
                if text:  # Only process if we got some text
                    # Extract article names
                    articles = extract_article_names(text)
                    
                    # Save this PDF's content to its own file
                    pdf_name = os.path.splitext(file)[0]
                    save_pdf_content(section_name, pdf_name, articles)
                else:
                    print(f"No text extracted from {pdf_path}")
    
    print("\nProcessing complete. Results saved in 'data/extracted' directory")

if __name__ == "__main__":
    process_pdfs() 