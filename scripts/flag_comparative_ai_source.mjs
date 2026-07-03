#!/usr/bin/env node
/**
 * Flag the AI-generated provenance of comparative wiki pages.
 *
 * The non-Catholic sections of every `wiki/comparative/*.md` page (Ethiopian
 * Orthodox Tewahedo, Eastern Orthodox, Protestant) describe positions that are
 * NOT in the canonical Catholic source (`raw/catechism-digital/`). They are
 * AI-generated and must be marked as such per the project's "mark AI as AI"
 * rule. This adds one bold-field frontmatter line per page:
 *
 *   **Comparison source:** AI-generated — non-Catholic positions not from the Compendium; pending review
 *
 * Idempotent: skips any page that already carries the flag. The line is
 * inserted right after the `**Amharic:**` line (or the `**Type:**` line if no
 * Amharic title is present), keeping it inside the frontmatter block.
 *
 * Usage:
 *   node scripts/flag_comparative_ai_source.mjs --dry-run   # preview only
 *   node scripts/flag_comparative_ai_source.mjs             # apply
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMP_DIR = join(ROOT, 'wiki', 'comparative');
const DRY = process.argv.includes('--dry-run');
const FLAG = '**Comparison source:** AI-generated — non-Catholic positions not from the Compendium; pending review';

const hasFlag = (lines) =>
  lines.slice(0, 12).some((l) => /^\*\*Comparison source:\*\*/i.test(l));

let changed = 0, skipped = 0;
for (const name of readdirSync(COMP_DIR).filter((f) => f.endsWith('.md'))) {
  const path = join(COMP_DIR, name);
  const lines = readFileSync(path, 'utf8').split('\n');
  if (hasFlag(lines)) { skipped++; continue; }

  // Prefer inserting after the **Amharic:** title line; fall back to **Type:**.
  let idx = lines.findIndex((l) => /^\*\*Amharic:\*\*/i.test(l));
  if (idx < 0) idx = lines.findIndex((l) => /^\*\*Type:\*\*/i.test(l));
  if (idx < 0) { console.log(`SKIP  ${name} — no frontmatter anchor`); skipped++; continue; }

  lines.splice(idx + 1, 0, FLAG);
  console.log(`FLAG  ${name}`);
  if (!DRY) writeFileSync(path, lines.join('\n'));
  changed++;
}
console.log(`\n${DRY ? '[dry-run] ' : ''}flagged: ${changed}  skipped: ${skipped}`);
