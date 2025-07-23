# Spar Shopping App

A smart shopping assistant for Spar stores that provides optimized shopping paths and interactive store navigation.

## Features

- **Interactive Store Layout**: Visual map of the Spar store with shelf locations
- **Optimized Shopping Path**: AI-powered route optimization for efficient shopping
- **Step-by-Step Navigation**: Guided shopping experience with turn-by-turn directions
- **Item Tracking**: Check off items as you shop with persistent state
- **Store Inventory**: Only allows adding items that are actually available in the store
- **Responsive Design**: Works on desktop and mobile devices

## Live Demo

Visit the live application: [Spar Shopping App](https://splendiferousnoctifer.github.io/spar_app/)

## How It Works

1. **Create Shopping List**: Search and select items from the store inventory
2. **Get Optimized Path**: The app calculates the most efficient route through the store
3. **Follow Visual Guide**: Use the interactive map and step-by-step instructions
4. **Track Progress**: Check off items as you collect them

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Build Tool**: Vite
- **Deployment**: GitHub Pages

## Development

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/splendiferousnoctifer/spar_app.git
cd spar_app

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
```

### Deploy to GitHub Pages

The app automatically deploys to GitHub Pages when you push to the main branch.

## Project Structure

```
spar_app/
├── src/
│   ├── components/
│   │   ├── StoreLayoutVisual.tsx    # Interactive store map
│   │   └── OptimizedShoppingPath.tsx # Shopping path logic
│   ├── data/
│   │   └── articles.json            # Store inventory data
│   └── App.tsx                      # Main application
├── data/                            # Store layout and product data
└── scripts/                         # Data processing scripts
```

## Store Layout

The app includes a detailed map of the Spar store with:
- **Gang corridors** (Gang 1-6) with North/South shelves
- **Seiten M section** for special items
- **Entrance and checkout** areas
- **Optimized walking paths** between sections

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is open source and available under the MIT License. 