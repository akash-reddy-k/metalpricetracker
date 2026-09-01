import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // Separate React runtime from application code — browsers cache
          // the framework chunk across deploys since it rarely changes.
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/react-router')) {
            return 'router';
          }
        },
      },
    },
    // Inline small assets to reduce HTTP requests on mobile
    assetsInlineLimit: 4096,
    // Target modern browsers for smaller output
    target: 'es2020',
  },
});
