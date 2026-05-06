#!/usr/bin/env node
// Generate wiki/concepts/, wiki/figures/, and wiki/glossary/ pages

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const VAULT = '/Users/mekdesyared/Mekra-Catholic-Bible-Wiki';
const TODAY = '2026-04-09';

const concepts = [
  { am: "ጸጋ", en: "Grace", qs: "25, 28, 30, 73, 79, 97, 100, 131, 142, 160, 171, 195, 224, 250, 384, 386, 422–424" },
  { am: "እምነት", en: "Faith", qs: "25–35, 386, 442" },
  { am: "ኃጢአት", en: "Sin", qs: "73, 75–78, 96, 105, 291, 295, 391–396, 421–432" },
  { am: "ቅድስት ሥላሴ", en: "Holy Trinity", qs: "44–49, 83, 110, 130, 136–138, 144–145, 161" },
  { am: "ምሥጢር", en: "Sacrament", qs: "224, 226, 231–232, 247, 250–252, 261, 266, 269–270, 295–296, 321" },
  { am: "ደኅንነት", en: "Salvation", qs: "9, 17, 28, 51, 58, 65, 97, 119, 165, 261, 295, 422" },
  { am: "ጸሎት", en: "Prayer", qs: "534–538, 547–548, 553, 558, 567–568, 578–580" },
  { am: "ፍቅር", en: "Love / Charity", qs: "22, 42, 51, 54, 85, 93, 100, 118–119, 145, 156, 384, 386, 388, 442" },
  { am: "ተስፋ", en: "Hope", qs: "80, 102–103, 131–132, 193, 197, 216, 227, 232, 384, 386, 442" },
  { am: "ትንሣኤ", en: "Resurrection", qs: "109–112, 126–131, 143, 149, 271" },
  { am: "ቃል ኪዳን", en: "Covenant", qs: "8–9, 51, 340, 344, 346, 396, 436–437, 538" },
  { am: "ኅሊና", en: "Conscience", qs: "372–376, 398, 406" },
  { am: "ነፃነት", en: "Freedom", qs: "363–365, 410, 420, 425, 444, 505, 515" },
  { am: "ብፅዕና", en: "Beatitude", qs: "358–360, 415, 520, 533" },
  { am: "ፍጥረት", en: "Creation", qs: "51–53, 62–67" },
  { am: "ክብር", en: "Dignity", qs: "2, 43, 53, 55, 66, 69, 71, 83–84, 103, 112, 358" },
  { am: "ፍርድ", en: "Judgment", qs: "134, 204–205, 208, 214–216, 372, 596" },
  { am: "ጽድቅ", en: "Justification", qs: "72, 76, 188, 263, 307, 363, 422, 427" },
  { am: "ዘላለማዊ ሕይወት", en: "Eternal Life", qs: "1, 9, 36, 42, 50, 68, 70, 83, 90, 94, 149, 158, 207" },
  { am: "አምልኮ", en: "Worship", qs: "218–220, 232, 234, 243, 245, 430, 432, 446" },
];

const figures = [
  { am: "ኢየሱስ ክርስቶስ", en: "Jesus Christ", file: "ኢየሱስ-ክርስቶስ", role: "Son of God, Savior, central figure of the faith" },
  { am: "ድንግል ማርያም", en: "Virgin Mary", file: "ማርያም", role: "Mother of God (Theotokos), model of faith and obedience" },
  { am: "ጴጥሮስ", en: "Peter", file: "ጴጥሮስ", role: "Chief Apostle, first Pope, foundation of the Church" },
  { am: "አብርሃም", en: "Abraham", file: "አብርሃም", role: "Father of faith, patriarch of Israel" },
  { am: "ሙሴ", en: "Moses", file: "ሙሴ", role: "Lawgiver, mediator of the Sinai covenant" },
  { am: "ዳዊት", en: "David", file: "ዳዊት", role: "King of Israel, ancestor of the Messiah, psalmist" },
  { am: "አዳም", en: "Adam", file: "አዳም", role: "First human, through whom original sin entered" },
  { am: "ሔዋን", en: "Eve", file: "ሔዋን", role: "First woman, involved in the Fall" },
  { am: "ዮሐንስ መጥምቁ", en: "John the Baptist", file: "ዮሐንስ-መጥምቁ", role: "Forerunner of Christ, prophet" },
  { am: "ቅዱስ አጎስጢኖስ", en: "Augustine", file: "Augustine", role: "Church Father, theologian, frequently cited authority" },
  { am: "ቅዱስ ቶማስ", en: "Thomas Aquinas", file: "Thomas-Aquinas", role: "Doctor of the Church, theologian" },
  { am: "ኖህ", en: "Noah", file: "ኖህ", role: "Patriarch, covenant recipient after the flood" },
  { am: "ዮሴፍ", en: "Joseph", file: "ዮሴፍ", role: "Spouse of Mary, foster father of Jesus" },
  { am: "ኤልያስ", en: "Elijah", file: "ኤልያስ", role: "Prophet, prefiguring the Messiah" },
  { am: "ጳውሎስ", en: "Paul", file: "ጳውሎስ", role: "Apostle to the Gentiles, author of Epistles" },
];

const glossary = [
  { am: "ጥምቀት", en: "Baptism", ctx: "First sacrament of initiation" },
  { am: "ሜሮን", en: "Chrismation / Confirmation", ctx: "Sacrament of strengthening in the Spirit" },
  { am: "ቅዱስ ቁርባን", en: "Holy Eucharist", ctx: "Body and Blood of Christ; central sacrament" },
  { am: "ንስሐ", en: "Penance / Reconciliation", ctx: "Sacrament of forgiveness of sins" },
  { am: "ቅብዐ ቅዱስ", en: "Anointing of the Sick", ctx: "Sacrament for the seriously ill" },
  { am: "ክህነት", en: "Holy Orders / Priesthood", ctx: "Sacrament of ordained ministry" },
  { am: "ተክሊል", en: "Matrimony / Marriage", ctx: "Sacrament of marital union" },
  { am: "ቤተክርስቲያን", en: "Church", ctx: "The Body of Christ; community of the faithful" },
  { am: "ሐዋርያዊ ትውፊት", en: "Apostolic Tradition", ctx: "Transmission of faith from the Apostles" },
  { am: "መጽሐፍ ቅዱስ", en: "Holy Scripture / Bible", ctx: "The written Word of God" },
  { am: "ቀኖና", en: "Canon", ctx: "Official list of inspired books of Scripture" },
  { am: "ቅዳሴ", en: "Qiddase / Mass / Divine Liturgy", ctx: "Eucharistic liturgical celebration" },
  { am: "ሥርዓተ አምልኮ", en: "Liturgy", ctx: "Public worship of the Church" },
  { am: "ኑዛዜ", en: "Confession", ctx: "Verbal confession of sins to a priest" },
  { am: "ካህን", en: "Priest", ctx: "Ordained minister of sacraments" },
  { am: "ጳጳስ", en: "Bishop", ctx: "Successor of the Apostles; head of a diocese" },
  { am: "ዲያቆን", en: "Deacon", ctx: "Ordained minister of service" },
  { am: "ምእመናን", en: "The Faithful / Laity", ctx: "Baptized members of the Church" },
  { am: "ሐዋርያ", en: "Apostle", ctx: "One sent by Christ; the Twelve and their successors" },
  { am: "ወንጌል", en: "Gospel", ctx: "The Good News; the four Gospels" },
  { am: "ቃለ እግዚአብሔር", en: "Word of God", ctx: "Scripture and divine revelation" },
  { am: "መሥዋዕት", en: "Sacrifice", ctx: "Christ's sacrifice; the Eucharistic sacrifice" },
  { am: "ፋሲካ", en: "Pascha / Easter", ctx: "Christ's Passover; the central Christian feast" },
  { am: "ዕርገት", en: "Ascension", ctx: "Christ's bodily ascent into heaven" },
  { am: "ጰንጠቆስጤ", en: "Pentecost", ctx: "Descent of the Holy Spirit on the Apostles" },
];

// --- Generate concept pages ---
await mkdir(path.join(VAULT, 'wiki/concepts'), { recursive: true });
for (const c of concepts) {
  const md = `# ${c.am} (${c.en})

**Type:** concept
**Amharic:** ${c.am}
**English:** ${c.en}
**Compendium Q:** ${c.qs}
**Sources:** Compendium OCR
**Last updated:** ${TODAY}
**Related:** *(to be linked)*

## Synthesis

*(To be written — synthesize what the Compendium teaches about ${c.en.toLowerCase()} across all referenced Q&As.)*

## In the Compendium

See Q&As: ${c.qs}
Refer to the relevant [[wiki/teaching/]] pages for full Q&A text.

## In Scripture

*(To be populated during Bible ingest.)*

## Open questions

- Synthesis needs to be written from the Compendium Q&As listed above.

## Sources

- Compendium of the CCC (Amharic edition), Q&As as listed above.
`;
  await writeFile(path.join(VAULT, `wiki/concepts/${c.am}.md`), md);
}
console.log(`Wrote ${concepts.length} concept pages`);

// --- Generate figure pages ---
await mkdir(path.join(VAULT, 'wiki/figures'), { recursive: true });
for (const f of figures) {
  const md = `# ${f.am} (${f.en})

**Type:** figure
**Amharic:** ${f.am}
**English:** ${f.en}
**Role:** ${f.role}
**Sources:** Compendium OCR
**Last updated:** ${TODAY}
**Related:** *(to be linked)*

## In the Compendium

*(Summary of how ${f.en} appears in the Compendium Q&As — to be written.)*

## In Scripture

*(To be populated during Bible ingest.)*

## Sources

- Compendium of the CCC (Amharic edition)
`;
  await writeFile(path.join(VAULT, `wiki/figures/${f.file}.md`), md);
}
console.log(`Wrote ${figures.length} figure pages`);

// --- Generate glossary ---
await mkdir(path.join(VAULT, 'wiki/glossary'), { recursive: true });
let glossaryMd = `# Glossary — Amharic Catholic Terminology

**Type:** glossary
**Last updated:** ${TODAY}

| Amharic | English | Context |
|---|---|---|
`;
for (const g of glossary) {
  glossaryMd += `| ${g.am} | ${g.en} | ${g.ctx} |\n`;
}
glossaryMd += `\n*(This table will grow as more sources are ingested.)*\n`;

await writeFile(path.join(VAULT, 'wiki/glossary/terms.md'), glossaryMd);
console.log(`Wrote glossary (${glossary.length} terms)`);
