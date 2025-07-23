import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ShoppingItem {
  text: string;
  completed?: boolean;
}

interface StoreLayoutProps {
  items: ShoppingItem[];
  storeData: any;
  onItemToggle?: (itemName: string, completed: boolean) => void;
}

// Store optimizer class
class StoreOptimizer {
  private productLocations = new Map<string, any>();

  constructor(storeData: any) {
    this.buildProductLocationMap(storeData);
  }

  private buildProductLocationMap(storeData: any) {
    Object.entries(storeData).forEach(([corridor, corridorData]) => {
      if (corridor === 'Seiten M') {
        Object.entries(corridorData as any).forEach(([category, products]) => {
          (products as string[]).forEach((product: string) => {
            this.productLocations.set(product.toLowerCase(), {
              corridor,
              direction: '',
              position: '',
              category
            });
          });
        });
      } else {
        ['N', 'S'].forEach(direction => {
          const sectionData = (corridorData as any)[direction];
          if (!sectionData) return;

          if (sectionData.categories) {
            Object.entries(sectionData.categories).forEach(([category, products]) => {
              (products as string[]).forEach((product: string) => {
                this.productLocations.set(product.toLowerCase(), {
                  corridor,
                  direction,
                  position: '',
                  category
                });
              });
            });
          }

          if (sectionData.positions) {
            Object.entries(sectionData.positions).forEach(([position, categories]) => {
              Object.entries(categories as Record<string, string[]>).forEach(([category, products]) => {
                (products as string[]).forEach((product: string) => {
                  this.productLocations.set(product.toLowerCase(), {
                    corridor,
                    direction,
                    position,
                    category
                  });
                });
              });
            });
          }
        });
      }
    });
  }

  private findProductLocation(product: string): any {
    const productLower = product.toLowerCase();
    
    if (this.productLocations.has(productLower)) {
      return this.productLocations.get(productLower)!;
    }
    
    for (const [storedProduct, location] of this.productLocations.entries()) {
      if (productLower.includes(storedProduct) || storedProduct.includes(productLower)) {
        return location;
      }
    }
    
    return null;
  }

  public optimizeShoppingPath(shoppingList: string[]) {
    const corridorDistances = {
      "Seiten M": 1,
      "Gang 1": 2,
      "Gang 2": 3,
      "Gang 3": 4,
      "Gang 4": 5,
      "Gang 5": 6,
      "Gang 6": 7
    };

    const itemsWithLocations: Array<[string, any]> = [];
    shoppingList.forEach(item => {
      const location = this.findProductLocation(item);
      if (location) {
        itemsWithLocations.push([item, location]);
      }
    });

    const corridorItems = new Map();
    itemsWithLocations.forEach(([item, location]) => {
      if (!corridorItems.has(location.corridor)) {
        corridorItems.set(location.corridor, []);
      }
      corridorItems.get(location.corridor).push([item, location]);
    });

    const entryPoints = new Map();
    let currentPosition = "east";

    const sortedCorridors = Array.from(corridorItems.keys()).sort((a, b) => {
      return (corridorDistances[a as keyof typeof corridorDistances] || 0) - 
             (corridorDistances[b as keyof typeof corridorDistances] || 0);
    });

    sortedCorridors.forEach((corridor, index) => {
      if (corridor === "Seiten M") {
        entryPoints.set(corridor, true); // Always enter from east (left side of map)
        currentPosition = "west"; // After Seiten M, we're on the west side
        return;
      }

      const items = corridorItems.get(corridor)!;
      const eastItems = items.filter(([_, loc]: [any, any]) => loc.position === "E" || !loc.position).length;
      const westItems = items.filter(([_, loc]: [any, any]) => loc.position === "W" || !loc.position).length;

      let enterFromEast = true;

      // Smart decision based on item distribution and current position
      if (eastItems > westItems * 2) {
        // Heavily weighted to east side, enter from east
        enterFromEast = true;
      } else if (westItems > eastItems * 2) {
        // Heavily weighted to west side, enter from west
        enterFromEast = false;
      } else {
        // Balanced or no strong preference - optimize for current position and next corridor
        const nextCorridor = index < sortedCorridors.length - 1 ? sortedCorridors[index + 1] : null;
        
        if (nextCorridor && nextCorridor !== "Seiten M") {
          const nextItems = corridorItems.get(nextCorridor);
          if (nextItems) {
            const nextEastItems = nextItems.filter(([_, loc]: [any, any]) => loc.position === "E" || !loc.position).length;
            const nextWestItems = nextItems.filter(([_, loc]: [any, any]) => loc.position === "W" || !loc.position).length;
            
            // If next corridor is heavily east-weighted, exit on east side
            // If next corridor is heavily west-weighted, exit on west side
            if (nextEastItems > nextWestItems * 1.5) {
              enterFromEast = currentPosition === "west"; // Enter from current position, exit toward east
            } else if (nextWestItems > nextEastItems * 1.5) {
              enterFromEast = currentPosition === "east"; // Enter from current position, exit toward west
            } else {
              // Default: alternate direction to avoid repetitive patterns
              enterFromEast = currentPosition === "east";
            }
          } else {
            enterFromEast = currentPosition === "east";
          }
        } else {
          // Last corridor or no next corridor - enter from current position
          enterFromEast = currentPosition === "east";
        }
      }

      entryPoints.set(corridor, enterFromEast);
      
      // Update current position based on where we exit
      // If we have items on both sides, we traverse and change position
      // If items are only on one side, we stay on the same side
      if (Math.abs(eastItems - westItems) <= 1) {
        // Roughly equal items on both sides - we traverse
        currentPosition = enterFromEast ? "west" : "east";
      } else {
        // Items concentrated on one side - we might not traverse
        currentPosition = enterFromEast ? "west" : "east";
      }
    });

    return sortedCorridors.map(corridor => ({
      name: corridor,
      entryPoint: entryPoints.get(corridor) ? "East" : "West",
      exitPoint: entryPoints.get(corridor) ? "West" : "East"
    }));
  }
}

// SVG Layout constants
const LAYOUT = {
  viewBox: {
    width: 2381,
    height: 2063
  },
  shelf: {
    width: 1800,
    height: 100,
    startX: 200
  },
  seitenM: {
    width: 100,
    height: 1800,
    x: 0,
    y: 0
  },
  corridors: Array.from({ length: 7 }, (_, i) => {
    if (i < 6) {
      return {
        northShelf: i * 300,
        corridorStart: i * 300 + 100,
        corridorEnd: i * 300 + 200,
        corridorCenter: i * 300 + 150,
        southShelf: i * 300 + 200,
        turnPointLeft: 155,
        turnPointRight: 2055
      };
    } else {
      return {
        northShelf: null,
        corridorStart: 1800,
        corridorEnd: 1900,
        corridorCenter: 1850,
        southShelf: null,
        turnPointLeft: 155,
        turnPointRight: 2055
      };
    }
  }),
  entrance: {
    x: 1500,
    y: 1900,
    width: 500,
    height: 100
  },
  kassa: {
    x: 900,
    y: 1900,
    width: 500,
    height: 100
  },
  colors: {
    shelf: '#EDEDEE',
    wall: '#4F504F',
    wallStroke: '#9FA1A4',
    highlight: '#86EFAC',
    path: '#EF4444'
  }
};

const StoreLayoutVisual: React.FC<StoreLayoutProps> = ({ items, storeData, onItemToggle }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(() => {
    const saved = localStorage.getItem('storeLayoutActiveStep');
    return saved ? parseInt(saved) : 0;
  });
  const [hasStartedNavigation, setHasStartedNavigation] = useState(false);
  const [lastCompletedStep, setLastCompletedStep] = useState<number>(-1);
  const [showShoppingSummary, setShowShoppingSummary] = useState(false);
  const activeStepRef = useRef<number>(0);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExpanded(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, []);

  // Get shopping list categories and specific shelves to visit
  function getShoppingListCategories() {
    const categories = new Set<string>();
    const corridorsToVisit = new Set<string>();
    const shelvesToVisit = new Set<string>(); // Track specific shelves (e.g., "Gang 1-N", "Gang 1-S")
    
    Object.entries(storeData).forEach(([gangKey, gangData]) => {
      if (gangKey === 'Seiten M') {
        Object.entries(gangData as any).forEach(([categoryKey, products]) => {
          (products as string[]).forEach((product: string) => {
            items.forEach(item => {
              if (product.toLowerCase().includes(item.text.toLowerCase()) ||
                  item.text.toLowerCase().includes(product.toLowerCase())) {
                categories.add(`${gangKey}-${categoryKey}`);
                corridorsToVisit.add(gangKey);
                shelvesToVisit.add('Seiten M');
              }
            });
          });
        });
      } else {
        ['N', 'S'].forEach(section => {
          const sectionData = (gangData as any)[section];
          if (!sectionData) return;

          if (sectionData.categories) {
            Object.entries(sectionData.categories).forEach(([categoryKey, products]) => {
              (products as string[]).forEach((product: string) => {
                items.forEach(item => {
                  if (product.toLowerCase().includes(item.text.toLowerCase()) ||
                      item.text.toLowerCase().includes(product.toLowerCase())) {
                    categories.add(`${gangKey}-${section}-${categoryKey}`);
                    corridorsToVisit.add(gangKey);
                    shelvesToVisit.add(`${gangKey}-${section}`);
                  }
                });
              });
            });
          }

          if (sectionData.positions) {
            Object.entries(sectionData.positions).forEach(([direction, positionCategories]) => {
              Object.entries(positionCategories as Record<string, string[]>).forEach(([categoryKey, products]) => {
                (products as string[]).forEach((product: string) => {
                  items.forEach(item => {
                    if (product.toLowerCase().includes(item.text.toLowerCase()) ||
                        item.text.toLowerCase().includes(product.toLowerCase())) {
                      categories.add(`${gangKey}-${section}-${direction}-${categoryKey}`);
                      corridorsToVisit.add(gangKey);
                      shelvesToVisit.add(`${gangKey}-${section}`);
                    }
                  });
                });
              });
            });
          }
        });
      }
    });
    
    return { categories, corridorsToVisit, shelvesToVisit };
  }

  const { categories: highlightedCategories, corridorsToVisit, shelvesToVisit } = getShoppingListCategories();

  const getOptimizedPath = () => {
    const optimizer = new StoreOptimizer(storeData);
    return optimizer.optimizeShoppingPath(items.map(item => item.text));
  };

  const getPathSteps = () => {
    const path = getOptimizedPath();
    const steps: Array<{
      id: number;
      title: string;
      description: string;
      location: string;
      action: string;
      entryPoint?: string;
      exitPoint?: string;
    }> = [];
    
    // Step 0: Start at entrance
    steps.push({
      id: 0,
      title: "Start",
      description: "Begin at Eingang",
      location: "Eingang",
      action: "enter"
    });

    // Steps for each corridor
    path.forEach((location) => {
      if (location.name === 'Seiten M') {
        steps.push({
          id: steps.length,
          title: location.name,
          description: "Visit side section",
          location: location.name,
          action: "visit",
          entryPoint: "West",
          exitPoint: "West"
        });
      } else if (location.name.startsWith('Gang ')) {
        const walkingDirection = location.entryPoint === location.exitPoint 
          ? "visit only" 
          : location.entryPoint === "East" && location.exitPoint === "West" 
            ? "walk East → West" 
            : location.entryPoint === "West" && location.exitPoint === "East"
              ? "walk West → East"
              : `${location.entryPoint} → ${location.exitPoint}`;
        
        steps.push({
          id: steps.length,
          title: location.name,
          description: walkingDirection,
          location: location.name,
          action: location.entryPoint === location.exitPoint ? "visit" : "traverse",
          entryPoint: location.entryPoint,
          exitPoint: location.exitPoint
        });
      }
    });

    // Final step: Go to checkout
    steps.push({
      id: steps.length,
      title: "Checkout",
      description: "Proceed to Kassen",
      location: "Kassen",
      action: "checkout"
    });

    return steps;
  };

  const steps = useMemo(() => getPathSteps(), [items.map(item => item.text).join(',')]);
  

  
  // Save activeStep to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('storeLayoutActiveStep', activeStep.toString());
  }, [activeStep]);

  // Get items for a specific location
  const getItemsForLocation = (location: string) => {
    const foundItems: Array<{
      name: string;
      category: string;
      side: string;
      direction: string;
      checked: boolean;
    }> = [];

    if (location === 'Seiten M') {
      // Get items from Seiten M
      if (storeData['Seiten M']) {
        Object.entries(storeData['Seiten M']).forEach(([category, products]) => {
          (products as string[]).forEach((product: string) => {
            items.forEach(item => {
              if (product.toLowerCase().includes(item.text.toLowerCase()) ||
                  item.text.toLowerCase().includes(product.toLowerCase())) {
                foundItems.push({
                  name: item.text,
                  category,
                  side: 'Seiten M',
                  direction: '',
                  checked: item.completed || false
                });
              }
            });
          });
        });
      }
    } else if (location.startsWith('Gang ')) {
      // Get items from specific gang
      const gangData = storeData[location];
      if (gangData) {
        ['N', 'S'].forEach(section => {
          const sectionData = gangData[section];
          if (!sectionData) return;

          // Check categories
          if (sectionData.categories) {
            Object.entries(sectionData.categories).forEach(([category, products]) => {
              (products as string[]).forEach((product: string) => {
                items.forEach(item => {
                  if (product.toLowerCase().includes(item.text.toLowerCase()) ||
                      item.text.toLowerCase().includes(product.toLowerCase())) {
                    foundItems.push({
                      name: item.text,
                      category,
                      side: section === 'N' ? 'North Shelf' : 'South Shelf',
                      direction: section,
                      checked: item.completed || false
                    });
                  }
                });
              });
            });
          }

          // Check positioned items (E/W)
          if (sectionData.positions) {
            Object.entries(sectionData.positions).forEach(([direction, categories]) => {
              Object.entries(categories as Record<string, string[]>).forEach(([category, products]) => {
                (products as string[]).forEach((product: string) => {
                  items.forEach(item => {
                    if (product.toLowerCase().includes(item.text.toLowerCase()) ||
                        item.text.toLowerCase().includes(product.toLowerCase())) {
                      foundItems.push({
                        name: item.text,
                        category,
                        side: `${section === 'N' ? 'North' : 'South'} Shelf (${direction} side)`,
                        direction: section,
                        checked: item.completed || false
                      });
                    }
                  });
                });
              });
            });
          }
        });
      }
    }

    return foundItems;
  };

  // Handle item check/uncheck
  const handleItemCheck = (itemName: string, checked: boolean) => {
    if (onItemToggle) {
      onItemToggle(itemName, checked);
    }
  };

  // Render shelf categories
  const renderShelfCategories = (gangKey: string, section: string, y: number) => {
    const sectionData = storeData[gangKey]?.[section];
    if (!sectionData) return null;

    const allCategories: { key: string, name: string, isHighlighted: boolean }[] = [];

    if (sectionData.categories) {
      Object.entries(sectionData.categories).forEach(([categoryKey, _]) => {
        allCategories.push({
          key: `${gangKey}-${section}-${categoryKey}`,
          name: categoryKey,
          isHighlighted: highlightedCategories.has(`${gangKey}-${section}-${categoryKey}`)
        });
      });
    }

    if (sectionData.positions) {
      Object.entries(sectionData.positions).forEach(([direction, categories]) => {
        Object.entries(categories as Record<string, string[]>).forEach(([categoryKey, _]) => {
          allCategories.push({
            key: `${gangKey}-${section}-${direction}-${categoryKey}`,
            name: categoryKey,
            isHighlighted: highlightedCategories.has(`${gangKey}-${section}-${direction}-${categoryKey}`)
          });
        });
      });
    }

    if (allCategories.length === 0) return null;

    const categoryWidth = LAYOUT.shelf.width / allCategories.length;

    return allCategories.map((category, index) => {
      const x = LAYOUT.shelf.startX + (index * categoryWidth);
      
      return (
        <text
          key={category.key}
          x={x + categoryWidth / 2}
          y={y + LAYOUT.shelf.height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="40"
          fill={category.isHighlighted ? '#000000' : '#666666'}
          fontWeight={category.isHighlighted ? 'bold' : 'normal'}
        >
          {category.name}
        </text>
      );
    });
  };

  // Render Seiten M categories
  const renderSeitenMCategories = () => {
    if (!storeData['Seiten M']) return null;

    const allCategories = Object.entries(storeData['Seiten M']).map(([categoryKey, _]) => ({
      key: `Seiten M-${categoryKey}`,
      name: categoryKey,
      isHighlighted: highlightedCategories.has(`Seiten M-${categoryKey}`)
    }));
    
    if (allCategories.length === 0) return null;

    const categoryHeight = LAYOUT.seitenM.height / allCategories.length;

    return allCategories.map((category, index) => {
      const y = index * categoryHeight;
      
      return (
        <text
          key={category.key}
          x={LAYOUT.seitenM.x + LAYOUT.seitenM.width/2}
          y={LAYOUT.seitenM.y + y + categoryHeight/2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="30"
          fill={category.isHighlighted ? '#000000' : '#666666'}
          fontWeight={category.isHighlighted ? 'bold' : 'normal'}
          transform={`rotate(-90, ${LAYOUT.seitenM.x + LAYOUT.seitenM.width/2}, ${LAYOUT.seitenM.y + y + categoryHeight/2})`}
        >
          {category.name}
        </text>
      );
    });
  };

  // Calculate position for a given step
  const getStepPosition = (stepIndex: number) => {
    if (stepIndex === 0) {
      // Eingang position
      const eingangCenterY = LAYOUT.entrance.y - (LAYOUT.entrance.y - (LAYOUT.corridors[6].corridorCenter + 25)) / 2;
      return {
        x: LAYOUT.entrance.x + LAYOUT.entrance.width / 2,
        y: eingangCenterY
      };
    }

    const step = steps[stepIndex];
    if (!step) return null;

    const path = getOptimizedPath();
    const pathLocation = path.find(loc => loc.name === step.location);

    if (step.location === 'Seiten M') {
      return {
        x: LAYOUT.seitenM.x + LAYOUT.seitenM.width / 2,
        y: LAYOUT.seitenM.y + LAYOUT.seitenM.height / 2
      };
    } else if (step.location.startsWith('Gang ') && pathLocation) {
      const gangNum = parseInt(step.location.split(' ')[1]) - 1;
      const corridor = LAYOUT.corridors[gangNum];
      
      // Use exit point as the end position for this step
      const exitX = pathLocation.exitPoint === 'East' ? corridor.turnPointRight : corridor.turnPointLeft;
      return {
        x: exitX,
        y: corridor.corridorCenter
      };
    } else if (step.location === 'Kassen') {
      const kassaCenterY = LAYOUT.kassa.y - (LAYOUT.kassa.y - (LAYOUT.corridors[6].corridorCenter + 25)) / 2;
      return {
        x: LAYOUT.kassa.x + LAYOUT.kassa.width / 2,
        y: kassaCenterY
      };
    }

    return null;
  };

  // Render path from previous step to current step using ALL turn points
  const renderCurrentStepPath = () => {
    if (activeStep === 0) return null;

    const path = getOptimizedPath();
    const commands: string[] = [];
    
    // Build complete path up to current step following the EXACT working implementation
    let currentX = LAYOUT.entrance.x + LAYOUT.entrance.width / 2;
    let currentY = LAYOUT.entrance.y - (LAYOUT.entrance.y - (LAYOUT.corridors[6].corridorCenter + 25)) / 2;
    
    // After Eingang: Move to outer turn point first (left or right), then to final corridor turn point
    // Determine which outer turn point to use based on first destination
    const firstStep = steps[1];
    let useLeftTurnPoint = true;
    if (firstStep && firstStep.location.startsWith('Gang ')) {
      const pathLocation = path.find(loc => loc.name === firstStep.location);
      if (pathLocation) {
        useLeftTurnPoint = pathLocation.entryPoint === 'West';
      }
    }
    
    // Step 1: Move to appropriate outer turn point at final corridor level
    currentX = useLeftTurnPoint ? LAYOUT.corridors[6].turnPointLeft : LAYOUT.corridors[6].turnPointRight;
    currentY = LAYOUT.corridors[6].corridorCenter;

    // Track positions after each step to know where we are
    const stepPositions = [{ x: LAYOUT.entrance.x + LAYOUT.entrance.width / 2, y: LAYOUT.entrance.y - (LAYOUT.entrance.y - (LAYOUT.corridors[6].corridorCenter + 25)) / 2 }];
    
    // Simulate movement through each step to track EXACT position
    for (let i = 1; i < activeStep; i++) {
      const step = steps[i];
      const pathLocation = path.find(loc => loc.name === step.location);
      
      if (step.location === 'Seiten M') {
        // After Seiten M, we're at left turn point
        currentX = LAYOUT.corridors[0].turnPointLeft;
        currentY = LAYOUT.corridors[0].corridorCenter;
      } else if (step.location.startsWith('Gang ') && pathLocation) {
        const gangNum = parseInt(step.location.split(' ')[1]) - 1;
        const corridor = LAYOUT.corridors[gangNum];
        const exitX = pathLocation.exitPoint === 'East' ? corridor.turnPointRight : corridor.turnPointLeft;
        currentX = exitX;
        currentY = corridor.corridorCenter;
      }
      stepPositions.push({ x: currentX, y: currentY });
    }

    // Now render the path from previous position to current step using ALL turn points
    const previousPos = stepPositions[activeStep - 1];
    commands.push(`M ${previousPos.x} ${previousPos.y}`);

    const currentStep = steps[activeStep];
    const pathLocation = path.find(loc => loc.name === currentStep.location);

    if (currentStep.location === 'Seiten M') {
      // Navigate to Seiten M: previous pos -> left turn point -> Seiten M -> back to left turn point
      if (activeStep === 1) {
        // First step from Eingang: go to outer turn point first
        const finalCorridorLevel = LAYOUT.corridors[6].corridorCenter;
        commands.push(`L ${LAYOUT.corridors[6].turnPointLeft} ${finalCorridorLevel}`);
        commands.push(`L ${LAYOUT.corridors[0].turnPointLeft} ${finalCorridorLevel}`);
        commands.push(`L ${LAYOUT.corridors[0].turnPointLeft} ${LAYOUT.seitenM.y + LAYOUT.seitenM.height/2}`);
        commands.push(`L ${LAYOUT.corridors[0].turnPointLeft} ${finalCorridorLevel}`);
      } else {
        // From other locations
        commands.push(`L ${LAYOUT.corridors[0].turnPointLeft} ${previousPos.y}`);
        commands.push(`L ${LAYOUT.corridors[0].turnPointLeft} ${LAYOUT.seitenM.y + LAYOUT.seitenM.height/2}`);
        commands.push(`L ${LAYOUT.corridors[0].turnPointLeft} ${previousPos.y}`);
      }
      
    } else if (currentStep.location.startsWith('Gang ') && pathLocation) {
      const gangNum = parseInt(currentStep.location.split(' ')[1]) - 1;
      const corridor = LAYOUT.corridors[gangNum];
      
      const entryX = pathLocation.entryPoint === 'East' ? corridor.turnPointRight : corridor.turnPointLeft;
      const exitX = pathLocation.exitPoint === 'East' ? corridor.turnPointRight : corridor.turnPointLeft;
      
      if (activeStep === 1) {
        // First step from Eingang: go to outer turn point first, then to corridor, then to entry point
        const finalCorridorLevel = LAYOUT.corridors[6].corridorCenter;
        const outerTurnPointX = useLeftTurnPoint ? LAYOUT.corridors[6].turnPointLeft : LAYOUT.corridors[6].turnPointRight;
        commands.push(`L ${outerTurnPointX} ${finalCorridorLevel}`);
        commands.push(`L ${outerTurnPointX} ${corridor.corridorCenter}`);
        commands.push(`L ${entryX} ${corridor.corridorCenter}`);
      } else {
        // Move to corridor level at current position (vertical move through corridor space)
        commands.push(`L ${previousPos.x} ${corridor.corridorCenter}`);
        // Move to entry turn point (horizontal move)
        commands.push(`L ${entryX} ${corridor.corridorCenter}`);
      }
      
      // Show walking direction through corridor
      if (entryX !== exitX) {
        // Traverse from entry to exit
        commands.push(`L ${exitX} ${corridor.corridorCenter}`);
      } else {
        // Visit only: create clear U-turn visualization
        const corridorCenter = (corridor.turnPointLeft + corridor.turnPointRight) / 2;
        const offsetY = corridor.corridorCenter + 60; // Larger offset for clear U-turn
        const uturnWidth = 80; // Width of the U-turn
        const uturnLeft = corridorCenter - uturnWidth/2;
        const uturnRight = corridorCenter + uturnWidth/2;
        
        // Create a proper U-turn path
        commands.push(`L ${corridorCenter} ${corridor.corridorCenter}`); // Go to center
        commands.push(`L ${uturnLeft} ${corridor.corridorCenter}`); // Move left
        commands.push(`L ${uturnLeft} ${offsetY}`); // Down left side
        commands.push(`L ${uturnRight} ${offsetY}`); // Across bottom
        commands.push(`L ${uturnRight} ${corridor.corridorCenter}`); // Up right side
        commands.push(`L ${entryX} ${corridor.corridorCenter}`); // Back to entry point
      }
      
    } else if (currentStep.location === 'Kassen') {
      // Navigate to Kassen using proper turn points - walk back down to furthest down turn point
      const bottomTurnPoint = LAYOUT.corridors[5]; // Gang 6 is furthest down
      commands.push(`L ${previousPos.x} ${bottomTurnPoint.corridorCenter}`);
      
      // Use appropriate turn point based on current position
      const useRightTurnPoint = previousPos.x > (bottomTurnPoint.turnPointLeft + bottomTurnPoint.turnPointRight) / 2;
      const finalTurnPointX = useRightTurnPoint ? bottomTurnPoint.turnPointRight : bottomTurnPoint.turnPointLeft;
      commands.push(`L ${finalTurnPointX} ${bottomTurnPoint.corridorCenter}`);
      
      // Move down to final corridor level
      const finalCorridorLevel = LAYOUT.corridors[6].corridorCenter;
      commands.push(`L ${finalTurnPointX} ${finalCorridorLevel}`);
      
      // Move horizontally to Kassa turn point
      const kassaTurnPointX = LAYOUT.kassa.x + LAYOUT.kassa.width / 2;
      commands.push(`L ${kassaTurnPointX} ${finalCorridorLevel}`);
      
      // Finally move down to Kassa
      const kassaCenterY = LAYOUT.kassa.y - (LAYOUT.kassa.y - (LAYOUT.corridors[6].corridorCenter + 25)) / 2;
      commands.push(`L ${kassaTurnPointX} ${kassaCenterY}`);
    }

    if (commands.length === 0) return null;

    // Check if this is a U-turn (visit only) to add special indicators
    const isUturn = currentStep.location.startsWith('Gang ') && pathLocation && 
                   pathLocation.entryPoint === pathLocation.exitPoint;
    
    let uturnCorridor = null;
    if (isUturn && currentStep.location.startsWith('Gang ')) {
      const gangNum = parseInt(currentStep.location.split(' ')[1]) - 1;
      uturnCorridor = LAYOUT.corridors[gangNum];
    }

    return (
      <>
        <path
          d={commands.join(' ')}
          fill="none"
          stroke={LAYOUT.colors.path}
          strokeWidth="6"
          strokeDasharray="10 10"
          strokeLinejoin="round"
          strokeLinecap="round"
          markerEnd="url(#arrowhead)"
        />
        {isUturn && uturnCorridor && (
          <>
            {/* Add U-turn indicator text */}
            <text
              x={(uturnCorridor.turnPointLeft + uturnCorridor.turnPointRight) / 2}
              y={uturnCorridor.corridorCenter + 80}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={LAYOUT.colors.path}
              fontSize="20"
              fontWeight="bold"
            >
              ↺ VISIT
            </text>
            {/* Add extra arrow at the turn point */}
            <circle
              cx={(uturnCorridor.turnPointLeft + uturnCorridor.turnPointRight) / 2}
              cy={uturnCorridor.corridorCenter + 60}
              r="8"
              fill={LAYOUT.colors.path}
              stroke="white"
              strokeWidth="2"
            />
          </>
        )}
      </>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Store Navigation</h2>
        <button 
          onClick={() => setIsExpanded(true)}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
        >
          Expand Map
        </button>
      </div>
      
      {/* Map Section */}
      <div className="mb-6">
        <div className="bg-gray-50 rounded-xl overflow-hidden border-2 border-gray-200">
          <div style={{ maxHeight: '500px', overflow: 'hidden' }}>
            <svg
              viewBox={`0 0 ${LAYOUT.viewBox.width} ${LAYOUT.viewBox.height}`}
              className="w-full h-auto"
            >
              <defs>
                <marker
                  id="arrowhead"
                  viewBox="0 0 10 10"
                  refX="5"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={LAYOUT.colors.path}/>
                </marker>
              </defs>

              {/* Seiten M */}
              <rect
                x={LAYOUT.seitenM.x}
                y={LAYOUT.seitenM.y}
                width={LAYOUT.seitenM.width}
                height={LAYOUT.seitenM.height}
                fill={corridorsToVisit.has('Seiten M') ? LAYOUT.colors.highlight : LAYOUT.colors.shelf}
                stroke={LAYOUT.colors.wallStroke}
                strokeWidth="2"
                opacity={steps[activeStep]?.location === 'Seiten M' ? 1 : 0.7}
              />
              <text
                x={LAYOUT.seitenM.x + LAYOUT.seitenM.width/2}
                y={LAYOUT.seitenM.y + LAYOUT.seitenM.height/2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="black"
                fontSize="60"
                transform={`rotate(-90, ${LAYOUT.seitenM.x + LAYOUT.seitenM.width/2}, ${LAYOUT.seitenM.y + LAYOUT.seitenM.height/2})`}
              >
                Seiten M
              </text>
              {renderSeitenMCategories()}

              {/* Shelves */}
              {LAYOUT.corridors.map((corridor, i) => {
                if (i >= 6) return null;
                
                const gangKey = `Gang ${i + 1}`;
                const isActiveStep = steps[activeStep]?.location === gangKey;
                const northShelfHighlighted = shelvesToVisit.has(`${gangKey}-N`);
                const southShelfHighlighted = shelvesToVisit.has(`${gangKey}-S`);

                return (
                  <g key={i}>
                    <rect
                      x={LAYOUT.shelf.startX}
                      y={corridor.northShelf!}
                      width={LAYOUT.shelf.width}
                      height={LAYOUT.shelf.height}
                      fill={northShelfHighlighted ? LAYOUT.colors.highlight : LAYOUT.colors.shelf}
                      stroke={LAYOUT.colors.wallStroke}
                      strokeWidth="2"
                      opacity={isActiveStep ? 1 : 0.7}
                    />
                    {renderShelfCategories(gangKey, 'N', corridor.northShelf!)}
                    
                    <rect
                      x={LAYOUT.shelf.startX}
                      y={corridor.southShelf!}
                      width={LAYOUT.shelf.width}
                      height={LAYOUT.shelf.height}
                      fill={southShelfHighlighted ? LAYOUT.colors.highlight : LAYOUT.colors.shelf}
                      stroke={LAYOUT.colors.wallStroke}
                      strokeWidth="2"
                      opacity={isActiveStep ? 1 : 0.7}
                    />
                    {renderShelfCategories(gangKey, 'S', corridor.southShelf!)}
                  </g>
                );
              })}

              {/* Dividing Lines */}
              {LAYOUT.corridors.map((corridor, i) => {
                if (i >= 6 || !corridor.southShelf) return null;
                
                return (
                  <line
                    key={i}
                    x1={LAYOUT.shelf.startX}
                    y1={corridor.southShelf + LAYOUT.shelf.height}
                    x2={LAYOUT.shelf.startX + LAYOUT.shelf.width}
                    y2={corridor.southShelf + LAYOUT.shelf.height}
                    stroke={LAYOUT.colors.wall}
                    strokeWidth="5"
                  />
                );
              })}

              {/* Current Step Path */}
              {renderCurrentStepPath()}

              {/* Entrance and Kassa */}
              <rect
                x={LAYOUT.kassa.x}
                y={LAYOUT.kassa.y}
                width={LAYOUT.kassa.width}
                height={LAYOUT.kassa.height}
                fill={LAYOUT.colors.wall}
                opacity={steps[activeStep]?.location === 'Kassen' ? 1 : 0.7}
              />
              <text
                x={LAYOUT.kassa.x + LAYOUT.kassa.width/2}
                y={LAYOUT.kassa.y + LAYOUT.kassa.height/2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="50"
              >
                KASSEN
              </text>
              
              <rect
                x={LAYOUT.entrance.x}
                y={LAYOUT.entrance.y}
                width={LAYOUT.entrance.width}
                height={LAYOUT.entrance.height}
                fill="#10B981"
                opacity={steps[activeStep]?.location === 'Eingang' ? 1 : 0.7}
              />
              <text
                x={LAYOUT.entrance.x + LAYOUT.entrance.width/2}
                y={LAYOUT.entrance.y + LAYOUT.entrance.height/2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="50"
              >
                EINGANG
              </text>
            </svg>
          </div>
        </div>
      </div>

      {/* Steps Section - Below Map */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800">Shopping Steps</h3>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const newActiveStep = Math.max(0, activeStep - 1);
                setActiveStep(newActiveStep);
                // If going back to first step, show all steps again
                if (newActiveStep === 0) {
                  setHasStartedNavigation(false);
                  setLastCompletedStep(-1);
                } else {
                  // Show steps from the new active step onwards
                  setLastCompletedStep(newActiveStep - 1);
                }
              }}
              disabled={activeStep === 0}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setHasStartedNavigation(true);
                setLastCompletedStep(activeStep);
                setActiveStep(Math.min(steps.length - 1, activeStep + 1));
              }}
              disabled={activeStep === steps.length - 1}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        


        {/* Shopping List Summary - Show after clicking "Finish Shopping" button or reaching last step */}
        {(showShoppingSummary || activeStep === steps.length - 1) && (
          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-green-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold">
                ✓
              </div>
              <h3 className="text-lg font-bold text-gray-800">Shopping Complete!</h3>
            </div>
            <p className="text-gray-600 mb-4">Here's your shopping list summary:</p>
            
            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="checkbox"
                      checked={item.completed || false}
                      onChange={(e) => handleItemCheck(item.text, e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-green-500 focus:ring-green-500"
                    />
                    <span className={`text-sm font-medium ${
                      item.completed ? 'line-through text-gray-400' : 'text-gray-700'
                    }`}>
                      {item.text}
                    </span>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    item.completed 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {item.completed ? 'Got it!' : 'Still needed'}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Completed:</span>
                <span className="font-medium text-green-600">
                  {items.filter(item => item.completed).length} of {items.length}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {steps.map((step, index) => {
            const locationItems = getItemsForLocation(step.location);
            
            // Show all steps initially, then hide completed steps after navigation starts
            const shouldShow = !hasStartedNavigation || 
                             index > lastCompletedStep;
            
            if (!shouldShow) return null;
            
            return (
              <div
                key={`step-${step.title}-${index}`}
                onClick={() => setActiveStep(index)}
                className={`p-4 rounded-xl cursor-pointer transition-all ${
                  activeStep === index
                    ? 'bg-red-100 border-2 border-red-300 shadow-md'
                    : index === activeStep - 1
                    ? 'bg-gray-50 border border-gray-200 shadow-sm'
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    activeStep === index
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800">{step.title}</h4>
                    <p className="text-sm text-gray-600">{step.description}</p>
                    {step.entryPoint && step.exitPoint && (
                      <p className="text-xs text-gray-500 mt-1">
                        {step.entryPoint} → {step.exitPoint}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Items List - Show for all steps initially, then only current step */}
                {locationItems.length > 0 && (!hasStartedNavigation || index === activeStep) && (
                  <div className="mt-4 space-y-2">
                    {/* Group items by side */}
                    {Object.entries(
                      locationItems.reduce((acc, item) => {
                        const key = item.side;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(item);
                        return acc;
                      }, {} as Record<string, typeof locationItems>)
                    ).map(([side, items]) => (
                      <div
                        key={side}
                        className="bg-white rounded-lg shadow-sm p-3 border border-gray-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="text-xs font-medium text-gray-500 mb-2">
                          {side}
                        </div>
                        <div className="space-y-2">
                          {items.map((item, itemIndex) => (
                            <label
                              key={itemIndex}
                              className="flex items-start gap-3 cursor-pointer group"
                            >
                              <div className="pt-0.5">
                                <input
                                  type="checkbox"
                                  checked={item.checked}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleItemCheck(item.name, e.target.checked);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-4 h-4 rounded border-gray-300 text-red-500 
                                           focus:ring-red-500 transition-all duration-150
                                           group-hover:border-red-400"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={`text-sm font-medium transition-all duration-150
                                              ${item.checked ? 'line-through text-gray-400' : 'text-gray-700 group-hover:text-gray-900'}`}>
                                  {item.name}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {item.category}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Finish Shopping Button - Only show on "Head to Kassa" step */}
                {step.title === "Head to Kassa" && activeStep === index && !showShoppingSummary && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowShoppingSummary(true);
                      }}
                      className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 12l2 2 4-4"/>
                        <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"/>
                      </svg>
                      Finish Shopping
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal for expanded view */}
      {isExpanded && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <button 
            onClick={() => setIsExpanded(false)}
            className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors z-[60]"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="w-[90vw] h-[90vh] bg-white rounded-lg overflow-hidden p-4">
            <svg
              viewBox={`0 0 ${LAYOUT.viewBox.width} ${LAYOUT.viewBox.height}`}
              className="w-full h-full"
            >
              <defs>
                <marker
                  id="arrowhead-expanded"
                  viewBox="0 0 10 10"
                  refX="5"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={LAYOUT.colors.path}/>
                </marker>
              </defs>
              {/* Same SVG content as above but larger */}
              {/* Seiten M */}
              <rect
                x={LAYOUT.seitenM.x}
                y={LAYOUT.seitenM.y}
                width={LAYOUT.seitenM.width}
                height={LAYOUT.seitenM.height}
                fill={corridorsToVisit.has('Seiten M') ? LAYOUT.colors.highlight : LAYOUT.colors.shelf}
                stroke={LAYOUT.colors.wallStroke}
                strokeWidth="2"
              />
              <text
                x={LAYOUT.seitenM.x + LAYOUT.seitenM.width/2}
                y={LAYOUT.seitenM.y + LAYOUT.seitenM.height/2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="black"
                fontSize="60"
                transform={`rotate(-90, ${LAYOUT.seitenM.x + LAYOUT.seitenM.width/2}, ${LAYOUT.seitenM.y + LAYOUT.seitenM.height/2})`}
              >
                Seiten M
              </text>
              {renderSeitenMCategories()}

              {/* Shelves */}
              {LAYOUT.corridors.map((corridor, i) => {
                if (i >= 6) return null;
                
                const gangKey = `Gang ${i + 1}`;
                const northShelfHighlighted = shelvesToVisit.has(`${gangKey}-N`);
                const southShelfHighlighted = shelvesToVisit.has(`${gangKey}-S`);

                return (
                  <g key={i}>
                    <rect
                      x={LAYOUT.shelf.startX}
                      y={corridor.northShelf!}
                      width={LAYOUT.shelf.width}
                      height={LAYOUT.shelf.height}
                      fill={northShelfHighlighted ? LAYOUT.colors.highlight : LAYOUT.colors.shelf}
                      stroke={LAYOUT.colors.wallStroke}
                      strokeWidth="2"
                    />
                    {renderShelfCategories(gangKey, 'N', corridor.northShelf!)}
                    
                    <rect
                      x={LAYOUT.shelf.startX}
                      y={corridor.southShelf!}
                      width={LAYOUT.shelf.width}
                      height={LAYOUT.shelf.height}
                      fill={southShelfHighlighted ? LAYOUT.colors.highlight : LAYOUT.colors.shelf}
                      stroke={LAYOUT.colors.wallStroke}
                      strokeWidth="2"
                    />
                    {renderShelfCategories(gangKey, 'S', corridor.southShelf!)}
                  </g>
                );
              })}

              {/* Dividing Lines */}
              {LAYOUT.corridors.map((corridor, i) => {
                if (i >= 6 || !corridor.southShelf) return null;
                
                return (
                  <line
                    key={i}
                    x1={LAYOUT.shelf.startX}
                    y1={corridor.southShelf + LAYOUT.shelf.height}
                    x2={LAYOUT.shelf.startX + LAYOUT.shelf.width}
                    y2={corridor.southShelf + LAYOUT.shelf.height}
                    stroke={LAYOUT.colors.wall}
                    strokeWidth="5"
                  />
                );
              })}

              {/* Current Step Path */}
              {renderCurrentStepPath()}

              {/* Entrance and Kassa */}
              <rect
                x={LAYOUT.kassa.x}
                y={LAYOUT.kassa.y}
                width={LAYOUT.kassa.width}
                height={LAYOUT.kassa.height}
                fill={LAYOUT.colors.wall}
              />
              <text
                x={LAYOUT.kassa.x + LAYOUT.kassa.width/2}
                y={LAYOUT.kassa.y + LAYOUT.kassa.height/2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="50"
              >
                KASSEN
              </text>
              
              <rect
                x={LAYOUT.entrance.x}
                y={LAYOUT.entrance.y}
                width={LAYOUT.entrance.width}
                height={LAYOUT.entrance.height}
                fill="#10B981"
              />
              <text
                x={LAYOUT.entrance.x + LAYOUT.entrance.width/2}
                y={LAYOUT.entrance.y + LAYOUT.entrance.height/2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="50"
              >
                EINGANG
              </text>
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreLayoutVisual; 