import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
  plugins: [
    react(),
    {
      name: 'api-server',
      // Dev server only. The import is dynamic and lives inside
      // configureServer so that `vite build` never loads the API: importing
      // it at the top of this file pulled in services/db.ts, which throws
      // when DATABASE_URL is unset — a production build would then fail on
      // any machine without the database secret.
      apply: 'serve',
      async configureServer(server) {
        // The same Express app the Vercel function serves — one definition,
        // so dev and production can never drift apart again.
        const { default: app } = await import('./server/app');
        server.middlewares.use(app);
      },
    },
  ],
  // No `define` for API keys. Anything written into `define` is inlined into
  // the public JS bundle; GEMINI_API_KEY used to be shipped to every visitor
  // that way. All model calls now go through /api/ai on the server.
  build: {
    rollupOptions: {
      output: {
        // Keep the icons together. Left alone, Rollup hoists each icon shared
        // by two lazy views into its own ~0.3 kB file — twenty extra requests,
        // each paying a full round trip on a slow mobile connection.
        manualChunks: (id) => (id.includes('node_modules/lucide-react') ? 'icons' : undefined),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
