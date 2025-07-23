import React from 'react';
import { MapPin, ArrowRight } from 'lucide-react';
import StoreLayoutVisual from './StoreLayoutVisual';

// Types
interface Location {
  corridor: string;
  direction: string;
  position: string;
  category: string;
  distanceFromStart: number;
}

interface ShoppingItem {
  name: string;
  location: Location;
  category: string;
}

interface CorridorPath {
  name: string;
  entryPoint: string;
  exitPoint: string;
  items: Array<{
    name: string;
    category: string;
    location: {
      corridor: string;
      direction: string;
      position: string;
      side: string;
    };
  }>;
}

interface OptimizedPath {
  corridors: CorridorPath[];
  notFoundItems: string[];
}

// Store layout data
const corridorDistances = {
  "Seiten M": 1,
  "Gang 1": 2,
  "Gang 2": 3,
  "Gang 3": 4,
  "Gang 4": 5,
  "Gang 5": 6,
  "Gang 6": 7
};

class StoreOptimizer {
  private productLocations: Map<string, Location>;
  private storeData: any;

  constructor(storeData: any) {
    this.storeData = storeData;
    this.productLocations = new Map();
    this.createProductIndex();
  }

  private createProductIndex(): void {
    Object.entries(this.storeData).forEach(([corridor, corridorData]: [string, any]) => {
      if (corridor === "Seiten M") {
        Object.entries(corridorData).forEach(([category, products]: [string, any]) => {
          products.forEach((product: string) => {
            this.productLocations.set(product.toLowerCase(), {
              corridor,
              direction: "",
              position: "",
              category,
              distanceFromStart: corridorDistances[corridor as keyof typeof corridorDistances]
            });
          });
        });
      } else {
        Object.entries(corridorData).forEach(([direction, directionData]: [string, any]) => {
          // Handle positioned categories (E/W)
          if (directionData.positions) {
            Object.entries(directionData.positions).forEach(([position, positionData]: [string, any]) => {
              Object.entries(positionData).forEach(([category, products]: [string, any]) => {
                products.forEach((product: string) => {
                  this.productLocations.set(product.toLowerCase(), {
                    corridor,
                    direction,
                    position,
                    category,
                    distanceFromStart: corridorDistances[corridor as keyof typeof corridorDistances]
                  });
                });
              });
            });
          }

          // Handle full-width categories
          if (directionData.categories) {
            Object.entries(directionData.categories).forEach(([category, products]: [string, any]) => {
              products.forEach((product: string) => {
                this.productLocations.set(product.toLowerCase(), {
                  corridor,
                  direction,
                  position: "",
                  category,
                  distanceFromStart: corridorDistances[corridor as keyof typeof corridorDistances]
                });
              });
            });
          }
        });
      }
    });
  }

  private findProductLocation(product: string): [Location | null, boolean] {
    const productLower = product.toLowerCase();
    
    // Try exact match first
    if (this.productLocations.has(productLower)) {
      return [this.productLocations.get(productLower)!, true];
    }
    
    // Try partial match
    for (const [storedProduct, location] of this.productLocations.entries()) {
      if (productLower.includes(storedProduct) || storedProduct.includes(productLower)) {
        return [location, true];
      }
    }
    
    return [null, false];
  }

  private organizeItemsByCorridor(items: Array<[string, Location]>): Map<string, Array<[string, Location]>> {
    const corridorItems = new Map();
    items.forEach(([item, location]) => {
      if (!corridorItems.has(location.corridor)) {
        corridorItems.set(location.corridor, []);
      }
      corridorItems.get(location.corridor).push([item, location]);
    });
    return corridorItems;
  }

  private determineCorridorEntryPoints(corridorItems: Map<string, Array<[string, Location]>>): Map<string, boolean> {
    const entryPoints = new Map();
    let currentPosition = "east";

    // Sort corridors by distance from east entrance
    const sortedCorridors = Array.from(corridorItems.keys()).sort((a, b) => {
      return (corridorDistances[a as keyof typeof corridorDistances] || 0) - 
             (corridorDistances[b as keyof typeof corridorDistances] || 0);
    });

    sortedCorridors.forEach(corridor => {
      if (corridor === "Seiten M") {
        entryPoints.set(corridor, true); // Always enter Seiten M from east
        return;
      }

      const items = corridorItems.get(corridor)!;
      
      // Count items near each entrance
      const eastItems = items.filter(([_, loc]) => loc.position === "E" || !loc.position).length;
      const westItems = items.filter(([_, loc]) => loc.position === "W" || !loc.position).length;

      // If significantly more items near one entrance, enter from that side
      if (eastItems > westItems * 1.5) {
        entryPoints.set(corridor, true); // Enter from east
      } else if (westItems > eastItems * 1.5) {
        entryPoints.set(corridor, false); // Enter from west
      } else {
        // Otherwise, enter from current position to minimize walking
        entryPoints.set(corridor, currentPosition === "east");
      }

      // Update current position for next corridor
      currentPosition = entryPoints.get(corridor) ? "west" : "east";
    });

    return entryPoints;
  }

  public optimizeShoppingPath(shoppingList: string[]): OptimizedPath {
    // Find locations for all items
    const itemsWithLocations: Array<[string, Location]> = [];
    const notFoundItems: string[] = [];

    shoppingList.forEach(item => {
      const [location, found] = this.findProductLocation(item);
      if (found && location) {
        itemsWithLocations.push([item, location]);
      } else {
        notFoundItems.push(item);
      }
    });

    // Group items by corridor
    const corridorItems = this.organizeItemsByCorridor(itemsWithLocations);
    
    // Determine optimal entry points for each corridor
    const entryPoints = this.determineCorridorEntryPoints(corridorItems);

    // Create optimized path through corridors
    const optimizedCorridors: CorridorPath[] = [];

    // Sort corridors by distance from entrance
    const sortedCorridors = Array.from(corridorItems.keys()).sort((a, b) => {
      return (corridorDistances[a as keyof typeof corridorDistances] || 0) - 
             (corridorDistances[b as keyof typeof corridorDistances] || 0);
    });

    sortedCorridors.forEach(corridor => {
      const items = corridorItems.get(corridor)!;
      const fromEast = entryPoints.get(corridor)!;

      // Sort items by category and side
      const sortedItems = items.sort((a, b) => {
        const [_, locA] = a;
        const [__, locB] = b;
        
        // Sort by category first
        if (locA.category < locB.category) return -1;
        if (locA.category > locB.category) return 1;

        // Then sort by side, considering entry direction
        const aSide = fromEast ? locA.direction === "N" : locA.direction === "S";
        const bSide = fromEast ? locB.direction === "N" : locB.direction === "S";
        return aSide === bSide ? 0 : aSide ? -1 : 1;
      });

      optimizedCorridors.push({
        name: corridor,
        entryPoint: fromEast ? "East" : "West",
        exitPoint: fromEast ? "West" : "East",
        items: sortedItems.map(([name, location]) => ({
          name,
          category: location.category,
          location: {
            corridor: location.corridor,
            direction: location.direction,
            position: location.position,
            side: location.direction === "N" ? "Right" : "Left"
          }
        }))
      });
    });

    return {
      corridors: optimizedCorridors,
      notFoundItems
    };
  }
}

interface Props {
  items: Array<{ text: string; completed?: boolean }>;
  storeData: any;
  onItemToggle?: (itemName: string, completed: boolean) => void;
}

const OptimizedShoppingPath: React.FC<Props> = ({ items, storeData, onItemToggle }) => {
  const optimizer = new StoreOptimizer(storeData);
  const optimizedPath = optimizer.optimizeShoppingPath(items.map(item => item.text));

  return (
    <div className="space-y-6">
      {/* Visual Store Layout */}
      <StoreLayoutVisual items={items} storeData={storeData} onItemToggle={onItemToggle} />
      
      {/* Path Overview - Hidden */}
      {/* <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-red-500" />
          Optimized Shopping Path
        </h2>
        <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide">
          {optimizedPath.corridors.map((corridor, index) => (
            <React.Fragment key={corridor.name}>
              <div className="flex-shrink-0 px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium text-gray-700">
                {corridor.name}
              </div>
              {index < optimizedPath.corridors.length - 1 && (
                <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div> */}

      {/* Corridor Details - Hidden */}
      {/* <div className="space-y-4">
        {optimizedPath.corridors.map((corridor) => (
          <div key={corridor.name} className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">{corridor.name}</h3>
              <div className="text-sm text-gray-500 flex items-center gap-1">
                <span>{corridor.entryPoint}</span>
                <ArrowRight className="w-4 h-4" />
                <span>{corridor.exitPoint}</span>
              </div>
            </div>
            
            <div className="space-y-3">
              {corridor.items.map((item, index) => (
                <div
                  key={`${item.name}-${index}`}
                  className="p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-gray-800">{item.name}</h4>
                      <p className="text-sm text-gray-500">{item.category}</p>
                    </div>
                    <div className="text-sm text-gray-500">
                      {item.location.side} Side
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div> */}

      {/* Not Found Items */}
      {optimizedPath.notFoundItems.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Items Not Found</h2>
          <div className="space-y-2">
            {optimizedPath.notFoundItems.map((item, index) => (
              <div
                key={index}
                className="p-3 bg-red-50 text-red-700 rounded-xl"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OptimizedShoppingPath; 