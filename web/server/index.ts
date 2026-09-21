/**
 * Local API listener — `npm run server`.
 *
 * The app itself lives in server/app.ts, shared with the Vite dev server and
 * the Vercel function so all three serve identical routes.
 */
import app from './app';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✅ API Server running on http://localhost:${PORT}`);
  console.log(`🔧 Pipeline UI: http://localhost:${PORT}/pipeline`);
});

export default app;
