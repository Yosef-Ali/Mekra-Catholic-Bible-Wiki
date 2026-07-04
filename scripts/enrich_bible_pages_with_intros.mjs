#!/usr/bin/env node
/**
 * enrich_bible_pages_with_intros.mjs — add the printed book introduction
 * (from raw/bible/intros/) into each wiki/bible/<Book>.md synthesis page.
 *
 * Inserts (or, on re-run, replaces in place) a section right after
 * "## Overview":
 *
 *   ## መግቢያ (ከኤማሁስ ኅትመት)
 *
 *   > [intro prose verbatim]
 *   — Emmaus PDF p. NNN
 *
 *   **አጠቃላይ የመጽሐፉ ይዘት:**
 *   - [outline item]
 *   ...
 *
 * Idempotent: if the section already exists, its content is replaced and
 * **Sources:** is NOT re-bumped. On first insert, **Sources:** is bumped by
 * 1 and **Last updated:** is set to today. Matching between the two folders
 * uses the intro file's own **Book:** field (the canonical DB name), not
 * filename guessing — raw/bible/intros/ uses "NN-Book_With_Underscores.md",
 * wiki/bible/ uses "BookNoSpaces.md".
 *
 * Usage:
 *   node scripts/enrich_bible_pages_with_intros.mjs           # dry-run
 *   node scripts/enrich_bible_pages_with_intros.mjs --apply   # write
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const INTROS_DIR = '/Users/mekdesyared/Mekra-Catholic-Bible-Wiki/raw/bible/intros';
const WIKI_DIR = '/Users/mekdesyared/Mekra-Catholic-Bible-Wiki/wiki/bible';
const APPLY = process.argv.includes('--apply');
const SECTION_HEADING = '## መግቢያ (ከኤማሁስ ኅትመት)';
const today = new Date().toISOString().slice(0, 10);

function parseIntroFile(path) {
  const src = readFileSync(path, 'utf8');
  const book = (src.match(/^\*\*Book:\*\* (.+)$/m) ?? [])[1];
  const sourcePage = (src.match(/^\*\*Source:\*\* Emmaus PDF p\. (\d+)/m) ?? [])[1];
  const introM = src.match(/^## መግቢያ\s*\n+([\s\S]+?)(?=\n## |\n*$)/m);
  const introduction = introM ? introM[1].trim() : null;
  const outlineM = src.match(/^## (?!መግቢያ)(.+)\n+([\s\S]+)/m);
  let outline = [];
  if (outlineM) {
    outline = outlineM[2].split('\n').map(l => l.replace(/^- /, '').trim()).filter(Boolean);
  }
  return { book, sourcePage, introduction, outline };
}

function buildSection({ introduction, outline, sourcePage }) {
  const lines = [SECTION_HEADING, ''];
  for (const para of introduction.split(/\n{2,}/)) {
    lines.push(`> ${para.replace(/\n/g, ' ')}`);
    lines.push('');
  }
  lines[lines.length - 1] = `— Emmaus PDF p. ${sourcePage}`;
  if (outline.length) {
    lines.push('', '**አጠቃላይ የመጽሐፉ ይዘት:**');
    for (const item of outline) lines.push(`- ${item}`);
  }
  return lines.join('\n');
}

// find [start, end) of a "## Heading" section's own span, i.e. from the start
// of its heading line up to (not including) the next "^## " heading or EOF.
// Index-based, not regex-lookahead-based, so there is no risk of a `$`/`m`
// flag interaction stopping the match early at an internal blank line.
function findSectionSpan(src, headingLine) {
  const start = src.indexOf(headingLine);
  if (start === -1) return null;
  const afterHeadingIdx = start + headingLine.length;
  const rest = src.slice(afterHeadingIdx);
  const nextHeadingRel = rest.search(/\n## /);
  const end = nextHeadingRel === -1 ? src.length : afterHeadingIdx + nextHeadingRel + 1; // +1 keeps the \n as separator, excluded from replacement
  return [start, end];
}

// join a [pre, sectionText, post] triple with correct blank-line spacing:
// `pre` (up to and including any preceding blank line) is left untouched,
// `post` starts directly at the next "## " heading (no leading newline —
// findSectionSpan's `end` consumes it) so exactly one blank line is added
// before it; if `post` is empty (this was the last section), no trailing
// blank line is added.
function joinWithSection(pre, sectionText, post) {
  return post.length === 0 ? pre + sectionText + '\n' : pre + sectionText + '\n\n' + post;
}

// insert/replace SECTION after "## Overview"'s content, before the next "## " heading
function applySection(pageSrc, sectionText) {
  const alreadyPresent = pageSrc.includes(SECTION_HEADING);
  let newSrc;
  if (alreadyPresent) {
    const span = findSectionSpan(pageSrc, SECTION_HEADING);
    if (!span) return null;
    const [start, end] = span;
    newSrc = joinWithSection(pageSrc.slice(0, start), sectionText, pageSrc.slice(end));
  } else {
    const span = findSectionSpan(pageSrc, '## Overview');
    if (!span) return null; // no Overview section — skip, don't guess where to insert
    const [, end] = span; // end = index right after Overview's content (before next \n## )
    newSrc = joinWithSection(pageSrc.slice(0, end), sectionText, pageSrc.slice(end));
  }
  return { newSrc, alreadyPresent };
}

function bumpFrontmatter(src) {
  src = src.replace(/(\*\*Sources:\*\*\s*)(\d+)/, (_, pre, n) => `${pre}${parseInt(n, 10) + 1}`);
  src = src.replace(/(\*\*Last updated:\*\*\s*)\d{4}-\d{2}-\d{2}/, `$1${today}`);
  return src;
}

const introFiles = readdirSync(INTROS_DIR).filter(f => f.endsWith('.md')).sort();
let updated = 0, replaced = 0, skippedNoWikiPage = 0, skippedNoOverview = 0, skippedNoIntro = 0;
const problems = [];

for (const f of introFiles) {
  const parsed = parseIntroFile(`${INTROS_DIR}/${f}`);
  if (!parsed.book || !parsed.introduction || !parsed.sourcePage) {
    problems.push(`${f}: could not parse book/introduction/sourcePage`);
    skippedNoIntro++;
    continue;
  }
  const wikiFile = `${WIKI_DIR}/${parsed.book.replace(/\s+/g, '')}.md`;
  if (!existsSync(wikiFile)) {
    problems.push(`${f}: no wiki page at ${wikiFile}`);
    skippedNoWikiPage++;
    continue;
  }
  const pageSrc = readFileSync(wikiFile, 'utf8');
  const sectionText = buildSection(parsed);
  const result = applySection(pageSrc, sectionText);
  if (!result) {
    problems.push(`${wikiFile}: no "## Overview" section found — skipped`);
    skippedNoOverview++;
    continue;
  }
  let { newSrc, alreadyPresent } = result;
  if (!alreadyPresent) newSrc = bumpFrontmatter(newSrc);
  else newSrc = newSrc.replace(/(\*\*Last updated:\*\*\s*)\d{4}-\d{2}-\d{2}/, `$1${today}`);

  if (APPLY) writeFileSync(wikiFile, newSrc);
  updated++;
  if (alreadyPresent) replaced++;
}

console.log(`${APPLY ? 'APPLIED' : 'DRY-RUN'}: ${updated} pages ${APPLY ? 'updated' : 'would update'} (${replaced} were re-runs replacing an existing section)`);
console.log(`skipped: no-wiki-page=${skippedNoWikiPage}, no-Overview=${skippedNoOverview}, no-intro-parsed=${skippedNoIntro}`);
if (problems.length) { console.log('\nproblems:'); for (const p of problems) console.log('  ' + p); }

if (APPLY && updated > 0) {
  console.log('\nRun `npm run sync` next to push these pages to the app DB.');
}
