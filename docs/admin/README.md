# Mekra Catholic Wiki — Admin Notes

*This folder is for the project owner. It is not user-facing content. Tracks status, the shareable user guide, and the open document-collection checklist.*

---

## Project status snapshot (2026-05-19)

| Component | Status |
|---|---|
| Compendium of the Catechism — Amharic digital edition | ✅ 597 / 598 Q&As extracted (Q417 absent in source) |
| Compendium intro (Pope JP-II preface, title page) | ✅ `raw/catechism-digital/intro.md` |
| Compendium appendix (~24 prayers, formulas, index) | ✅ `raw/catechism-digital/appendix.md` |
| Amharic Bible (Emmaus Catholic Edition) | ✅ 73 books in Neon DB — query via `scripts/get_verse.mjs` |
| Wiki pages (teaching, concepts, figures, bible, apologetics, comparative, liturgical, themes, qa) | ~150+ pages |
| CLAUDE.md precedence rule | ✅ AI always consults `raw/catechism-digital/` first |
| User guide for priests / catechists / faithful | ✅ `docs/Mekra-Catholic-Wiki-User-Guide.pdf` |

---

## Shareable User Guide

The official user guide to hand to priests, catechists, and the faithful:

- **PDF (share this):** `docs/Mekra-Catholic-Wiki-User-Guide.pdf` — 7 pages, bilingual Amharic + English
- **Source (edit then regenerate):** `docs/user-guide.md`
- **Intermediate (regenerable):** `docs/user-guide.docx`

**To regenerate after editing the markdown:**

```sh
cd docs
pandoc user-guide.md -o user-guide.docx
osascript -e 'tell application "Pages" to export (open POSIX file "'$PWD'/user-guide.docx") to POSIX file "'$PWD'/Mekra-Catholic-Wiki-User-Guide.pdf" as PDF'
```

---

## Documents to collect — priority checklist

Each item, when acquired, deepens what the wiki and AI assistant can do. Drop the file (`.pages`, `.docx`, `.pdf`, or scanned book) into `raw/books/` and tell Claude what it is — extraction is automatic.

### 🔴 High priority (biggest gaps)

- [ ] **የሥርዓተ ቅዳሴ መጽሐፍ** — *The Mass Liturgy Book (Roman Missal in Amharic)*
  - Eucharistic Prayers / Anaphoras, Penitential Rite, Gloria, Sanctus, Agnus Dei, Memorial Acclamations
  - **Where:** Ethiopian Catholic Secretariat (Addis Ababa, near Sidist Kilo); your home parish sacristy
  - **Single biggest practical gain for priest users.**

- [ ] **የካቶሊክ መዝሙር መጽሐፍ / የቤተክርስቲያን መዝሙራት** — *Parish Hymnal*
  - Sunday hymns, seasonal hymns (ገና, ፋሲካ, ጾመ አርብዓ, ግንቦት የማርያም ወር), wedding (ተክሊል) hymns, funeral (ቀብር) hymns, Eucharistic adoration songs
  - **Where:** Parish choir directors (the goldmine — usually photocopied or spiral-bound, locally compiled)
  - **If possible, get both lyrics PDF *and* audio recordings** — text for the wiki, audio for future app features

- [ ] **የሰዓታት ጸሎት** — *Liturgy of the Hours / Breviary*
  - Morning (የንግሥት ጸሎት), Evening (የሠርክ ጸሎት), Night, Office of Readings; full Psalter in Amharic
  - **Where:** Ethiopian Catholic Secretariat; Capuchin or Lazarist publications

- [ ] **ሥርዓተ ምሥጢራት** — *Sacramental Rites Book(s)*
  - ሥርዓተ ጥምቀት (Baptism), ሥርዓተ ሜሮን (Confirmation), ሥርዓተ ተክሊል (Marriage), ሥርዓተ ኑዛዜ (Confession), ሥርዓተ ሕሙማን ቅባት (Anointing), ሥርዓተ ክህነት (Holy Orders), ሥርዓተ ቀብር (Funeral)
  - **Where:** Diocesan offices; parish sacristies

### 🟡 Medium priority

- [ ] **የመስቀል መንገድ ጸሎት (14 ቦታዎች)** — *Stations of the Cross*, full Amharic text. Heavily used in Lent.

- [ ] **ዝርዝር ጸሎቶች / Litanies**
  - Litany of the Saints (የቅዱሳን ዝርዝር ጸሎት), Litany of Loreto (የሎሬቶ), Sacred Heart (የቅዱስ ልብ), Divine Mercy Chaplet (የመለኮታዊ ምሕረት መቁጸሪያ)

- [ ] **የቅዱሳን ታሪክ / Synaxarium-style lives of saints**
  - **አባ ያዕቆብ (Justin de Jacobis)** — biography, letters, writings
  - **አቡነ ገብረ ሚካኤል** (Abune Ghebre Michael) — Ethiopian Catholic martyr
  - Other local Ethiopian Catholic saints / feast day entries

- [ ] **CBCE pastoral letters / መልእክተ ጳጳሳት** — Catholic Bishops' Conference of Ethiopia
  - Pastoral letters, social teaching applied to Ethiopia, statements on national issues

- [ ] **Vatican II documents in Amharic** (if any official translation exists)
  - Lumen Gentium, Sacrosanctum Concilium, Dei Verbum, Gaudium et Spes, Nostra Aetate

### 🟢 Nice-to-have / longer-term

- [ ] Major papal encyclicals translated into Amharic (Humanae Vitae, Evangelium Vitae, Laudato Si', Fratelli Tutti, etc.)
- [ ] Adult catechism / RCIA materials in Amharic
- [ ] Marriage preparation guides used by Ethiopian dioceses
- [ ] Children's catechism / First Communion preparation
- [ ] Confirmation preparation guides
- [ ] Capuchin Franciscan spiritual writings (active order in Ethiopia)
- [ ] **Ge'ez Rite Catholic** liturgical books (Adigrat eparchy, formerly Eritrea) — if you want to cover both Catholic rites in Ethiopia

---

## Where to find them — source directory

| Source | Best for |
|---|---|
| **Ethiopian Catholic Secretariat** (አዲስ አበባ, near Sidist Kilo) | Full liturgical books, CBCE pastoral letters |
| **St. Paul Communications / Daughters of St. Paul** (Nairobi + Addis) — publisher of the Compendium | Catechetical materials, prayer books, devotionals |
| **Capuchin Franciscan publications** | Spiritual writings, biographies, devotional books |
| **Adigrat Eparchy** (Tigray, Ge'ez Rite Catholic) | Ge'ez Rite liturgical books (Eastern Catholic) |
| **Holy Trinity Catholic University** (Capuchin Seminary, Addis Ababa) library | Theology, magisterial documents |
| **Local parish + diocesan offices** | Parish hymnals, local feast day materials, choir books |
| **CMSI (Conference of Major Superiors)** | Religious order materials |
| **Vatican.va** (online) | Magisterial documents — small chance of Amharic translations |

---

## Two Catholic rites in Ethiopia — important when asking

When asking for documents, specify which rite you want:

- **Latin Rite (Roman Rite) using Amharic** — most central/southern Ethiopia, Addis area, majority of Ethiopian Catholic parishes
- **Ge'ez Rite Catholic — Ge'ez liturgically + Amharic catechesis** — Adigrat eparchy (Tigray); historically the Eritrean Catholic Church

If you can collect for both, the wiki covers all Ethiopian Catholic worship.

---

## How to add a new document once you have it

1. Drop the file in `raw/books/` (any format — `.pages`, `.docx`, `.pdf`, scanned book)
2. Tell Claude: *"I added [name] to raw/books/ — please ingest it as [type: hymnal / mass book / rite of X / saint biography / etc.]"*
3. Claude extracts it cleanly into the right place (likely `raw/liturgical/`, `raw/hymns/`, or extending `raw/catechism-digital/`), produces Karpathy-style RAG units, and updates `log.md`.
4. After ingest, the wiki + AI assistant + user guide content all extend to cover the new material.

---

## Reminders for the admin

- The Compendium digital extraction (`raw/catechism-digital/`) is now the **canonical text source** for the AI assistant. Do not delete or modify it without re-running `scripts/extract_compendium_digital.mjs` and `scripts/extract_compendium_extras.mjs`.
- The OCR'd `raw/catechism/` is the **page-provenance backup** only. Keep it for visual auditing; don't treat it as text-of-record.
- All ingest activity is logged in `log.md` at the repo root — append-only timeline.
- The CLAUDE.md file is the **AI's contract** — it tells the AI how to behave. If you want to change AI behavior (citation style, precedence rules, what to do on a query), edit CLAUDE.md.
