#!/usr/bin/env node
/**
 * Add a `**Amharic:**` frontmatter title to comparative wiki pages that lack one.
 *
 * Source of truth for each topic's Amharic name: the page's paired teaching
 * page (`[[teaching/<slug>]]`), whose H1 carries the canonical Amharic name in
 * parentheses, e.g. `# Marriage (ተክሊል)`. We reuse the established comparison
 * suffix from baptism.md: `<topic>፦ ካቶሊክ እና ኦርቶዶክስ ተዋሕዶ`.
 *
 * Anything NOT sourced from an existing wiki page (i.e. an AI translation) is
 * marked with a `**Amharic source:** AI-translated …` line so it can be reviewed.
 *
 * Usage:
 *   node scripts/add_comparative_amharic_titles.mjs --dry-run   # preview only
 *   node scripts/add_comparative_amharic_titles.mjs             # apply
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMP_DIR = join(ROOT, 'wiki', 'comparative');
const TEACH_DIR = join(ROOT, 'wiki', 'teaching');
const SUFFIX = 'ካቶሊክ እና ኦርቶዶክስ ተዋሕዶ';
const DRY = process.argv.includes('--dry-run');

// Topics with no paired teaching page → AI-translated, flagged for review.
const AI_TOPICS = { 'gospel-and-culture': 'ወንጌልና ባህል' };

const parenAmharic = (file) => {
  try {
    const h1 = readFileSync(file, 'utf8').split('\n').find((l) => l.startsWith('# '));
    const m = h1 && h1.match(/\(([^)]+)\)/);
    return m ? m[1].trim() : null;
  } catch { return null; }
};

const hasAmharic = (body) =>
  body.split('\n').slice(0, 30).some((l) => /^\*\*Amharic:\*\*/i.test(l));

let changed = 0, skipped = 0;
for (const name of readdirSync(COMP_DIR).filter((f) => f.endsWith('.md'))) {
  const slug = name.replace(/\.md$/, '');
  const path = join(COMP_DIR, name);
  const body = readFileSync(path, 'utf8');
  if (hasAmharic(body)) { skipped++; continue; }

  let topic, isAI = false;
  if (AI_TOPICS[slug]) {
    topic = AI_TOPICS[slug];
    isAI = true;
  } else {
    // First [[teaching/<slug>]] link = the "Pairs with" target.
    const pair = (body.match(/teaching\/([a-z0-9-]+)/) || [])[1];
    topic = pair && parenAmharic(join(TEACH_DIR, `${pair}.md`));
    if (!topic) { console.log(`SKIP  ${slug} — no paired teaching Amharic found`); skipped++; continue; }
  }

  const title = `${topic}፦ ${SUFFIX}`;
  const lines = body.split('\n');
  // Insert right after the first **Type:** frontmatter line (kept inside the block).
  const typeIdx = lines.findIndex((l) => /^\*\*Type:\*\*/i.test(l));
  const at = typeIdx >= 0 ? typeIdx + 1 : 1;
  const insert = [`**Amharic:** ${title}`];
  if (isAI) insert.push(`**Amharic source:** AI-translated topic — needs review`);
  lines.splice(at, 0, ...insert);

  console.log(`${isAI ? 'AI  ' : 'OK  '} ${slug}  →  ${title}`);
  if (!DRY) writeFileSync(path, lines.join('\n'));
  changed++;
}
console.log(`\n${DRY ? '[dry-run] ' : ''}changed: ${changed}  skipped: ${skipped}`);
