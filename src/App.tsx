import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit3, CheckCircle2, Circle, RotateCcw, Search, MapPin, ArrowLeft, Home, ShoppingCart, ChefHat, Star, Heart } from 'lucide-react';
import SparLogo from './components/SparLogo';
import OptimizedShoppingPath from './components/OptimizedShoppingPath';
import articles from './data/articles.json';

interface ShoppingItem {
  id: string;
  text: string;
  completed?: boolean;
  createdAt: Date;
}

interface GroceryItem {
  id: string;
  name: string;
  category: string;
  gang: string;
}

interface FavoriteItem {
  id: string;
  name: string;
  category: string;
  gang: string;
}

// Updated interfaces for the articles.json structure
interface StringArray extends Array<string> {}

interface Categories {
  [category: string]: StringArray;
}

interface Positions {
  [direction: string]: Categories;
}

interface SectionData {
  categories?: Categories;
  positions?: Positions;
}

interface GangSection {
  N?: SectionData;
  S?: SectionData;
  [key: string]: StringArray | SectionData | undefined;
}

interface ArticleData {
  [gang: string]: GangSection;
}

type ViewType = 'home' | 'shopping-list' | 'recipes' | 'product-search' | 'favorites' | 'shopping-path';

// Search utility functions
const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s]/g, ''); // Remove special characters
};

const calculateLevenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + substitutionCost // substitution
      );
    }
  }

  return matrix[b.length][a.length];
};

const calculateSimilarityScore = (query: string, item: string): number => {
  const normalizedQuery = normalizeString(query);
  const normalizedItem = normalizeString(item);
  
  // Exact match bonus
  if (normalizedItem === normalizedQuery) return 1;
  
  // Contains bonus
  if (normalizedItem.includes(normalizedQuery)) return 0.8;
  
  // Word match bonus
  const queryWords = normalizedQuery.split(/\s+/);
  const itemWords = normalizedItem.split(/\s+/);
  const wordMatchCount = queryWords.filter(word => 
    itemWords.some(itemWord => itemWord.includes(word))
  ).length;
  const wordMatchScore = wordMatchCount / queryWords.length * 0.6;
  
  // Levenshtein distance score
  const maxLength = Math.max(normalizedQuery.length, normalizedItem.length);
  const levenshteinScore = maxLength > 0 
    ? (maxLength - calculateLevenshteinDistance(normalizedQuery, normalizedItem)) / maxLength * 0.4
    : 0;
  
  return Math.max(wordMatchScore, levenshteinScore);
};

const searchProducts = (query: string, allItems: GroceryItem[]): GroceryItem[] => {
  if (!query.trim()) return [];

  const scoredItems = allItems.map(item => {
    // Calculate name similarity score
    const nameScore = calculateSimilarityScore(query, item.name) * 0.7;
    
    // Calculate category similarity score
    const categoryScore = calculateSimilarityScore(query, item.category) * 0.3;
    
    // Combine scores
    const totalScore = nameScore + categoryScore;
    
    return { item, score: totalScore };
  });

  // Filter items with a minimum score and sort by score
  return scoredItems
    .filter(({ score }) => score > 0.2) // Minimum threshold
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
    .slice(0, 20); // Limit results
};

function App() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<GroceryItem[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GroceryItem[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load items from localStorage on mount
  useEffect(() => {
    const savedItems = localStorage.getItem('shoppingList');
    if (savedItems) {
      try {
        const parsedItems = JSON.parse(savedItems);
        setItems(parsedItems.map((item: any) => ({
          ...item,
          completed: item.completed || false,
          createdAt: new Date(item.createdAt)
        })));
      } catch (error) {
        console.error('Error parsing saved items:', error);
      }
    }
    
    const savedFavorites = localStorage.getItem('favorites');
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (error) {
        console.error('Error parsing saved favorites:', error);
      }
    }
  }, []);

  // Save items to localStorage whenever items change
  useEffect(() => {
    localStorage.setItem('shoppingList', JSON.stringify(items));
  }, [items]);

  // Save favorites to localStorage whenever favorites change
  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites));
  }, [favorites]);

  // Get all grocery items from the database
  const getAllGroceryItems = (): GroceryItem[] => {
    const allItems: GroceryItem[] = [];
    const articlesData = articles as unknown as ArticleData;
    
    Object.entries(articlesData).forEach(([gangKey, gangData]) => {
      // Handle both N and S sections
      ['N', 'S'].forEach(section => {
        const sectionData = gangData[section as keyof GangSection] as SectionData | undefined;
        if (!sectionData) return;

        // Handle categories
        if (sectionData.categories) {
          Object.entries(sectionData.categories).forEach(([categoryKey, items]) => {
            items.forEach((itemName: string, index: number) => {
              allItems.push({
                id: `${gangKey}_${section}_${categoryKey}_${index}`,
                name: itemName,
                category: categoryKey,
                gang: gangKey
              });
            });
          });
        }

        // Handle positions
        if (sectionData.positions) {
          Object.entries(sectionData.positions).forEach(([direction, categories]) => {
            Object.entries(categories).forEach(([categoryKey, items]) => {
              items.forEach((itemName: string, index: number) => {
                allItems.push({
                  id: `${gangKey}_${section}_${direction}_${categoryKey}_${index}`,
                  name: itemName,
                  category: categoryKey,
                  gang: gangKey
                });
              });
            });
          });
        }
      });

      // Handle direct string arrays (like in Seiten M)
      Object.entries(gangData).forEach(([key, value]) => {
        if (key !== 'N' && key !== 'S' && Array.isArray(value)) {
          value.forEach((itemName: string, index: number) => {
            allItems.push({
              id: `${gangKey}_${key}_${index}`,
              name: itemName,
              category: key,
              gang: gangKey
            });
          });
        }
      });
    });
    
    return allItems;
  };

  // Search products
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const allGroceryItems = getAllGroceryItems();
      const filtered = searchProducts(searchQuery, allGroceryItems);
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // Filter suggestions based on input
  useEffect(() => {
    if (newItem.trim().length > 0) {
      const allGroceryItems = getAllGroceryItems();
      const filtered = searchProducts(newItem, allGroceryItems)
        .filter(item => !items.some(existingItem => 
          existingItem.text.toLowerCase() === item.name.toLowerCase()
        ))
        .slice(0, 5);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }, [newItem, items]);

  const addItem = () => {
    if (newItem.trim()) {
      // Only allow adding items that exist in the store
      const availableItems = getAllGroceryItems();
      const matchingItem = availableItems.find(item => 
        item.name.toLowerCase() === newItem.trim().toLowerCase()
      );
      
      if (matchingItem) {
        const item: ShoppingItem = {
          id: Date.now().toString(),
          text: matchingItem.name,
          completed: false,
          createdAt: new Date()
        };
        setItems(prev => [item, ...prev]);
        setNewItem('');
        setShowSuggestions(false);
      } else {
        // Show error or just don't add the item
        alert('Dieser Artikel ist nicht im Laden verfügbar. Bitte wählen Sie aus den Vorschlägen unten.');
      }
    }
  };

  const addSuggestion = (suggestion: GroceryItem) => {
    const item: ShoppingItem = {
      id: Date.now().toString(),
      text: suggestion.name,
      completed: false,
      createdAt: new Date()
    };
    setItems(prev => [item, ...prev]);
    setNewItem('');
    setShowSuggestions(false);
  };

  const addToFavorites = (item: GroceryItem) => {
    const favoriteItem: FavoriteItem = {
      id: item.id,
      name: item.name,
      category: item.category,
      gang: item.gang
    };
    
    if (!favorites.some(fav => fav.id === item.id)) {
      setFavorites(prev => [...prev, favoriteItem]);
    }
  };

  const removeFromFavorites = (itemId: string) => {
    setFavorites(prev => prev.filter(fav => fav.id !== itemId));
  };

  const addProductToShoppingList = (item: GroceryItem) => {
    const shoppingItem: ShoppingItem = {
      id: Date.now().toString(),
      text: item.name,
      completed: false,
      createdAt: new Date()
    };
    setItems(prev => [shoppingItem, ...prev]);
  };

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const startEditing = (id: string, text: string) => {
    setEditingId(id);
    setEditingText(text);
  };

  const saveEdit = () => {
    if (editingText.trim() && editingId) {
      setItems(prev => prev.map(item =>
        item.id === editingId ? { ...item, text: editingText.trim() } : item
      ));
      setEditingId(null);
      setEditingText('');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  const clearCompleted = () => {
    setItems(prev => prev.filter(item => !item.completed));
  };

  // Organize items by category for store view
  const organizeItemsByCategory = () => {
    const organized: { [key: string]: { name: string; items: ShoppingItem[]; gang?: string } } = {};
    const articlesData = articles as unknown as ArticleData;
    
    // Initialize categories from articles
    Object.entries(articlesData).forEach(([gangKey, gangData]) => {
      // Handle both N and S sections
      ['N', 'S'].forEach(section => {
        const sectionData = gangData[section as keyof GangSection] as SectionData | undefined;
        if (!sectionData) return;

        // Handle categories
        if (sectionData.categories) {
          Object.entries(sectionData.categories).forEach(([categoryKey, items]) => {
            if (!organized[categoryKey]) {
              organized[categoryKey] = { 
                name: getCategoryDisplayName(categoryKey), 
                items: [],
                gang: gangKey
              };
            }
          });
        }

        // Handle positions
        if (sectionData.positions) {
          Object.entries(sectionData.positions).forEach(([_, categories]) => {
            Object.entries(categories).forEach(([categoryKey, items]) => {
              if (!organized[categoryKey]) {
                organized[categoryKey] = { 
                  name: getCategoryDisplayName(categoryKey), 
                  items: [],
                  gang: gangKey
                };
              }
            });
          });
        }
      });

      // Handle direct categories (like in Seiten M)
      Object.entries(gangData).forEach(([key, value]) => {
        if (key !== 'N' && key !== 'S' && Array.isArray(value)) {
          if (!organized[key]) {
            organized[key] = { 
              name: getCategoryDisplayName(key), 
              items: [],
              gang: gangKey
            };
          }
        }
      });
    });
    
    // Add uncategorized section
    organized['uncategorized'] = { name: 'Sonstige Artikel', items: [] };
    
    // Sort items into categories
    items.forEach(item => {
      let categorized = false;
      const allGroceryItems = getAllGroceryItems();
      
      // Try to find matching category from all grocery items
      const matchingItem = allGroceryItems.find(groceryItem => 
        groceryItem.name.toLowerCase() === item.text.toLowerCase()
      );
      
      if (matchingItem) {
        if (organized[matchingItem.category]) {
          organized[matchingItem.category].items.push(item);
          categorized = true;
        }
      }
      
      // If not found in any category, add to uncategorized
      if (!categorized) {
        organized['uncategorized'].items.push(item);
      }
    });
    
    // Filter out empty categories
    return Object.entries(organized).filter(([_, category]) => category.items.length > 0);
  };

  // Helper function to get display name for categories
  const getCategoryDisplayName = (categoryKey: string): string => {
    const displayNames: { [key: string]: string } = {
      'öl': 'Öl & Essig',
      'Gedeckter tisch': 'Gedeckter Tisch',
      'Gewürze': 'Gewürze & Saucen',
      'Chips': 'Chips & Snacks',
      'Kosmetik': 'Kosmetik & Pflege',
      'Süßw.': 'Süßwaren',
      'Wein': 'Wein & Spirituosen',
      'FF': 'Free From',
      'Baby': 'Baby & Kind',
      'Reinigung': 'Reinigung & Haushalt',
      'Getränke': 'Getränke',
      'Mopro': 'Molkereiprodukte',
      'TK': 'Tiefkühl',
      'Zerialien': 'Cerealien & Müsli',
      'Toast': 'Brot & Backwaren',
      'Kaffee': 'Kaffee & Heißgetränke',
      'Getränkereg': 'Getränke Regal',
      'Teigwaren': 'Teigwaren & Reis',
      'Suppen': 'Suppen & Fertiggerichte'
    };
    
    return displayNames[categoryKey] || categoryKey;
  };
  
  // Header Component
  const Header = () => (
    <div className="bg-red-600 shadow-md sticky top-0 z-50">
      <div className="max-w-md mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SparLogo className="w-8 h-6" />
            <span className="text-lg font-bold text-white">SPAR</span>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentView('home')}
              className={`p-2 rounded-lg transition-colors ${
                currentView === 'home' 
                  ? 'bg-red-800 text-white' 
                  : 'text-red-100 hover:bg-red-700'
              }`}
            >
              <Home className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => setCurrentView('shopping-list')}
              className={`p-2 rounded-lg transition-colors ${
                currentView === 'shopping-list' 
                  ? 'bg-red-800 text-white' 
                  : 'text-red-100 hover:bg-red-700'
              }`}
            >
              <ShoppingCart className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => setCurrentView('recipes')}
              className={`p-2 rounded-lg transition-colors ${
                currentView === 'recipes' 
                  ? 'bg-red-800 text-white' 
                  : 'text-red-100 hover:bg-red-700'
              }`}
            >
              <ChefHat className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => setCurrentView('product-search')}
              className={`p-2 rounded-lg transition-colors ${
                currentView === 'product-search' 
                  ? 'bg-red-800 text-white' 
                  : 'text-red-100 hover:bg-red-700'
              }`}
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Footer Component
  const Footer = () => (
    <div className="bg-red-600 mt-auto">
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="text-center text-white/80 text-sm">
          <p className="font-medium">Meisterprojekt</p>
          <p className="mt-1">
            <span className="opacity-90">Severin Zühlke-Ebner</span>
            
          </p>
        </div>
      </div>
    </div>
  );

  // Home View
  const HomeView = () => (
    <div className="max-w-md mx-auto px-4 py-6">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center mb-4">
          <SparLogo className="w-32 h-20 drop-shadow-lg" />
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Willkommen bei SPAR</h1>
        <p className="text-gray-600">Ihr digitaler Einkaufsbegleiter</p>
      </div>

      {/* Featured Favorites Horizontal Scroll */}
      {favorites.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Beliebte Favoriten
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
            {favorites.slice(0, 10).map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl shadow-md p-4 min-w-[160px] flex-shrink-0 hover:shadow-lg transition-all duration-200"
              >
                <div className="text-center mb-3">
                  <h4 className="font-medium text-gray-800 text-sm mb-1 line-clamp-2">{item.name}</h4>
                  <p className="text-xs text-gray-500">{getCategoryDisplayName(item.category)}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => addProductToShoppingList(item)}
                    className="flex-1 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium flex items-center justify-center gap-1"
                    title="Zur Einkaufsliste hinzufügen"
                  >
                    <Plus className="w-4 h-4" />
                    Hinzufügen
                  </button>
                  <button
                    onClick={() => removeFromFavorites(item.id)}
                    className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm flex items-center justify-center"
                    title="Aus Favoriten entfernen"
                  >
                    <Heart className="w-4 h-4 fill-current" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setCurrentView('shopping-list')}
          className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-200 hover:scale-105"
        >
          <ShoppingCart className="w-8 h-8 text-red-500 mb-3 mx-auto" />
          <h3 className="font-bold text-gray-800 mb-1">Einkaufsliste</h3>
          <p className="text-sm text-gray-600">Erstellen und verwalten Sie Ihre Einkaufsliste</p>
        </button>

        <button
          onClick={() => setCurrentView('product-search')}
          className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-200 hover:scale-105"
        >
          <Search className="w-8 h-8 text-red-500 mb-3 mx-auto" />
          <h3 className="font-bold text-gray-800 mb-1">Produktsuche</h3>
          <p className="text-sm text-gray-600">Suchen und entdecken Sie SPAR Produkte</p>
        </button>

        <button
          onClick={() => setCurrentView('recipes')}
          className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-200 hover:scale-105"
        >
          <ChefHat className="w-8 h-8 text-red-500 mb-3 mx-auto" />
          <h3 className="font-bold text-gray-800 mb-1">Rezepte</h3>
          <p className="text-sm text-gray-600">Entdecken Sie köstliche Rezepte</p>
        </button>

        <button
          onClick={() => setCurrentView('favorites')}
          className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-200 hover:scale-105"
        >
          <Heart className="w-8 h-8 text-red-500 mb-3 mx-auto" />
          <h3 className="font-bold text-gray-800 mb-1">Meine Favoriten</h3>
          <p className="text-sm text-gray-600">{favorites.length} gespeicherte Produkte</p>
        </button>
      </div>
    </div>
  );

  // Recipes View (placeholder)
  const RecipesView = () => (
    <div className="max-w-md mx-auto px-4 py-6">
      <div className="text-center mb-8">
        <ChefHat className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Rezepte</h1>
        <p className="text-gray-600">Demnächst verfügbar!</p>
      </div>
      
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <p className="text-gray-500 mb-4">Rezeptfunktionen werden bald verfügbar sein.</p>
        <p className="text-sm text-gray-400">Entdecken Sie köstliche Rezepte und fügen Sie automatisch Zutaten zu Ihrer Einkaufsliste hinzu.</p>
      </div>
    </div>
  );

  // Favorites View
  const FavoritesView = () => (
    <div className="max-w-md mx-auto px-4 py-6">
      <div className="text-center mb-8">
        <Heart className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Meine Favoriten</h1>
        <p className="text-gray-600">{favorites.length} gespeicherte Produkte</p>
      </div>

      {/* Favorites Grid */}
      {favorites.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {favorites.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-800 mb-1">{item.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <MapPin className="w-4 h-4" />
                    <span>{getCategoryDisplayName(item.category)}</span>
                    <span>•</span>
                    <span>{item.gang}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => addProductToShoppingList(item)}
                  className="flex-1 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Zur Einkaufsliste hinzufügen
                </button>
                
                <button
                  onClick={() => removeFromFavorites(item.id)}
                  className="px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center"
                  title="Remove from favorites"
                >
                  <Heart className="w-5 h-5 fill-current" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-2">Noch keine Favoriten</p>
          <p className="text-gray-400 mb-6">Suchen Sie nach Produkten und fügen Sie sie zu Favoriten hinzu</p>
          <button
            onClick={() => setCurrentView('product-search')}
            className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
          >
            Produkte suchen
          </button>
        </div>
      )}
    </div>
  );

  // Product Search View
  const ProductSearchView = () => (
    <div className="max-w-md mx-auto px-4 py-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Produktsuche</h1>
        <p className="text-gray-600">Entdecken und hinzufügen Sie SPAR Produkte</p>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Nach Produkten suchen..."
            autoComplete="off"
            autoFocus
            className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-700 placeholder-gray-400"
          />
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        </div>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Suchergebnisse ({searchResults.length})
          </h2>
          <div className="space-y-3">
            {searchResults.map((item) => (
              <div key={item.id} className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-800 mb-1">{item.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <MapPin className="w-4 h-4" />
                      <span>{getCategoryDisplayName(item.category)}</span>
                      <span>•</span>
                      <span>{item.gang}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => addProductToShoppingList(item)}
                    className="flex-1 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Zur Liste hinzufügen
                  </button>
                  
                  <button
                    onClick={() => favorites.some(fav => fav.id === item.id) ? removeFromFavorites(item.id) : addToFavorites(item)}
                    className={`px-3 py-2 rounded-lg transition-colors flex items-center justify-center ${
                      favorites.some(fav => fav.id === item.id)
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${favorites.some(fav => fav.id === item.id) ? 'fill-current' : ''}`} />
                  </button>
                  
                  {/* Temporarily hidden location button
                  <button
                    className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center"
                    title={`Located in: ${getCategoryDisplayName(item.category)} (${item.gang})`}
                  >
                    <MapPin className="w-4 h-4" />
                  </button>
                  */}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {searchQuery.length === 0 && (
        <div className="text-center py-12">
          <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-2">Suchen Sie nach SPAR Produkten</p>
          <p className="text-gray-400">Geben Sie in das Suchfeld ein, um Produkte zu entdecken</p>
        </div>
      )}

      {searchQuery.length > 0 && searchResults.length === 0 && (
        <div className="text-center py-12">
          <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-2">Keine Produkte gefunden</p>
          <p className="text-gray-400">Versuchen Sie einen anderen Suchbegriff</p>
        </div>
      )}
    </div>
  );

  // Store Navigation View (for shopping list items)
  const ShoppingPathView = () => {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <Header />
        <div className="max-w-md mx-auto px-4 py-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Einkaufen starten</h1>
            <p className="text-gray-600">Ihr optimierter Einkaufsweg</p>
          </div>

          <OptimizedShoppingPath 
            items={items} 
            storeData={articles} 
            onItemToggle={(itemName, completed) => {
              const item = items.find(i => i.text === itemName);
              if (item) {
                toggleItem(item.id);
              }
            }}
          />

          <div className="mt-6">
            <button
              onClick={() => setCurrentView('shopping-list')}
              className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Zurück zur Einkaufsliste
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  };

  if (currentView === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col">
        <Header />
        <HomeView />
        <Footer />
      </div>
    );
  }

  if (currentView === 'favorites') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col">
        <Header />
        <FavoritesView />
        <Footer />
      </div>
    );
  }

  if (currentView === 'product-search') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col">
        <Header />
        <ProductSearchView />
        <Footer />
      </div>
    );
  }

  if (currentView === 'recipes') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col">
        <Header />
        <RecipesView />
        <Footer />
      </div>
    );
  }

  if (currentView === 'shopping-list') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col">
        <Header />
        <div className="max-w-md mx-auto px-4 py-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Einkaufsliste</h1>
            <p className="text-gray-600">Wählen Sie Artikel aus dem Ladenbestand</p>
          </div>

          {/* Add Item Form */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 relative">
            <div className="relative">
              <input
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onFocus={() => newItem.trim().length > 0 && setShowSuggestions(suggestions.length > 0)}
                placeholder="Nach Artikeln im Laden suchen..."
                className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-700 placeholder-gray-400"
              />
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            
            {/* Suggestions Dropdown */}
            {showSuggestions && (
              <div className="absolute left-6 right-6 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-60 overflow-y-auto">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    onClick={() => addSuggestion(suggestion)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                  >
                    <span className="text-gray-800 font-medium">{suggestion.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Items List */}
          <div className="space-y-3 mb-6">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl shadow-md p-4 transition-all duration-300 hover:shadow-lg"
              >
                {editingId === item.id ? (
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && saveEdit()}
                      onBlur={saveEdit}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoFocus
                    />
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-2 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span
                      className="flex-1 text-gray-800"
                    >
                      {item.text}
                    </span>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditing(item.id, item.text)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Find in Store Button */}
          {items.length > 0 && (
            <div className="mb-6">
              <button
                onClick={() => setCurrentView('shopping-path')}
                className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                <MapPin className="w-5 h-5" />
                Einkaufen starten
                <span className="text-sm opacity-75">(Im Laden finden)</span>
              </button>
            </div>
          )}
          


          {/* Empty State */}
          {items.length === 0 && (
            <div className="text-center py-12">
              <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg mb-2">Ihre Einkaufsliste ist leer</p>
              <p className="text-gray-400">Fügen Sie Ihren ersten Artikel hinzu, um zu beginnen!</p>
            </div>
          )}
        </div>
        <Footer />
      </div>
    );
  }

  if (currentView === 'shopping-path') {
    return <ShoppingPathView />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col">
      <Header />
      <HomeView />
      <Footer />
    </div>
  );
}

export default App;