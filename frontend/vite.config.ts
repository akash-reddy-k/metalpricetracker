import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Cache-revision salt (`-c2`). Bump this (c3, c4, ...) to force every
        // emitted asset onto a brand-new URL. Needed once because an earlier
        // SPA-fallback bug let HTML be served — and then cached `immutable` for
        // a year — at some /assets/*.js URLs, permanently breaking browsers that
        // cached the poison. Content hashes alone could not rescue them: an
        // unchanged chunk keeps its hash, so affected browsers kept hitting the
        // same poisoned URL. New filenames force a clean fetch for everyone.
        entryFileNames: 'assets/[name]-[hash]-c2.js',
        chunkFileNames: 'assets/[name]-[hash]-c2.js',
        assetFileNames: 'assets/[name]-[hash]-c2[extname]',
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
