import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { apiMiddleware } from './server/middleware';
import express from 'express';
import pipelineRouter from './server/routes/pipeline';
import aiRouter from './server/routes/ai';
import wikiRouter from './server/routes/wiki';

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
          // Mount the Express pipeline router and /pipeline route natively into Vite
          const app = express();
          app.get('/pipeline', (_req, res) => {
            res.sendFile(path.resolve(process.cwd(), 'pipeline-workflow.html'));
          });
          app.use(express.json());
          app.use('/api/pipeline', pipelineRouter);
          app.use('/api/ai', aiRouter);
          app.use('/api/wiki', wikiRouter);
          server.middlewares.use(app);

          // Add default API middleware before Vite's middleware
          server.middlewares.use(apiMiddleware());
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
