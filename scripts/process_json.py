import json
import re
from pathlib import Path
import os

def extract_product_description(line):
    """
    Extract product description between the product code and quantity numbers.
    Example: "588 5747511 Neutr.Handcrem.Hand&Nagel 75m1l 1 8" -> "Neutr.Handcrem.Hand&Nagel 75m1l"
    """
    # Match pattern: two numbers at start, capture everything until two numbers at end
    pattern = r'^\d+\s+\d+\s+(.*?)\s+\d+\s+\d+'
    match = re.search(pattern, line)
    if match:
        return match.group(1)
    return None

def process_json_files():
    """Process all JSON files in the extracted_data directory and create filtered versions."""
    input_dir = Path('data/extracted')
    output_dir = Path('data/filtered')
    output_dir.mkdir(exist_ok=True, parents=True)
    
    # Process each JSON file
    for json_file in input_dir.glob('*.json'):
        print(f"\nProcessing: {json_file}")
        
        try:
            # Read the original JSON file
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Filter the articles
            filtered_articles = []
            for article in data['articles']:
                product_desc = extract_product_description(article)
                if product_desc:
                    filtered_articles.append(product_desc)
            
            # Create new data structure with filtered articles
            filtered_data = {
                "section": data['section'],
                "pdf_name": data['pdf_name'],
                "articles": filtered_articles
            }
            
            # Save to new JSON file in filtered_data directory
            output_file = output_dir / f"filtered_{json_file.name}"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(filtered_data, f, ensure_ascii=False, indent=2)
            
            print(f"Saved filtered data to: {output_file}")
            print(f"Found {len(filtered_articles)} products")
            
        except Exception as e:
            print(f"Error processing {json_file}: {str(e)}")
    
    print("\nProcessing complete. Results saved in 'data/filtered' directory")

if __name__ == "__main__":
    process_json_files() 