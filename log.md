## [2026-04-09] ocr | Compendium source_jpg/ (151 files) → extracted/ | Gemini 3.1 Flash | ok=151 errors=0
## [2026-04-09] page-map | Compendium extracted/ → raw/catechism/page_map.json | range 1-292 | missing=41 | dup=1 | front=17
## [2026-04-09] restructure | CLAUDE.md rewritten teaching-centric | wiki/ folders: +teaching +apologetics +comparative +figures +bible, -books -people
## [2026-04-09] resolved | p.226 dual-scan (a62 + b1) not a duplicate — different spread configurations of same page
## [2026-04-09] ocr-batch2 | 11 new rescans processed | total extracted: 212 files | missing pages: 5 (14, 46, 143, 174, 238)
## [2026-05-06] bible-synthesis | created wiki/bible/Acts.md, Romans.md, 1Corinthians.md, Galatians.md, Ephesians.md | 5 pages, 69-70 lines each | 25 key verses fetched via get_verse.mjs
## [2026-04-09] qa-index | raw/catechism/qa_index.json | 578/598 Q&As indexed | missing: 5-7, 21, 23, 113-115, 122, 177-178, 181-182, 408, 417, 455, 483-485, 557
## [2026-04-09] ingest | Compendium full → wiki/teaching/ | 35 teaching pages created | Parts 1-4 complete
## [2026-04-09] ingest | Compendium → wiki/concepts/ | 20 concept pages | wiki/figures/ | 15 figure pages | wiki/glossary/ | 25 terms
## [2026-04-09] query | "What do Ethiopian Catholics do on Holy Thursday?" | touched: 2 pages (wiki/qa/2026-04-09-holy-thursday.md, wiki/liturgical/feasts/ጸሎተ-ሐሙስ.md)
## [2026-04-09] enrich | wiki/figures/Augustine.md | full biography, all 6 Compendium citations, works, theology, Ethiopian significance, prayers

## [2026-04-13] tooling | added scripts/get_verse.mjs (Neon DB bridge for Amharic Bible) | CLAUDE.md updated with hybrid-pattern section
## [2026-04-13] hybrid-pattern demo | wiki/teaching/eucharist.md | added Scripture section: Luke 22:14-20, John 6:53-56, 1 Cor 11:23-26 from Neon DB | sources 13→16
## [2026-04-13] distribution | path-A complete | added wiki_pages schema + sync_to_db.mjs + api/wiki.ts + WikiViewer component + nav integration + .github/workflows/sync-wiki.yml | 73 pages synced to Neon | live-tested via Express route

## [2026-05-06] bible | 73/73 Bible synthesis pages COMPLETE — all OT, NT, Apocrypha books covered
## [2026-05-06] glossary | 10 individual glossary pages created: ጸጋ, ምሥጢር, ኪዳን, ንስሐ, ሥርየት, ሕብረት, ቤዛ, ትንሣኤ, ሃይማኖት, ደኅንነት | each with Ge'ez/Greek/Latin
## [2026-05-06] commandment-audit | comprehensive audit: CCC ranges fixed on 5 pages, Q534-537 (prayer content) removed from commandments page | structural issue: page titles don't match Q content — 1st-3rd commandment Qs missing entirely, cross-page Q movement needed
## [2026-05-06] lint | checked: 73 pages | issues: 50 (broken-links=46 across 23 files, sources-mismatch=2, missing-meta=2, stale=0, ocr-markers=0, missing-raw=0)
## [2026-05-06] syntheses | ALL 35 teaching pages now have Amharic theological syntheses — sacraments (6), doctrine (8), morality (8), commandments (5), prayer (3), remaining (5)
## [2026-05-06] scripture-populate | Phase 2: populated Scripture sections on all 35 teaching pages via Neon DB get_verse.mjs | completed: baptism.md (Matt 28:19, John 3:5 + DB issue flagged), eucharist.md (Luke 22:14-20, John 6:53-56, 1 Cor 11:23-26), 28 other pages via subagent batches | DB issue found: Romans 6 maps to 1 Corinthians 6 content
## [2026-05-06] scripture-populate | remaining 5 commandment pages populated directly (Exodus 20:1-17) | page-content mismatch found: fourth-commandment.md Q&A (503-509) covers 7th commandment — flagged in Open questions
## [2026-05-06] concepts | 32 concept pages exist (20 from Apr 9 ingest + 12 new from today's glossary pass): ጸጋ, ምሥጢር, ኪዳን, ንስሐ, ይቅርታ, ሥርየት, ሕብረት, መድኃኒት, ቤዛ, ጽድቅ, ተልእኮ, ሐዋርያ, ሰማዕት, እምነት, ሕይወት, ሞት, ትንሣኤ, ፍቅር, ነፃነት, ኅሊና, ደኅንነት, ክብር, ብፅዕና, ጸሎት, አምልኮ, ፍጥረት, ኃጢአት, ፍርድ, ቅድስት ሥላሴ, ተስፋ, ዘላለማዊ ሕይወት, ምሕረት
## [2026-05-06] db-validate | wrote scripts/validate_db_mappings.mjs | scanned all 73 books | found 6 ch1v1 mismatches + 52 Pauline chapter shifts | Romans ch1-9 = 1 Cor content, 1 Cor = 2 Cor content (duplicated), Colossians ch1 = 1 Timothy, Revelation ch1 = intro/travelogue text | Galatians/Ephesians/Philippians/Colossians/1Thess/1Tim/Titus have chapter-level shifts
## [2026-05-06] db-fix | reimported Romans (16ch, 362v) + 1 Corinthians (16ch, 437v) from clean vision_page JSONs | fixed Pauline off-by-one: 2Cor deduplicated (13ch) | Romans 6:3-4 now returns real baptism text | validator still shows 8 false-positive ch1v1 mismatches (Titus/1Tim/1John/Rev fingerprint too strict) and Colossians ch1 real issue
## [2026-05-06] qa | 3 new QA entries: romans-db-mapping.md, fourth-commandment-mismatch.md, scripture-populate.md | total qa/ now 4 entries