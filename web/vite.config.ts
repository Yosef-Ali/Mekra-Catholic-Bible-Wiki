import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import app from './server/app';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 5173,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      {
        name: 'api-server',
        configureServer(server) {
          // The same Express app the Vercel function serves — one definition,
          // so dev and production can never drift apart again.
          server.middlewares.use(app);
        },
      },
    ],
    define: {
      // Only expose API keys, NOT database credentials
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY),
      // DO NOT expose DATABASE_URL to the client
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
