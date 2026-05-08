#!/usr/bin/env node
// One-shot script: replace `**Related:** *(to be linked during future ingests)*`
// across teaching pages with topic-specific [[wiki-link]] lists; bump Last updated;
// drop the two stale "Synthesis section needs to be written" / "Related links need
// to be filled in" bullets in `## Open questions`. Validates every link target
// across every file BEFORE writing — aborts without mutating if any are missing.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TODAY = '2026-05-08';

const RELATED = {
  'anointing-of-the-sick': ['teaching/penance', 'teaching/eucharist', 'teaching/holy-orders', 'concepts/ምሕረት', 'concepts/ሞት'],
  'ascension-and-judgment': ['teaching/passion-death-resurrection', 'teaching/jesus-christ-incarnation', 'concepts/ዘላለማዊ ሕይወት', 'concepts/ትንሣኤ', 'concepts/ፍርድ'],
  'confirmation': ['teaching/baptism', 'teaching/eucharist', 'teaching/holy-spirit', 'concepts/ጸጋ'],
  'eucharist': ['teaching/baptism', 'teaching/confirmation', 'teaching/passion-death-resurrection', 'teaching/holy-orders', 'concepts/ሕብረት', 'concepts/ቤዛ'],
  'faith-and-revelation': ['teaching/the-creed', 'concepts/እምነት'],
  'first-three-commandments': ['teaching/the-creed', 'teaching/prayer-in-christian-life', 'concepts/አምልኮ'],
  'forgiveness-resurrection-eternal-life': ['teaching/penance', 'teaching/passion-death-resurrection', 'teaching/ascension-and-judgment', 'concepts/ይቅርታ', 'concepts/ትንሣኤ', 'concepts/ዘላለማዊ ሕይወት'],
  'god-the-father-creator': ['teaching/the-creed', 'teaching/jesus-christ-incarnation', 'teaching/holy-spirit', 'concepts/ቅድስት ሥላሴ', 'concepts/ፍጥረት'],
  'holy-orders': ['teaching/eucharist', 'teaching/the-church', 'teaching/marriage', 'concepts/ሕብረት'],
  'holy-spirit': ['teaching/the-creed', 'teaching/confirmation', 'teaching/the-church', 'concepts/ቅድስት ሥላሴ'],
  'human-dignity': ['teaching/morality-and-conscience', 'teaching/society-and-justice', 'concepts/ኅሊና', 'concepts/ነፃነት', 'concepts/ክብር'],
  'jesus-christ-incarnation': ['teaching/the-creed', 'teaching/passion-death-resurrection', 'teaching/mary', 'figures/ኢየሱስ-ክርስቶስ', 'figures/ማርያም'],
  'man-and-the-fall': ['teaching/sin', 'teaching/jesus-christ-incarnation', 'teaching/baptism', 'concepts/ኃጢአት', 'concepts/ፍጥረት', 'figures/አዳም', 'figures/ሔዋን'],
  'marriage': ['teaching/sixth-and-ninth-commandments', 'teaching/holy-orders', 'teaching/the-church', 'concepts/ፍቅር', 'concepts/ቃል ኪዳን'],
  'mary': ['teaching/jesus-christ-incarnation', 'teaching/the-church', 'apologetics/mary-veneration', 'figures/ማርያም', 'concepts/ጸጋ'],
  'passion-death-resurrection': ['teaching/jesus-christ-incarnation', 'teaching/eucharist', 'teaching/ascension-and-judgment', 'concepts/ቤዛ', 'concepts/ትንሣኤ'],
  'penance': ['teaching/baptism', 'teaching/sin', 'teaching/eucharist', 'apologetics/confession-to-priest', 'concepts/ንስሐ', 'concepts/ይቅርታ', 'concepts/ምሕረት'],
  'prayer-combat': ['teaching/prayer-in-christian-life', 'teaching/the-lords-prayer', 'concepts/ጸሎት'],
  'prayer-in-christian-life': ['teaching/the-lords-prayer', 'teaching/prayer-combat', 'concepts/ጸሎት', 'concepts/አምልኮ'],
  'sacramental-order': ['teaching/baptism', 'teaching/confirmation', 'teaching/eucharist', 'teaching/penance', 'teaching/anointing-of-the-sick', 'teaching/holy-orders', 'teaching/marriage', 'concepts/ምሥጢር'],
  'sacramentals-and-funerals': ['teaching/baptism', 'teaching/anointing-of-the-sick', 'concepts/ሞት', 'concepts/ትንሣኤ'],
  'society-and-justice': ['teaching/human-dignity', 'teaching/seventh-and-tenth-commandments', 'teaching/morality-and-conscience', 'concepts/ጽድቅ'],
  'the-church': ['teaching/holy-spirit', 'teaching/the-creed', 'teaching/holy-orders', 'teaching/eucharist', 'apologetics/pope-primacy', 'concepts/ሕብረት'],
  'the-creed': ['teaching/faith-and-revelation', 'teaching/god-the-father-creator', 'teaching/jesus-christ-incarnation', 'teaching/holy-spirit', 'concepts/እምነት'],
  'the-lords-prayer': ['teaching/prayer-in-christian-life', 'teaching/prayer-combat', 'concepts/ጸሎት', 'figures/ኢየሱስ-ክርስቶስ'],
  'virtues': ['teaching/morality-and-conscience', 'teaching/society-and-justice', 'teaching/moral-law-and-grace', 'concepts/ጸጋ', 'concepts/ፍቅር'],
};

const STALE_BULLETS = [
  /^\s*-\s+Synthesis section needs to be written\.?\s*$/,
  /^\s*-\s+Related links need to be filled in\.?\s*$/,
];

// --- Phase 1: validate every link target across every file before mutating anything.
const missing = [];
const fileNotFound = [];
for (const [slug, links] of Object.entries(RELATED)) {
  const file = join(ROOT, 'wiki', 'teaching', `${slug}.md`);
  if (!existsSync(file)) {
    fileNotFound.push(slug);
    continue;
  }
  for (const link of links) {
    if (!existsSync(join(ROOT, 'wiki', `${link}.md`))) {
      missing.push(`${slug} → ${link}`);
    }
  }
}

if (missing.length) {
  console.error(`\n⚠️  Aborting — link targets do not exist on disk:`);
  for (const m of missing) console.error(`  - ${m}`);
  process.exit(1);
}

// --- Phase 2: apply transforms. Safe to mutate now.
let updated = 0, unchanged = 0;

for (const [slug, links] of Object.entries(RELATED)) {
  if (fileNotFound.includes(slug)) continue;
  const file = join(ROOT, 'wiki', 'teaching', `${slug}.md`);
  const original = readFileSync(file, 'utf8');

  const relatedLine = `**Related:** ${links.map((l) => `[[${l}]]`).join(', ')}`;
  let body = original
    .replace(/^\*\*Related:\*\*\s*\*\(to be linked during future ingests\)\*\s*$/m, relatedLine)
    .replace(/^\*\*Last updated:\*\*\s*[^\n]+$/m, `**Last updated:** ${TODAY}`);

  body = body.split('\n').filter((l) => !STALE_BULLETS.some((re) => re.test(l))).join('\n');

  if (body !== original) {
    writeFileSync(file, body);
    updated++;
    console.log(`  ✓ ${slug}`);
  } else {
    unchanged++;
  }
}

console.log(`\n📊 updated=${updated} unchanged=${unchanged} not-found=${fileNotFound.length}`);
if (fileNotFound.length) {
  console.log(`Files not found: ${fileNotFound.join(', ')}`);
}
