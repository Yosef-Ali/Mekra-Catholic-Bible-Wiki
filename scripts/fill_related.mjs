#!/usr/bin/env node
// One-shot script: replace `**Related:** *(to be linked during future ingests)*`
// across teaching pages with topic-specific [[wiki-link]] lists; bump Last updated;
// drop the two stale "Synthesis section needs to be written" / "Related links need
// to be filled in" bullets in `## Open questions`. Validates that every link target
// actually exists on disk before writing.
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

let updated = 0, skipped = 0, missing = [];

for (const [slug, links] of Object.entries(RELATED)) {
  const file = join(ROOT, 'wiki', 'teaching', `${slug}.md`);
  if (!existsSync(file)) { skipped++; continue; }

  // Validate all link targets exist on disk
  for (const link of links) {
    const targetFile = join(ROOT, 'wiki', `${link}.md`);
    if (!existsSync(targetFile)) {
      missing.push(`${slug} → ${link}`);
    }
  }

  let body = readFileSync(file, 'utf8');
  let changed = false;

  // Replace Related: line
  const relatedLine = `**Related:** ${links.map((l) => `[[${l}]]`).join(', ')}`;
  const newBody = body.replace(/^\*\*Related:\*\*\s*\*\(to be linked during future ingests\)\*\s*$/m, relatedLine);
  if (newBody !== body) { body = newBody; changed = true; }

  // Bump Last updated
  const updatedLine = `**Last updated:** ${TODAY}`;
  const newBody2 = body.replace(/^\*\*Last updated:\*\*\s*[^\n]+$/m, updatedLine);
  if (newBody2 !== body) { body = newBody2; changed = true; }

  // Remove stale Open questions bullets
  for (const re of STALE_BULLETS) {
    const newBody3 = body.split('\n').filter((l) => !re.test(l)).join('\n');
    if (newBody3 !== body) { body = newBody3; changed = true; }
  }

  if (changed) {
    writeFileSync(file, body);
    updated++;
    console.log(`  ✓ ${slug}`);
  } else {
    skipped++;
  }
}

console.log(`\n📊 updated=${updated} skipped=${skipped}`);
if (missing.length) {
  console.log(`\n⚠️  Link targets that do not exist on disk:`);
  for (const m of missing) console.log(`  - ${m}`);
  process.exit(1);
}
