import json
from typing import List, Dict, Tuple, Set, Optional
import random
from dataclasses import dataclass
from collections import defaultdict
from pathlib import Path

@dataclass
class Location:
    corridor: str  # Gang number or Seiten M
    direction: str  # N (one side) or S (opposite side)
    position: str  # E or W (corridor entrances)
    category: str
    distance_from_start: int  # Relative distance from entrance

    def __str__(self):
        if self.corridor == "Seiten M":
            return "Side corridor"
        
        # When entering from East, N is right side, S is left side
        # When entering from West, N is left side, S is right side
        return f"{'Right side' if self.direction == 'N' else 'Left side'}"

@dataclass
class ShoppingItem:
    name: str
    location: Location
    category: str

@dataclass
class CorridorPath:
    name: str  # Gang number or Seiten M
    entry_point: str  # "East" or "West"
    exit_point: str  # "East" or "West"
    items: List[ShoppingItem]
    
    @property
    def direction(self) -> str:
        return f"{self.entry_point} → {self.exit_point}"

@dataclass
class OptimizedPath:
    corridors: List[CorridorPath]
    not_found_items: List[str]
    
    def to_dict(self) -> Dict:
        """Convert the optimized path to a dictionary format suitable for JSON serialization"""
        return {
            "corridors": [
                {
                    "name": corridor.name,
                    "entry_point": corridor.entry_point,
                    "exit_point": corridor.exit_point,
                    "items": [
                        {
                            "name": item.name,
                            "category": item.category,
                            "location": {
                                "corridor": item.location.corridor,
                                "direction": item.location.direction,
                                "position": item.location.position,
                                "side": "Right" if item.location.direction == "N" else "Left"
                            }
                        }
                        for item in corridor.items
                    ]
                }
                for corridor in self.corridors
            ],
            "not_found_items": self.not_found_items
        }
    
    def to_json(self) -> str:
        """Convert the optimized path to a JSON string"""
        return json.dumps(self.to_dict(), indent=2)

class CorridorSection:
    def __init__(self, corridor: str, from_east: bool):
        self.corridor = corridor
        self.from_east = from_east  # True if entering from east end
        # Initialize items for both sides of corridor
        self.items_north: List[Tuple[str, Location]] = []  # One side
        self.items_south: List[Tuple[str, Location]] = []  # Opposite side
    
    def add_item(self, item: str, location: Location):
        """Add an item to the appropriate side"""
        if location.direction == "N":
            self.items_north.append((item, location))
        else:
            self.items_south.append((item, location))
    
    def get_optimized_path(self) -> List[Tuple[str, Location]]:
        """
        Get optimized path through this corridor section.
        Sort items by category and then by side (Left/Right)
        """
        # Combine all items and sort them
        all_items = []
        all_items.extend(self.items_north)
        all_items.extend(self.items_south)
        
        # Sort by category first, then by side (Left/Right)
        # When entering from East: N=Right, S=Left
        # When entering from West: N=Left, S=Right
        all_items.sort(key=lambda x: (
            x[1].category,  # Sort by category first
            # Then sort by side, considering entry direction
            (x[1].direction == "N") if self.from_east else (x[1].direction == "S")
        ))
        
        return all_items
    
    def has_items(self) -> bool:
        """Check if this corridor section has any items"""
        return bool(self.items_north or self.items_south)
    
    def item_count(self) -> int:
        """Get total number of items in this corridor"""
        return len(self.items_north) + len(self.items_south)

class StoreOptimizer:
    def __init__(self, store_data_file: str):
        # Define corridor distances from east entrance
        self.corridor_distances = {
            "Seiten M": 1,
            "Gang 1": 2,
            "Gang 2": 3,
            "Gang 3": 4,
            "Gang 4": 5,
            "Gang 5": 6,
            "Gang 6": 7
        }
        
        # Load store data
        project_root = Path(__file__).parent.parent
        store_data_path = project_root / 'data' / store_data_file
        with open(store_data_path, 'r') as f:
            self.store_data = json.load(f)
        
        # Create product location index
        self.product_locations: Dict[str, Location] = {}
        self._create_product_index()
    
    def _create_product_index(self):
        """Creates an index mapping product names to their locations with position information"""
        for corridor, corridor_data in self.store_data.items():
            if corridor == "Seiten M":
                for category, products in corridor_data.items():
                    for product in products:
                        self.product_locations[product.lower()] = Location(
                            corridor=corridor,
                            direction="",
                            position="",
                            category=category,
                            distance_from_start=self.corridor_distances[corridor]
                        )
            else:
                for direction, direction_data in corridor_data.items():
                    # Handle positioned categories (E/W)
                    if "positions" in direction_data:
                        for position, position_data in direction_data["positions"].items():
                            for category, products in position_data.items():
                                for product in products:
                                    self.product_locations[product.lower()] = Location(
                                        corridor=corridor,
                                        direction=direction,  # N/S for data structure
                                        position=position,    # E/W for corridor ends
                                        category=category,
                                        distance_from_start=self.corridor_distances[corridor]
                                    )
                    
                    # Handle full-width categories
                    if "categories" in direction_data:
                        for category, products in direction_data["categories"].items():
                            for product in products:
                                self.product_locations[product.lower()] = Location(
                                    corridor=corridor,
                                    direction=direction,
                                    position="",
                                    category=category,
                                    distance_from_start=self.corridor_distances[corridor]
                                )
    
    def get_random_shopping_list(self, num_items: int = 20) -> List[str]:
        """Generates a random shopping list with the specified number of items"""
        all_products = list(self.product_locations.keys())
        return random.sample(all_products, min(num_items, len(all_products)))
    
    def find_product_location(self, product: str) -> Tuple[Location, bool]:
        """Finds the location of a product in the store"""
        product_lower = product.lower()
        
        # Try exact match first
        if product_lower in self.product_locations:
            return self.product_locations[product_lower], True
        
        # Try partial match
        for stored_product, location in self.product_locations.items():
            if product_lower in stored_product or stored_product in product_lower:
                return location, True
        
        return Location("", "", "", "", 0), False
    
    def _organize_items_by_corridor(self, items: List[Tuple[str, Location]]) -> Dict[str, List[Tuple[str, Location]]]:
        """Group items by corridor"""
        corridor_items = defaultdict(list)
        for item, location in items:
            corridor_items[location.corridor].append((item, location))
        return corridor_items
    
    def _determine_corridor_entry_points(self, corridor_items: Dict[str, List[Tuple[str, Location]]]) -> Dict[str, bool]:
        """
        Determine optimal entry point (True=East, False=West) for each corridor
        based on item distribution and current position
        """
        entry_points = {}
        current_position = "east"  # Start from east end
        
        # Sort corridors by their distance from east entrance
        sorted_corridors = sorted(corridor_items.keys(), 
                                key=lambda x: self.corridor_distances.get(x, 0))
        
        for corridor in sorted_corridors:
            if corridor == "Seiten M":
                entry_points[corridor] = True  # Always enter Seiten M from east
                continue
            
            items = corridor_items[corridor]
            
            # Count items near each entrance
            east_items = sum(1 for _, loc in items if loc.position == "E" or not loc.position)
            west_items = sum(1 for _, loc in items if loc.position == "W" or not loc.position)
            
            # If significantly more items near one entrance, enter from that side
            if east_items > west_items * 1.5:
                entry_points[corridor] = True  # Enter from east
            elif west_items > east_items * 1.5:
                entry_points[corridor] = False  # Enter from west
            else:
                # Otherwise, enter from current position to minimize walking
                entry_points[corridor] = current_position == "east"
            
            # Update current position for next corridor
            current_position = "east" if not entry_points[corridor] else "west"
        
        return entry_points
    
    def optimize_shopping_path(self, shopping_list: List[str]) -> OptimizedPath:
        """Creates an optimized shopping path considering entrance points and shelf directions"""
        # Find locations for all items
        items = []
        not_found = []
        
        for item in shopping_list:
            location, found = self.find_product_location(item)
            if found:
                items.append((item, location))
            else:
                not_found.append(item)
        
        # Group items by corridor
        corridor_items = self._organize_items_by_corridor(items)
        
        # Determine optimal entry points
        entry_points = self._determine_corridor_entry_points(corridor_items)
        
        # Create corridor sections and organize items
        corridor_paths = []
        
        # Process corridors in optimal order
        sorted_corridors = sorted(corridor_items.keys(),
                                key=lambda x: self.corridor_distances.get(x, 0))
        
        for corridor in sorted_corridors:
            if not corridor_items[corridor]:
                continue
            
            from_east = entry_points[corridor]
            items_in_corridor = []
            
            # Group items by category
            category_items = defaultdict(list)
            for item, location in corridor_items[corridor]:
                category_items[location.category].append(
                    ShoppingItem(name=item, location=location, category=location.category)
                )
            
            # Add items in category order
            for category in sorted(category_items.keys()):
                items_in_corridor.extend(sorted(category_items[category], key=lambda x: x.name))
            
            corridor_paths.append(
                CorridorPath(
                    name=corridor,
                    entry_point="East" if from_east else "West",
                    exit_point="West" if from_east else "East",
                    items=items_in_corridor
                )
            )
        
        return OptimizedPath(corridors=corridor_paths, not_found_items=not_found)

def format_shopping_path(result: OptimizedPath, shopping_list: List[str] = None) -> str:
    """Formats the shopping path into a readable string"""
    output = []
    
    if shopping_list:
        output.append("Random Shopping List:")
        output.append("----------------------")
        for i, item in enumerate(shopping_list, 1):
            output.append(f"{i}. {item}")
        output.append("")
    
    if result.corridors:
        output.append("Your optimized shopping path:")
        output.append("--------------------------------")
        
        for corridor in result.corridors:
            output.append(f"\n{corridor.name} ({corridor.direction})")
            
            current_category = None
            for item in corridor.items:
                if item.category != current_category:
                    current_category = item.category
                    output.append(f"  {current_category}:")
                output.append(f"    └─ {item.name} ({item.location})")
    
    if result.not_found_items:
        output.append("\nItems not found in store:")
        for item in result.not_found_items:
            output.append(f"  • {item}")
    
    return "\n".join(output)

if __name__ == "__main__":
    # Create optimizer instance
    optimizer = StoreOptimizer('merged_articles.json')
    
    # Generate random shopping list with 20 items
    random_list = optimizer.get_random_shopping_list(20)
    
    # Get optimized path
    result = optimizer.optimize_shopping_path(random_list)
    
    # Print formatted result
    print(format_shopping_path(result, random_list))
    
    # Example of getting structured data
    print("\nStructured data (JSON):")
    print(result.to_json()) 