#!/usr/bin/env node
/**
 * sync_to_db.mjs — push wiki markdown files into Mekra Neon (wiki_pages table).
 *
 * Walks every .md file under wiki/ (skipping wiki/bible/, which is reserved for
 * synthesis pages and would conflict with bulk Bible content in the books table),
 * parses bold-field frontmatter, extracts links and Bible refs, and upserts to DB.
 *
 * Idempotent: uses content_hash to skip unchanged files. Safe to run repeatedly.
 *
 * Usage:
 *   node scripts/sync_to_db.mjs                # full sync
 *   node scripts/sync_to_db.mjs --dry-run      # parse but don't write
 *   node scripts/sync_to_db.mjs --only teaching/eucharist.md
 *   node scripts/sync_to_db.mjs --type teaching   # only one folder
 *   node scripts/sync_to_db.mjs --force        # ignore content_hash, rewrite all
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative, basename, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WIKI_ROOT = join(__dirname, '..');
const WIKI_DIR = join(WIKI_ROOT, 'wiki');
const APP_ENV = '/Users/mekdesyared/Mekra-Catholic-Bible/.env';

// Load DATABASE_URL from the Mekra app's .env
if (!process.env.DATABASE_URL && existsSync(APP_ENV)) {
  for (const line of readFileSync(APP_ENV, 'utf8').split('\n')) {
    const m = line.match(/^DATABASE_URL=(.*)$/);
    if (m) {
      process.env.DATABASE_URL = m[1].replace(/^["']|["']$/g, '');
      break;
    }
  }
}
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not found');
  process.exit(2);
}

const sql = neon(process.env.DATABASE_URL);

// CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const onlyIdx = args.indexOf('--only');
const ONLY = onlyIdx >= 0 ? args[onlyIdx + 1] : null;
const typeIdx = args.indexOf('--type');
const TYPE_FILTER = typeIdx >= 0 ? args[typeIdx + 1] : null;

// Folders that map to page_type. Order matters for top-level vs nested.
// 'bible' is intentionally excluded — Bible synthesis pages will go in later
// once we have a clear separation from the books table.
const TYPE_MAP = {
  teaching: 'teaching',
  apologetics: 'apologetics',
  comparative: 'comparative',
  concepts: 'concept',
  figures: 'figure',
  places: 'place',
  themes: 'theme',
  qa: 'qa',
  glossary: 'glossary',
  liturgical: 'liturgical',
};
const SKIP_FOLDERS = new Set(['bible']);

async function walkMd(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      const rel = relative(WIKI_DIR, full).split('/')[0];
      if (SKIP_FOLDERS.has(rel)) continue;
      await walkMd(full, files);
    } else if (e.isFile() && extname(e.name) === '.md') {
      files.push(full);
    }
  }
  return files;
}

// Parse bold-field frontmatter:  **Type:** teaching  →  { type: 'teaching' }
function parseFrontmatter(body) {
  const fm = {};
  const lines = body.split('\n');
  let bodyStart = 0;
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const line = lines[i];
    const m = line.match(/^\*\*([^:*]+):\*\*\s*(.*)$/);
    if (m) {
      const key = m[1].trim().toLowerCase().replace(/\s+/g, '_');
      fm[key] = m[2].trim();
      bodyStart = i + 1;
    } else if (line.trim() === '' && bodyStart > 0) {
      // blank line after frontmatter block
      break;
    }
  }
  return { frontmatter: fm, bodyStartLine: bodyStart };
}

// Extract [[wiki/path]] or [[concepts/ጸጋ]] style links
function extractLinks(body) {
  const out = new Set();
  const re = /\[\[([^\]]+)\]\]/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    out.add(m[1].trim());
  }
  return [...out];
}

// Extract Bible references from prose. Matches both English and Amharic book
// names followed by "<chapter>:<verse-or-range>". Conservative — only catches
// patterns immediately followed by a chapter:verse construct.
const BOOK_NAMES = [
  // English
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
  '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra',
  'Nehemiah','Tobit','Judith','Esther','Job','Psalms','Proverbs','Ecclesiastes',
  'Song of Songs','Wisdom','Sirach','Isaiah','Jeremiah','Lamentations','Baruch',
  'Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum',
  'Habakkuk','Zephaniah','Haggai','Zechariah','Malachi','1 Maccabees','2 Maccabees',
  'Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians',
  'Galatians','Ephesians','Philippians','Colossians','1 Thessalonians',
  '2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James',
  '1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation',
  // Amharic short forms commonly used in citations
  'ማቴዎስ','ማርቆስ','ሉቃስ','ዮሐንስ','የሐዋ','ሮሜ','ቆሮ','1ኛ ቆሮ','2ኛ ቆሮ',
  'ገላ','ኤፌ','ፊል','ቆላ','ዕብ','ራእ','መዝ','ኢሳ','ኤር','ዘፍ','ዘፀ','ዘሌ','ዘኍ','ዘዳ',
];

function extractBibleRefs(body) {
  const out = [];
  for (const book of BOOK_NAMES) {
    const escaped = book.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`${escaped}\\s+(\\d+)[:፡]([\\d–\\-,\\s]+)`, 'g');
    let m;
    while ((m = re.exec(body)) !== null) {
      out.push({ book, chapter: parseInt(m[1], 10), verses: m[2].trim() });
    }
  }
  return out;
}

function classify(filePath) {
  const rel = relative(WIKI_DIR, filePath);
  const parts = rel.split('/');
  const folder = parts[0];
  const pageType = TYPE_MAP[folder];
  if (!pageType) return null;
  const slug = basename(filePath, '.md');
  return { pageType, slug, rel };
}

// Pull bilingual title from "# Title (Amharic)" or "# አማርኛ (English)"
function extractTitles(body, frontmatter) {
  const m = body.match(/^#\s+(.+)$/m);
  if (!m) return { title_en: null, title_am: frontmatter.amharic ?? null };
  const heading = m[1].trim();
  const paren = heading.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (paren) {
    const a = paren[1].trim();
    const b = paren[2].trim();
    // If first part contains Ethiopic, it's Amharic; else English
    const aIsAmharic = /[\u1200-\u137F]/.test(a);
    return aIsAmharic
      ? { title_am: a, title_en: b }
      : { title_en: a, title_am: b };
  }
  // Single title — pick by script
  const isAmharic = /[\u1200-\u137F]/.test(heading);
  return isAmharic
    ? { title_am: heading, title_en: null }
    : { title_en: heading, title_am: frontmatter.amharic ?? null };
}

function parseWikiDate(s) {
  if (!s) return null;
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
}

async function getExistingHashes() {
  const rows = await sql`SELECT page_type, slug, content_hash FROM wiki_pages`;
  const map = new Map();
  for (const r of rows) map.set(`${r.page_type}/${r.slug}`, r.content_hash);
  return map;
}

async function upsertPage(p) {
  await sql`
    INSERT INTO wiki_pages (
      page_type, slug, title_en, title_am, frontmatter, body_md,
      content_hash, links, bible_refs, source_path, wiki_updated_at, synced_at
    ) VALUES (
      ${p.pageType}, ${p.slug}, ${p.title_en}, ${p.title_am},
      ${JSON.stringify(p.frontmatter)}::jsonb, ${p.body_md},
      ${p.content_hash},
      ${JSON.stringify(p.links)}::jsonb,
      ${JSON.stringify(p.bible_refs)}::jsonb,
      ${p.source_path}, ${p.wiki_updated_at}, NOW()
    )
    ON CONFLICT (page_type, slug) DO UPDATE SET
      title_en = EXCLUDED.title_en,
      title_am = EXCLUDED.title_am,
      frontmatter = EXCLUDED.frontmatter,
      body_md = EXCLUDED.body_md,
      content_hash = EXCLUDED.content_hash,
      links = EXCLUDED.links,
      bible_refs = EXCLUDED.bible_refs,
      source_path = EXCLUDED.source_path,
      wiki_updated_at = EXCLUDED.wiki_updated_at,
      synced_at = NOW()
  `;
}

async function main() {
  console.log(`📂 Wiki: ${WIKI_DIR}`);
  console.log(`🔧 Mode: ${DRY_RUN ? 'DRY RUN' : 'WRITE'}${FORCE ? ' (force)' : ''}`);

  const allFiles = await walkMd(WIKI_DIR);
  console.log(`📄 Found ${allFiles.length} markdown files`);

  const existing = DRY_RUN ? new Map() : await getExistingHashes();

  let stats = { processed: 0, written: 0, skipped: 0, unclassified: 0, errors: 0 };

  for (const file of allFiles) {
    const cls = classify(file);
    if (!cls) { stats.unclassified++; continue; }
    if (TYPE_FILTER && cls.pageType !== TYPE_FILTER) continue;
    if (ONLY && !cls.rel.endsWith(ONLY)) continue;

    try {
      const raw = readFileSync(file, 'utf8');
      const { frontmatter } = parseFrontmatter(raw);
      const titles = extractTitles(raw, frontmatter);
      const links = extractLinks(raw);
      const bible_refs = extractBibleRefs(raw);
      const content_hash = createHash('sha256').update(raw).digest('hex');
      const wiki_updated_at = parseWikiDate(frontmatter.last_updated);

      stats.processed++;
      const key = `${cls.pageType}/${cls.slug}`;

      if (!FORCE && existing.get(key) === content_hash) {
        stats.skipped++;
        continue;
      }

      const page = {
        pageType: cls.pageType,
        slug: cls.slug,
        title_en: titles.title_en,
        title_am: titles.title_am,
        frontmatter,
        body_md: raw,
        content_hash,
        links,
        bible_refs,
        source_path: cls.rel,
        wiki_updated_at,
      };

      if (DRY_RUN) {
        console.log(`  [dry] ${cls.pageType}/${cls.slug} — links:${links.length} refs:${bible_refs.length}`);
      } else {
        await upsertPage(page);
        console.log(`  ✓ ${cls.pageType}/${cls.slug}`);
      }
      stats.written++;
    } catch (err) {
      stats.errors++;
      console.error(`  ✗ ${cls.rel}: ${err.message}`);
    }
  }

  console.log('');
  console.log(`📊 Done. processed=${stats.processed} written=${stats.written} skipped=${stats.skipped} unclassified=${stats.unclassified} errors=${stats.errors}`);
  process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(99); });
