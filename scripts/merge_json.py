import json
from pathlib import Path
import re
from typing import Dict, List, Tuple

class StoreStructure:
    def __init__(self):
        self.data: Dict = {}
    
    def add_product(self, corridor: str, direction: str, position: str, category: str, products: List[str]):
        """
        Add products to the store structure maintaining the hierarchy:
        Gang -> N/S -> E/W -> Category -> Products
        
        Args:
            corridor: Gang number (e.g., "Gang 1") or "Seiten M"
            direction: N or S
            position: E or W (can be empty)
            category: Category name
            products: List of products
        """
        # Handle Seiten M as special case
        if corridor == "Seiten M":
            if corridor not in self.data:
                self.data[corridor] = {}
            if category not in self.data[corridor]:
                self.data[corridor][category] = products
            return

        # Create hierarchy for main corridors
        if corridor not in self.data:
            self.data[corridor] = {}
        
        if direction not in self.data[corridor]:
            self.data[corridor][direction] = {}
        
        # If position (E/W) is specified, create that level
        if position:
            if "positions" not in self.data[corridor][direction]:
                self.data[corridor][direction]["positions"] = {}
            
            if position not in self.data[corridor][direction]["positions"]:
                self.data[corridor][direction]["positions"][position] = {}
            
            self.data[corridor][direction]["positions"][position][category] = products
        else:
            # No E/W position means it spans the entire side
            if "categories" not in self.data[corridor][direction]:
                self.data[corridor][direction]["categories"] = {}
            
            self.data[corridor][direction]["categories"][category] = products

def parse_section_name(filename: str) -> tuple:
    """
    Parse section name from filename to extract corridor, direction (N/S), and position (E/W if present)
    Example: 'filtered_Gang_1_N_E_Mopro.json' -> ('Gang 1', 'N', 'E', 'Mopro')
    """
    # Remove 'filtered_' prefix and '.json' suffix
    name = filename.stem.replace('filtered_', '')
    parts = name.split('_')
    
    # Handle special case for Seiten M
    if parts[0] == 'Seiten':
        return ('Seiten M', '', '', '_'.join(parts[2:]))
    
    # Extract corridor and direction
    corridor = f"{parts[0]} {parts[1]}"  # Gang X
    direction = parts[2]  # N or S
    
    # Check for East/West designation
    if len(parts) > 4 and parts[3] in ['E', 'W']:
        position = parts[3]  # E or W
        category = '_'.join(parts[4:])  # Rest is category
    else:
        position = ''
        category = '_'.join(parts[3:])  # Rest is category
    
    return (corridor, direction, position, category)

def merge_json_files():
    """
    Merge all filtered JSON files into one master JSON file with hierarchical structure:
    {
        "Gang 1": {
            "N": {
                "positions": {
                    "E": {
                        "category1": ["product1", "product2"],
                        "category2": ["product3", "product4"]
                    },
                    "W": {
                        "category3": ["product5", "product6"]
                    }
                },
                "categories": {
                    "full_width_category": ["product7", "product8"]
                }
            },
            "S": {
                "categories": {
                    "category4": ["product9", "product10"]
                }
            }
        },
        "Seiten M": {
            "category5": ["product11", "product12"]
        }
    }
    """
    input_dir = Path('data/filtered')
    store = StoreStructure()
    
    # Process each JSON file in the filtered_data directory
    for json_file in input_dir.glob('*.json'):
        print(f"Processing: {json_file}")
        
        try:
            # Read the JSON file
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Parse section information from filename
            corridor, direction, position, category = parse_section_name(json_file)
            
            # Add to store structure
            store.add_product(corridor, direction, position, category, data['articles'])
            
        except Exception as e:
            print(f"Error processing {json_file}: {str(e)}")
    
    # Save the merged data
    output_file = Path('data/merged_articles.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(store.data, f, ensure_ascii=False, indent=2)
    
    print(f"\nMerging complete. All data saved to: {output_file}")
    
    # Print some statistics
    total_products = 0
    total_categories = 0
    
    for corridor, corridor_data in store.data.items():
        if corridor == "Seiten M":
            total_categories += len(corridor_data)
            total_products += sum(len(products) for products in corridor_data.values())
        else:
            for direction, direction_data in corridor_data.items():
                # Count categories and products in positions
                if "positions" in direction_data:
                    for position_data in direction_data["positions"].values():
                        total_categories += len(position_data)
                        total_products += sum(len(products) for products in position_data.values())
                
                # Count categories and products in full-width categories
                if "categories" in direction_data:
                    total_categories += len(direction_data["categories"])
                    total_products += sum(len(products) for products in direction_data["categories"].values())
    
    print(f"\nStatistics:")
    print(f"Total corridors: {len(store.data)}")
    print(f"Total categories: {total_categories}")
    print(f"Total products: {total_products}")

if __name__ == "__main__":
    merge_json_files() 