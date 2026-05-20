import { Router, Request, Response } from 'express';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

const router = Router();

// Track the running pipeline process
let activeProcess: ChildProcess | null = null;
const activeClients = new Set<Response>();

const PROJECT_ROOT = path.resolve(process.cwd());
const SUMMARY_FILE = path.join(PROJECT_ROOT, 'extraction_output', 'harness_summary.json');

/**
 * GET /api/pipeline/run — SSE endpoint
 * Spawns meta-harness.ts and streams stdout/stderr as SSE events.
 *
 * Query params:
 *   mode: 'auto' | 'book' | 'range' | 'dry'
 *   book: book name (when mode=book)
 *   from: start page (when mode=range)
 *   to: end page (when mode=range)
 *   dryRun: 'true' | 'false'
 */
router.get('/run', (req: Request, res: Response) => {
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Prevent internal Node timeouts from killing the SSE connection
  req.socket.setTimeout(0);
  req.socket.setNoDelay(true);
  req.socket.setKeepAlive(true);

  // Don't allow multiple concurrent runs
  if (activeProcess && !activeProcess.killed) {
    sendSSE(res, 'error', { message: 'Pipeline already running. Stop it first.' });
    res.end();
    return;
  }

  const mode = (req.query.mode as string) || 'auto';
  const dryRun = req.query.dryRun === 'true';
  const book = req.query.book as string;
  const from = req.query.from as string;
  const to = req.query.to as string;

  // Build CLI args for meta-harness.ts
  const args: string[] = [];

  if (mode === 'auto' || mode === 'dry') {
    args.push('--auto');
    if (dryRun || mode === 'dry') args.push('--dry-run');
  } else if (mode === 'book') {
    args.push('--book', book || 'Genesis');
    if (dryRun) args.push('--dry-run');
  } else if (mode === 'range') {
    if (from) args.push(from);
    if (to) args.push(to);
    if (dryRun) args.push('--dry-run');
  }

  sendSSE(res, 'status', { state: 'starting', mode, args });

  // Spawn the real pipeline
  const scriptPath = path.join(PROJECT_ROOT, 'scripts', 'meta-harness.ts');
  activeProcess = spawn('npx', ['tsx', scriptPath, ...args], {
    cwd: PROJECT_ROOT,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  activeClients.add(res);

  sendSSE(res, 'status', { state: 'running', pid: activeProcess.pid });

  let cleaned = false;
  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    clearInterval(pingInterval);
    activeClients.delete(res);
  }

  // Stream stdout line by line
  let stdoutBuffer = '';
  activeProcess.stdout!.on('data', (chunk: Buffer) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop() || ''; // keep incomplete last line in buffer

    for (const line of lines) {
      if (line.trim()) {
        const parsed = parsePipelineLine(line);
        sendSSE(res, 'log', { raw: line, ...parsed });
      }
    }
  });

  // Stream stderr
  let stderrBuffer = '';
  activeProcess.stderr!.on('data', (chunk: Buffer) => {
    stderrBuffer += chunk.toString();
    const lines = stderrBuffer.split('\n');
    stderrBuffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        sendSSE(res, 'stderr', { raw: line });
      }
    }
  });

  // Add ping interval to keep connection alive
  const pingInterval = setInterval(() => {
    res.write(':\n\n'); // SSE comment
  }, 15000);

  activeProcess.on('close', (code) => {
    // Flush remaining buffer
    if (stdoutBuffer.trim()) {
      const parsed = parsePipelineLine(stdoutBuffer);
      sendSSE(res, 'log', { raw: stdoutBuffer, ...parsed });
    }

    sendSSE(res, 'status', { state: 'done', exitCode: code });
    activeProcess = null;
    cleanup();
    res.end();
  });

  activeProcess.on('error', (err) => {
    sendSSE(res, 'stderr', { message: err.message });
    activeProcess = null;
    cleanup();
    res.end();
  });

  // Client disconnect — kill process if no other listeners
  req.on('close', () => {
    cleanup();
    if (activeClients.size === 0 && activeProcess && !activeProcess.killed) {
      activeProcess.kill('SIGTERM');
      activeProcess = null;
    }
  });
});

/**
 * POST /api/pipeline/stop — kill the running pipeline
 */
router.post('/stop', (_req: Request, res: Response) => {
  if (activeProcess && !activeProcess.killed) {
    activeProcess.kill('SIGTERM');
    activeProcess = null;
    // Notify all SSE clients
    for (const client of activeClients) {
      sendSSE(client, 'status', { state: 'stopped' });
      client.end();
    }
    activeClients.clear();
    res.json({ success: true, message: 'Pipeline stopped' });
  } else {
    res.json({ success: false, message: 'No pipeline running' });
  }
});

/**
 * GET /api/pipeline/status — return harness_summary.json
 */
router.get('/status', (_req: Request, res: Response) => {
  const isRunning = activeProcess !== null && !activeProcess.killed;

  try {
    const summary = JSON.parse(fs.readFileSync(SUMMARY_FILE, 'utf-8'));
    res.json({ success: true, running: isRunning, summary });
  } catch {
    res.json({ success: true, running: isRunning, summary: null });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function sendSSE(res: Response, event: string, data: object) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Parse a pipeline log line to identify which phase/node it maps to.
 * This drives the UI node activation in the frontend.
 */
function parsePipelineLine(line: string): { phase?: string; detail?: string; type?: string } {
  // Page header
  if (line.includes('📄 Page')) {
    const match = line.match(/Page (\d+)/);
    return { phase: 'trigger', detail: match?.[1] || '', type: 'page_start' };
  }

  // Step 1: Extract (or Retry)
  if (line.includes('[Step 1]')) {
    const isRetry = line.includes('Retry');
    return { phase: isRetry ? 'retry' : 'extract', detail: line, type: isRetry ? 'retry' : 'extract' };
  }

  // PDF conversion (gs command)
  if (line.includes('gs -sDEVICE') || line.includes('page_') && line.includes('.png')) {
    return { phase: 'pdf', detail: line, type: 'pdf_convert' };
  }

  // Got chapters/verses
  if (line.includes('📝 Got')) {
    return { phase: 'extract', detail: line, type: 'extract_result' };
  }

  // Step 2: Structural + LLM review
  if (line.includes('[Step 2]')) {
    return { phase: 'structural', detail: line, type: 'review_start' };
  }

  // Review passed
  if (line.includes('✅ Review PASSED') || line.includes('Review PASSED')) {
    return { phase: 'decide', detail: 'PASS', type: 'decide_pass' };
  }

  // Review failed
  if (line.includes('❌ Review FAILED') || line.includes('Review FAILED')) {
    return { phase: 'decide', detail: 'FAIL', type: 'decide_fail' };
  }

  // No chapters extracted
  if (line.includes('⚠️') && line.includes('No chapters')) {
    return { phase: 'extract', detail: line, type: 'extract_empty' };
  }

  // Step 4: Match DB
  if (line.includes('[Step 4]')) {
    return { phase: 'dbmatch', detail: line, type: 'db_match' };
  }

  // DB match details (individual chapter matches)
  if (line.includes('% match') || line.includes('NEW (no DB data')) {
    return { phase: 'dbmatch', detail: line, type: 'db_match_detail' };
  }

  // Step 5: Seed DB
  if (line.includes('[Step 5]')) {
    return { phase: 'dbseed', detail: line, type: 'db_seed' };
  }

  // DB seed details
  if (line.includes('🔄') || line.includes('✨') || line.includes('⏭️')) {
    if (line.includes('Ch.') && (line.includes('updated') || line.includes('inserted') || line.includes('skipped'))) {
      return { phase: 'dbseed', detail: line, type: 'db_seed_detail' };
    }
  }

  // Step 6: Quality
  if (line.includes('[Step 6]')) {
    return { phase: 'quality', detail: line, type: 'quality' };
  }

  // Dry run skip
  if (line.includes('🏜️') || line.includes('Dry run')) {
    return { phase: 'verified', detail: line, type: 'dry_skip' };
  }

  // Page failed
  if (line.includes('🚫 Page') && line.includes('failed')) {
    return { phase: 'decide', detail: line, type: 'page_fail' };
  }

  // Pipeline complete
  if (line.includes('PIPELINE COMPLETE') || line.includes('AUTO MODE COMPLETE')) {
    return { phase: 'verified', detail: line, type: 'pipeline_done' };
  }

  // LLM review (Gemma 4)
  if (line.includes('Gemma') || line.includes('ollama') || line.includes('semantic')) {
    return { phase: 'llm', detail: line, type: 'llm_review' };
  }

  // Book header in auto mode
  if (line.includes('📚') && line.includes('pages')) {
    return { phase: 'trigger', detail: line, type: 'book_start' };
  }

  // Already complete (skip)
  if (line.includes('Already complete') || line.includes('Nothing to resume')) {
    return { phase: 'verified', detail: line, type: 'skip' };
  }

  // META-HARNESS header
  if (line.includes('META-HARNESS') || line.includes('AUTO MODE')) {
    return { phase: 'trigger', detail: line, type: 'header' };
  }

  // Resuming
  if (line.includes('RESUMING')) {
    return { phase: 'trigger', detail: line, type: 'resume' };
  }

  return { detail: line, type: 'info' };
}

export default router;
