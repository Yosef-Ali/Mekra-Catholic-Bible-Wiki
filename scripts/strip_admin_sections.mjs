#!/usr/bin/env node
// Strip end-user-irrelevant admin sections from every wiki page so what a
// priest / catechist / faithful sees is only canonical, end-user-focused
// content. Admin info stays in frontmatter (still rendered in the page header
// as needed) and in git history; only the rendered body changes.
//
// Removed sections (everywhere):
//   ## In the Compendium    — English navigation meta; redundant with the
//                             frontmatter `**Compendium Q:**` field and with
//                             the per-Q `### QNNN` blocks below.
//   ## Open questions       — editorial / TODO notes from earlier sessions.
//   ## Sources              — provenance metadata for admins; visually noisy
//                             for end users.
//
// Preserved (untouched):
//   frontmatter, ## Synthesis, ## Compendium Q&A, ## In Scripture, ## Scripture,
//   ## How to … action sections, and anything else not in the kill list.
//
// Idempotent — re-running produces no further changes once the sections are gone.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WIKI_DIR = path.join(ROOT, 'wiki');
const DRY_RUN = process.argv.includes('--dry-run');

// Section headings to strip. Matched case-insensitively at line start.
const KILL_HEADINGS = [
  'In the Compendium',
  'Open questions',
  'Sources',
];

async function* walk(dir) {
  for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && entry.name.endsWith('.md')) yield full;
  }
}

// Remove `## <heading>` and everything below it up to (not including) the next
// `## ` heading or end-of-file. Imperative slice — avoids /m-flag $ pitfalls.
function stripSection(content, heading) {
  const re = new RegExp(`(?:^|\\n)## ${heading}\\b`, 'i');
  const m = content.match(re);
  if (!m) return content;
  const start = m.index + (m[0].startsWith('\n') ? 1 : 0);  // keep preceding newline if any
  const after = content.slice(start + 1);
  const rel = after.search(/\n## |\n# /);
  const end = rel >= 0 ? start + 1 + rel : content.length;
  // Trim trailing newline run on the head so we don't leave a double blank.
  const head = content.slice(0, start).replace(/\n+$/, '\n');
  const tail = content.slice(end).replace(/^\n+/, '');
  // Ensure exactly one blank line between head and tail if both non-empty.
  if (!head.endsWith('\n')) return head + (tail ? '\n\n' + tail : '');
  return head + (tail ? '\n' + tail : '');
}

async function main() {
  let filesScanned = 0, filesChanged = 0, sectionsStripped = 0;
  const perSectionCount = Object.fromEntries(KILL_HEADINGS.map(h => [h, 0]));

  for await (const fpath of walk(WIKI_DIR)) {
    filesScanned++;
    const original = fs.readFileSync(fpath, 'utf8');
    let updated = original;
    for (const heading of KILL_HEADINGS) {
      const before = updated;
      updated = stripSection(updated, heading);
      if (updated !== before) {
        sectionsStripped++;
        perSectionCount[heading]++;
      }
    }
    if (updated === original) continue;
    filesChanged++;
    if (!DRY_RUN) fs.writeFileSync(fpath, updated);
  }

  console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}files scanned: ${filesScanned}`);
  console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}files changed: ${filesChanged}`);
  console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}sections stripped: ${sectionsStripped}`);
  for (const [h, n] of Object.entries(perSectionCount)) {
    console.log(`  ## ${h}: ${n}`);
  }
}

main();
