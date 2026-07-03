#!/usr/bin/env node
/**
 * convert_review_pdfs.mjs — render docs/bible-review/*.md to printable PDFs.
 *
 * Pipeline: pandoc (gfm → HTML body) → print-styled HTML → headless Chrome
 * → docs/bible-review/pdf/<name>.pdf. Chrome renders Ethiopic script
 * correctly with the system font stack (Noto Sans Ethiopic / Kefa), which is
 * why it is used instead of a LaTeX engine.
 *
 * Usage: node scripts/convert_review_pdfs.mjs [file.md ...]   (default: all)
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';

const DIR = '/Users/mekdesyared/Mekra-Catholic-Bible-Wiki/docs/bible-review';
const OUT = join(DIR, 'pdf');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PANDOC = '/opt/homebrew/bin/pandoc';

const CSS = `
@page { size: A4; margin: 16mm 13mm 18mm 13mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  font-family: "Noto Sans Ethiopic", "Abyssinica SIL", "Kefa", sans-serif;
  font-size: 10.5pt; line-height: 1.45; color: #111; margin: 0;
}
h1 { font-size: 15pt; margin: 0 0 6pt; }
h2 { font-size: 12pt; margin: 12pt 0 4pt; }
p { margin: 4pt 0; }
a { color: inherit; text-decoration: none; }
code, pre { font-family: Menlo, monospace; font-size: 8.5pt; background: #f4f4f4; }
pre { padding: 6pt; border: 0.5pt solid #ccc; }
table { border-collapse: collapse; width: 100%; margin-top: 6pt; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th, td { border: 0.6pt solid #888; padding: 3pt 5pt; text-align: left; vertical-align: top; font-size: 9.5pt; }
th { background: #e8e8e8; font-size: 9.5pt; }
tbody tr:nth-child(even) td { background: #f6f6f6; }
/* decision column: room to write by hand */
table th:last-child, table td:last-child { min-width: 26mm; width: 26mm; }
/* reference + category columns stay compact */
table th:first-child, table td:first-child { white-space: nowrap; }
`;

mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2);
const files = args.length
  ? args.map(a => basename(a))
  : readdirSync(DIR).filter(f => f.endsWith('.md')).sort();

let done = 0;
for (const f of files) {
  const src = join(DIR, f);
  if (!existsSync(src)) { console.error(`skip (missing): ${f}`); continue; }
  const body = execFileSync(PANDOC, ['-f', 'gfm', '--wrap=none', '-t', 'html', src],
    { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
  const title = (readFileSync(src, 'utf8').match(/^# (.+)$/m) ?? [, f])[1];
  const html = `<!doctype html><html lang="am"><head><meta charset="utf-8">
<title>${title}</title><style>${CSS}</style></head><body>${body}</body></html>`;
  const tmp = join(tmpdir(), `review-${process.pid}-${done}.html`);
  writeFileSync(tmp, html);
  const pdf = join(OUT, f.replace(/\.md$/, '.pdf'));
  execFileSync(CHROME, [
    '--headless', '--disable-gpu', '--no-pdf-header-footer',
    `--print-to-pdf=${pdf}`, `file://${tmp}`,
  ], { stdio: 'ignore' });
  done++;
  process.stderr.write(`  ${f} → pdf\n`);
}
console.log(`PDFs written: ${done} → ${OUT}`);
