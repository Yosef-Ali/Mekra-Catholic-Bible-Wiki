# Mekra Catholic Bible Wiki

An Amharic-first, agent-maintained knowledge base on Catholic teaching, Scripture, and liturgy, seeded by the **Amharic Compendium of the Catechism of the Catholic Church** (598 numbered Q&A items).

The wiki is paired with the [Mekra Catholic Bible app](https://github.com/Yosef-Ali/Mekra-Catholic-Bible) but is a separate vault. The app holds the Amharic Emmaus Catholic Edition Bible in a Neon Postgres DB; the wiki holds curated, evolving teaching synthesis. The two are linked by `scripts/get_verse.mjs`.

## Status

| Layer | Pages | Notes |
|-------|-------|-------|
| `wiki/teaching/` | 35 | Synthesis pages grouping Compendium Q&A by topic, all with Amharic theological synthesis + Scripture |
| `wiki/bible/` | 73 | One synthesis page per biblical book (full canon: OT + NT + Apocrypha) |
| `wiki/concepts/` | 32 | Theological concepts in Amharic (ጸጋ, ምሥጢር, ኪዳን…) with Ge'ez/Greek/Latin |
| `wiki/figures/` | 15 | Jesus, Mary, apostles, saints, Church Fathers |
| `wiki/liturgical/seasons/` | 4 | Advent, Lent, Easter, Ordinary Time |
| `wiki/glossary/` | 11 | Term mappings |
| `wiki/qa/` | 4 | Compounding archive of user questions |
| Compendium OCR | 151/151 scans, 578/598 Q&A indexed | 5 pages await rescan; see `raw/catechism/page_map.json` |

## Layout

```
raw/         immutable source material (read-only to the agent)
  catechism/   Compendium scans (TIF + JPG) and OCR'd markdown
  bible/       Source PDFs; bulk verse text lives in the Mekra app's Neon DB
  commentaries/, liturgical/  reserved for future ingest

wiki/        agent-owned synthesis (this is the product)
  teaching/, apologetics/, comparative/   primary teaching layer
  bible/, themes/                         Scripture syntheses
  concepts/, figures/, places/            entities
  liturgical/feasts/, liturgical/seasons/ liturgy
  qa/                                     saved user questions
  glossary/                               cross-language term mappings

scripts/     tooling (OCR, page-map build, DB lookups, lint, sync)
log.md       append-only activity log
CLAUDE.md    full agent schema (read this for the operating model)
```

## The hybrid pattern

The Bible (73 books, ~1,329 chapters of Amharic text) is **not** mirrored as markdown. It lives in the Mekra app's Neon DB. The wiki queries it on demand:

```sh
node scripts/get_verse.mjs Matthew 5 3-12         # Beatitudes
node scripts/get_verse.mjs "ኦሪት ዘፍጥረት" 1 1-3      # Genesis 1:1-3 (Amharic name)
node scripts/get_verse.mjs --list                 # all 73 books
```

`wiki/bible/<Book>.md` is a *synthesis* page (themes, structure, key passages, cross-references), not full text. Full text stays in the DB. This keeps the wiki small and the DB authoritative.

## Scripts

| Script | What it does |
|--------|-------------|
| `get_verse.mjs` | Look up Amharic verse text from the Neon DB. The bridge between wiki and Bible. |
| `ocr_compendium.mjs` | Batch OCR `raw/catechism/source_jpg/` → `raw/catechism/extracted/` (idempotent). |
| `build_page_map.mjs` | Parse extracted frontmatter into `raw/catechism/page_map.json`. |
| `build_qa_index.mjs` | Index the 598 Compendium Q&A entries by Q number. |
| `validate_db_mappings.mjs` | Catch chapter-level shifts between wiki book pages and DB content. |
| `sync_to_db.mjs` | Push wiki pages to the Mekra app's `wiki_pages` table for in-app rendering. |

## Conventions

- **Bold-field metadata, not YAML.** Every page opens with `**Type:**`, `**Compendium Q:**`, `**Sources:**`, `**Last updated:**`, `**Related:**`. Robust across LLMs and viewers; doesn't choke on Amharic.
- **Wiki links** use `[[concepts/X]]` / `[[teaching/Y]]` (no `wiki/` prefix).
- **Archaic Amharic preserved.** ሠ ≠ ሰ, ሐ ≠ ሀ, ጸ ≠ ፀ, አ ≠ ዐ. Ethiopic punctuation: ። ፣ ፤ ፥.
- **Citations are exact.** Compendium → `raw/catechism/extracted/<file>.md` + printed page + Q number. Verses → DB output, never paraphrased.
- **`raw/` is immutable.** OCR errors get re-OCR'd, never hand-edited.

See [CLAUDE.md](./CLAUDE.md) for the full agent schema, page templates, and operating rules (`ingest`, `query`, `lint`).

## License

The Compendium scans, the Emmaus Bible text, and other source material under `raw/sources/` retain the rights of their original publishers. The agent-authored synthesis under `wiki/` is offered as a research and teaching aid; verify against an authoritative text before relying on it for liturgical use.
