#!/usr/bin/env node
// Generate wiki/teaching/*.md pages from qa_index.json

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const VAULT = '/Users/mekdesyared/Mekra-Catholic-Bible-Wiki';
const QA_INDEX = path.join(VAULT, 'raw/catechism/qa_index.json');
const TEACHING = path.join(VAULT, 'wiki/teaching');
const TODAY = '2026-04-09';

const qaList = JSON.parse(await readFile(QA_INDEX, 'utf8'));
const qaMap = new Map(qaList.map(e => [e.q, e]));

// Missing Q numbers for tagging
const MISSING_QS = new Set([22]); // Q22 is the only genuinely missing Q (real Q22 was never scanned; the "22" in early extractions was actually Q122)

const PAGES = [
  // Part 1
  { slug: 'faith-and-revelation', title: 'Faith and Revelation', am: 'እምነትና መገለጥ', qRange: [1,25], part: 1, ccc: '1-141' },
  { slug: 'the-creed', title: 'The Creed', am: 'ጸሎተ ሃይማኖት', qRange: [26,35], part: 1, ccc: '185-197' },
  { slug: 'god-the-father-creator', title: 'God the Father, Creator', am: 'እግዚአብሔር አብ ፈጣሪ', qRange: [36,72], part: 1, ccc: '198-421' },
  { slug: 'man-and-the-fall', title: 'Man and the Fall', am: 'ሰውና የሰው ልጅ መውደቅ', qRange: [73,83], part: 1, ccc: '355-421' },
  { slug: 'jesus-christ-incarnation', title: 'Jesus Christ: Incarnation', am: 'ኢየሱስ ክርስቶስ፡ ሥጋ መልበስ', qRange: [84,104], part: 1, ccc: '422-570' },
  { slug: 'passion-death-resurrection', title: 'Passion, Death, and Resurrection', am: 'ሕማም ሞትና ትንሣኤ', qRange: [105,131], part: 1, ccc: '571-682' },
  { slug: 'ascension-and-judgment', title: 'Ascension and Judgment', am: 'ዕርገትና ፍርድ', qRange: [132,135], part: 1, ccc: '659-682' },
  { slug: 'holy-spirit', title: 'The Holy Spirit', am: 'መንፈስ ቅዱስ', qRange: [136,146], part: 1, ccc: '683-747' },
  { slug: 'the-church', title: 'The Church', am: 'ቤተክርስቲያን', qRange: [147,193], part: 1, ccc: '748-975' },
  { slug: 'mary', title: 'Mary, Mother of God and the Church', am: 'ማርያም የእግዚአብሔርና የቤተክርስቲያን እናት', qRange: [194,199], part: 1, ccc: '484-511, 963-975' },
  { slug: 'forgiveness-resurrection-eternal-life', title: 'Forgiveness, Resurrection, Eternal Life', am: 'ይቅርታ ትንሣኤ ዘላለማዊ ሕይወት', qRange: [200,217], part: 1, ccc: '976-1065' },
  // Part 2
  { slug: 'sacramental-order', title: 'The Sacramental Order', am: 'የምሥጢራት ሥርዓት', qRange: [218,249], part: 2, ccc: '1066-1209' },
  { slug: 'baptism', title: 'Baptism', am: 'ጥምቀት', qRange: [250,264], part: 2, ccc: '1213-1284' },
  { slug: 'confirmation', title: 'Confirmation', am: 'ሜሮን', qRange: [265,270], part: 2, ccc: '1285-1321' },
  { slug: 'eucharist', title: 'The Eucharist', am: 'ቁርባን', qRange: [271,294], part: 2, ccc: '1322-1419' },
  { slug: 'penance', title: 'Penance and Reconciliation', am: 'ንስሐና ዕርቅ', qRange: [295,312], part: 2, ccc: '1420-1498' },
  { slug: 'anointing-of-the-sick', title: 'Anointing of the Sick', am: 'የሕሙማን ቅባት', qRange: [313,320], part: 2, ccc: '1499-1532' },
  { slug: 'holy-orders', title: 'Holy Orders', am: 'ክህነት', qRange: [321,336], part: 2, ccc: '1533-1600' },
  { slug: 'marriage', title: 'Marriage', am: 'ተክሊል', qRange: [337,350], part: 2, ccc: '1601-1666' },
  { slug: 'sacramentals-and-funerals', title: 'Sacramentals and Funerals', am: 'ምሥጢራዊ ምልክቶችና ሥርዓተ ቀብር', qRange: [351,356], part: 2, ccc: '1667-1690' },
  // Part 3
  { slug: 'human-dignity', title: 'Human Dignity', am: 'የሰው ክብር', qRange: [357,378], part: 3, ccc: '1691-1775' },
  { slug: 'morality-and-conscience', title: 'Morality and Conscience', am: 'ግብረ ገብነትና ኅሊና', qRange: [379,400], part: 3, ccc: '1749-1802' },
  { slug: 'virtues', title: 'Virtues', am: 'በጎ ምግባራት', qRange: [401,420], part: 3, ccc: '1803-1845' },
  { slug: 'sin', title: 'Sin', am: 'ኃጢአት', qRange: [421,432], part: 3, ccc: '1846-1876' },
  { slug: 'society-and-justice', title: 'Society and Justice', am: 'ማህበረሰብና ፍትሕ', qRange: [433,455], part: 3, ccc: '1877-1948' },
  { slug: 'moral-law-and-grace', title: 'Moral Law and Grace', am: 'የሞራል ሕግና ጸጋ', qRange: [456,484], part: 3, ccc: '1949-2051' },
  { slug: 'first-three-commandments', title: 'First Three Commandments', am: 'ሦስቱ የመጀመሪያ ትእዛዛት', qRange: [485,502], part: 3, ccc: '2052-2195' },
  { slug: 'fourth-commandment', title: 'Fourth Commandment', am: 'አራተኛይቱ ትእዛዝ', qRange: [503,509], part: 3, ccc: '2196-2257' },
  { slug: 'fifth-commandment', title: 'Fifth Commandment', am: 'አምስተኛይቱ ትእዛዝ', qRange: [510,518], part: 3, ccc: '2258-2330' },
  { slug: 'sixth-and-ninth-commandments', title: 'Sixth and Ninth Commandments', am: 'ስድስተኛይቱና ዘጠነኛይቱ ትእዛዛት', qRange: [519,528], part: 3, ccc: '2331-2400, 2514-2533' },
  { slug: 'seventh-and-tenth-commandments', title: 'Seventh and Tenth Commandments', am: 'ሰባተኛይቱና አሥረኛይቱ ትእዛዛት', qRange: [529,537], part: 3, ccc: '2401-2463, 2534-2557' },
  { slug: 'eighth-commandment', title: 'Eighth Commandment', am: 'ስምንተኛይቱ ትእዛዝ', qRange: [538,543], part: 3, ccc: '2464-2513' },
  // Part 4
  { slug: 'prayer-in-christian-life', title: 'Prayer in Christian Life', am: 'ጸሎት በክርስቲያን ሕይወት', qRange: [544,568], part: 4, ccc: '2558-2758' },
  { slug: 'prayer-combat', title: 'The Combat of Prayer', am: 'የጸሎት ውጊያ', qRange: [569,577], part: 4, ccc: '2725-2758' },
  { slug: 'the-lords-prayer', title: "The Lord's Prayer", am: 'የጌታ ጸሎት', qRange: [578,598], part: 4, ccc: '2759-2865' },
];

const PART_NAMES = {
  1: 'ክፍል ፩ — የእምነት ምስክርነት (Profession of Faith)',
  2: 'ክፍል ፪ — የክርስቶሳዊ ምስጢር አከባበር (Celebration of the Christian Mystery)',
  3: 'ክፍል ፫ — ሕይወት በክርስቶስ (Life in Christ)',
  4: 'ክፍል ፬ — ክርስቲያናዊ ጸሎት (Christian Prayer)',
};

await mkdir(TEACHING, { recursive: true });

let totalWritten = 0;
for (const page of PAGES) {
  const [qMin, qMax] = page.qRange;
  const items = [];
  const missingItems = [];
  for (let q = qMin; q <= qMax; q++) {
    if (MISSING_QS.has(q)) {
      missingItems.push(q);
    } else if (qaMap.has(q)) {
      items.push(qaMap.get(q));
    }
  }

  // Collect unique sources
  const sources = [...new Set(items.map(i => i.source))];

  let md = `# ${page.title} (${page.am})

**Type:** teaching
**Amharic:** ${page.am}
**Part:** ${PART_NAMES[page.part]}
**Compendium Q:** ${qMin}–${qMax}
**CCC:** ${page.ccc}
**Sources:** ${sources.length}
**Last updated:** ${TODAY}
**Related:** *(to be linked during future ingests)*

## Synthesis

*(Synthesis to be written after all teaching pages are seeded and cross-referenced.)*

## Compendium Q&A

`;

  for (const item of items) {
    const qLine = `### Q${item.q}`;
    const question = item.question || '[question text not extracted]';
    const answer = item.answer || '[answer text not extracted]';
    md += `${qLine}\n\n`;
    md += `**Q:** ${question}\n\n`;
    md += `**A:** ${answer}\n\n`;
    if (item.ccc.length) {
      md += `[CCC ${item.ccc.join(', ')}]\n\n`;
    }
  }

  if (missingItems.length) {
    md += `### Missing Q&As\n\n`;
    for (const q of missingItems) {
      md += `- **Q${q}** — [OCR-gap] Not yet extracted. May be on a missing scan page or OCR did not capture this question.\n`;
    }
    md += '\n';
  }

  md += `## Scripture\n\n*(To be populated during Bible ingest.)*\n\n`;
  md += `## Open questions\n\n`;
  if (missingItems.length) {
    md += `- Q&As ${missingItems.join(', ')} are missing — check if rescans cover them.\n`;
  }
  md += `- Synthesis section needs to be written.\n`;
  md += `- Related links need to be filled in.\n\n`;

  md += `## Sources\n\n`;
  for (const src of sources) {
    md += `- \`raw/catechism/extracted/${src}\`\n`;
  }
  md += '\n';

  const outPath = path.join(TEACHING, `${page.slug}.md`);
  await writeFile(outPath, md);
  totalWritten++;
}

console.log(`Wrote ${totalWritten} teaching pages to wiki/teaching/`);
