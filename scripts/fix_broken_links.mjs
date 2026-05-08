#!/usr/bin/env node
// One-shot: clear all 41 broken [[wikilinks]] in wiki/.
//   Phase 1 — alias rewrites (typos, hyphen↔space, redundant concept→teaching redirects)
//   Phase 2 — strip [[themes/]] brackets in Bible "Open questions" prose (never meant to navigate)
//   Phase 3 — create stub pages for genuinely new concepts/figures
//   Phase 4 — re-scan and report remaining broken links

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WIKI = join(ROOT, 'wiki');
const TODAY = '2026-05-08';

const ALIASES = {
  'figures/ኢየሱስ': 'figures/ኢየሱስ-ክርስቶስ',
  'concepts/ቅድስት-ሥላሴ': 'concepts/ቅድስት ሥላሴ',
  'concepts/ሥላሴ': 'concepts/ቅድስት ሥላሴ',
  'concepts/ኪዳን': 'concepts/ቃል ኪዳን',
  'figures/ዮሐንስ-መጥምቅ': 'figures/ዮሐንስ-መጥምቁ',
  'concepts/ድኅነት': 'concepts/ደኅንነት',
  'concepts/መንፈስ ቅዱስ': 'teaching/holy-spirit',
  'concepts/መንፈስ-ቅዱስ': 'teaching/holy-spirit',
  'concepts/ቊርባን': 'teaching/eucharist',
  'concepts/ቤተክርስቲያን': 'teaching/the-church',
  'concepts/ጥምቀት': 'teaching/baptism',
  'concepts/ክርስቶስ': 'figures/ኢየሱስ-ክርስቶስ',
  'concepts/ሕሊና': 'concepts/ኅሊና',
  'concepts/ዘላለማዊ-ሕይወት': 'concepts/ዘላለማዊ ሕይወት',
  'teaching/the-mass': 'teaching/eucharist',
  'concepts/ክህነት': 'teaching/holy-orders',
  'concepts/ቅዱስ-መጽሐፍ': 'teaching/faith-and-revelation',
  'teaching/scripture-and-tradition': 'teaching/faith-and-revelation',
  'teaching/the-canon': 'teaching/faith-and-revelation',
  'concepts/ነፃ-ፈቃድ': 'concepts/ነፃነት',
  'concepts/የመጀመሪያ-ኃጢአት': 'concepts/ኃጢአት',
  'concepts/አንድነት': 'concepts/ሕብረት',
  'concepts/ጸጸት': 'concepts/ንስሐ',
  'teaching/social-doctrine': 'teaching/society-and-justice',
};

// Each stub: { slug, title, type ('concept'|'figure'), english, brief }
const STUBS = [
  ['concepts/ንጽሕና',          'ንጽሕና (Purity)',                  'concept', 'Purity',                       'Moral and spiritual purity; chastity of heart and body.'],
  ['concepts/መስዋዕት',          'መስዋዕት (Sacrifice)',              'concept', 'Sacrifice',                    "Christ's self-offering on the cross and the Eucharistic sacrifice."],
  ['concepts/ቅዱሳን-ሱታፌ',      'ቅዱሳን ሱታፌ (Communion of Saints)', 'concept', 'Communion of Saints',          'The unity of all the faithful — on earth, in purgation, and in glory.'],
  ['concepts/ድል',             'ድል (Victory)',                    'concept', 'Victory',                      "Christ's victory over sin and death; the Christian's share in it."],
  ['figures/መላእክት',           'መላእክት (Angels)',                  'figure',  'Angels',                       'Spiritual beings created by God to serve and worship him and to assist humanity.'],
  ['concepts/ትሕትና',           'ትሕትና (Humility)',                'concept', 'Humility',                     'The truthful self-knowledge before God that is the foundation of every virtue.'],
  ['concepts/እውነት',           'እውነት (Truth)',                    'concept', 'Truth',                        'God as truth itself; the obligation to live and speak truthfully.'],
  ['concepts/ራእይ',            'ራእይ (Revelation)',                'concept', 'Revelation',                   "God's self-disclosure to humanity, culminating in Christ."],
  ['concepts/ሰንበት',           'ሰንበት (Sabbath / Lord\'s Day)',    'concept', "Sabbath / Lord's Day",         "The day of rest and worship; the Christian Sunday as the new Sabbath."],
  ['concepts/የእግዚአብሔር ስም',    'የእግዚአብሔር ስም (The Name of God)',  'concept', 'The Name of God',              'The reverence due to the divine name; the prohibition against taking it in vain.'],
  ['concepts/መንጻት',           'መንጻት (Purification)',             'concept', 'Purification',                 "Purgatory and the soul's final purification before entering heaven."],
  ['concepts/ቤተሰብ',           'ቤተሰብ (Family)',                  'concept', 'Family',                       'The domestic church; the family as the basic cell of society and the Church.'],
  ['concepts/መለኮታዊ-ክብካቤ',   'መለኮታዊ ክብካቤ (Divine Providence)', 'concept', 'Divine Providence',           "God's loving care that guides creation toward its ultimate fulfillment."],
  ['concepts/ፍትሕ',            'ፍትሕ (Justice)',                   'concept', 'Justice',                      'The cardinal virtue of giving each their due; social justice as its expression.'],
  ['concepts/የጋራ-ጥቅም',        'የጋራ ጥቅም (Common Good)',          'concept', 'Common Good',                  'The conditions of social life that enable groups and individuals to flourish.'],
  ['concepts/የተፈጥሮ-ሕግ',       'የተፈጥሮ ሕግ (Natural Law)',         'concept', 'Natural Law',                  "The moral order written by God in the human heart, knowable by reason."],
];

function buildStub({ title, type, english, brief }) {
  const folder = type === 'figure' ? 'figures' : 'concepts';
  return `# ${title}

**Type:** ${type}
**English:** ${english}
**Status:** stub
**Last updated:** ${TODAY}

## Synthesis

${brief}

*(This page is a stub created to resolve incoming wiki links. Expand with Compendium citations, Scripture, and cross-references as the wiki grows.)*

## Open questions

- Which Compendium Q&As reference this term and how is it framed there?
- What does the Ethiopian tradition (Tewahedo and Catholic) bring to this concept?
- Cross-link to relevant teaching pages once content is written.

## Sources

*(To be populated as content is added.)*
`;
}

// --- Walk wiki/ ---
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

const files = walk(WIKI);

// --- Phase 1: alias rewrites ---
let aliasReplacements = 0;
const aliasFiles = new Set();
for (const file of files) {
  let body = readFileSync(file, 'utf8');
  let local = 0;
  for (const [from, to] of Object.entries(ALIASES)) {
    // Match [[from]] or [[from|alias]] — preserve display alias if present
    const re = new RegExp(`\\[\\[${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\|[^\\]]+)?\\]\\]`, 'g');
    const next = body.replace(re, (_, alias) => `[[${to}${alias ?? ''}]]`);
    if (next !== body) { local += (body.match(re) || []).length; body = next; }
  }
  if (local) {
    writeFileSync(file, body);
    aliasReplacements += local;
    aliasFiles.add(file);
  }
}

// --- Phase 2: strip [[themes/]] brackets ---
let themesStripped = 0;
const themesFiles = new Set();
for (const file of files) {
  const body = readFileSync(file, 'utf8');
  // [[themes/]] and [[teaching/]] bare folder placeholders → strip brackets (never meant to navigate)
  const re = /\[\[(themes|teaching)\/(\|([^\]]+))?\]\]/g;
  const matches = body.match(re) || [];
  const next = body.replace(re, (_, folder, _alias, display) => display ?? `${folder}/`);
  if (next !== body) {
    writeFileSync(file, next);
    themesStripped += matches.length;
    themesFiles.add(file);
  }
}

// --- Phase 3: create stubs ---
let stubsCreated = 0, stubsSkipped = 0;
for (const [slug, title, type, english, brief] of STUBS) {
  const target = join(WIKI, `${slug}.md`);
  if (existsSync(target)) { stubsSkipped++; continue; }
  writeFileSync(target, buildStub({ title, type, english, brief }));
  stubsCreated++;
}

// --- Phase 4: rescan ---
const remaining = new Map();
for (const file of walk(WIKI)) {
  const txt = readFileSync(file, 'utf8');
  for (const m of txt.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
    const link = m[1].trim();
    if (link.startsWith('http') || link.startsWith('#')) continue;
    if (!existsSync(join(WIKI, `${link}.md`))) {
      if (!remaining.has(link)) remaining.set(link, 0);
      remaining.set(link, remaining.get(link) + 1);
    }
  }
}

console.log(`📊 Phase 1 (aliases):     ${aliasReplacements} link(s) rewritten across ${aliasFiles.size} file(s)`);
console.log(`📊 Phase 2 (themes/):     ${themesStripped} bracket(s) stripped across ${themesFiles.size} file(s)`);
console.log(`📊 Phase 3 (stubs):       ${stubsCreated} created, ${stubsSkipped} already existed`);
console.log(`📊 Phase 4 (remaining):   ${remaining.size} unique broken target(s)`);
if (remaining.size) {
  for (const [l, n] of [...remaining].sort((a,b) => b[1] - a[1])) {
    console.log(`  - ${n}× ${l}`);
  }
  process.exit(1);
}
console.log(`✅ All wiki links resolve.`);
