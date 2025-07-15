# SPAR Store Layout Optimizer

This project processes store layout data and provides an optimized shopping path based on a given shopping list.

## Directory Structure

```
spar_app/
├── data/
│   ├── extracted/        # Extracted data from PDFs
│   ├── filtered/         # Filtered and processed JSON data
│   ├── plan/            # Original store layout PDFs
│   └── merged_articles.json  # Final merged store data
├── src/
│   ├── process_pdfs.py   # PDF processing script
│   ├── process_json.py   # JSON filtering script
│   ├── merge_json.py     # JSON merging script
│   └── optimize_shopping_path.py  # Shopping path optimization
└── requirements.txt      # Python dependencies
```

## Processing Pipeline

1. `process_pdfs.py`: Extracts text from PDF files in `data/plan/` and saves to `data/extracted/`
2. `process_json.py`: Filters extracted data and saves to `data/filtered/`
3. `merge_json.py`: Merges filtered data into a single structured JSON file
4. `optimize_shopping_path.py`: Uses the merged data to create optimized shopping paths

## Usage

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Process the data:
```bash
python src/process_pdfs.py
python src/process_json.py
python src/merge_json.py
```

3. Generate an optimized shopping path:
```bash
python src/optimize_shopping_path.py
```

## Data Structure

The final merged data (`data/merged_articles.json`) follows this structure:
```json
{
    "Gang X": {
        "N/S": {
            "positions": {
                "E/W": {
                    "category": ["product1", "product2"]
                }
            },
            "categories": {
                "full_width_category": ["product3", "product4"]
            }
        }
    },
    "Seiten M": {
        "category": ["product5", "product6"]
    }
}
```

## Output Format

The optimized shopping path provides:
1. Corridor sequence with entry/exit points
2. Items grouped by category
3. Clear left/right side indicators
4. Structured data format for visualization or further processing 