import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/spar_app/', // GitHub Pages base path
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
