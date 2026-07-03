import { pgTable, serial, text, integer, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";

export const books = pgTable("books", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(), // English Name
  amharicName: varchar("amharic_name", { length: 255 }).notNull(),
  chapters: integer("chapters").notNull(),
  section: varchar("section", { length: 50 }).notNull(), // 'OT', 'NT', 'Apocrypha'
  heroImage: text("hero_image"), // URL or path to hero image
  // printed book introduction from the Emmaus edition (መግቢያ + outline),
  // loaded by scripts/load_book_intros.mjs in the app repo:
  // { display_title, introduction, outline_heading, outline[], source_page }
  introduction: jsonb("introduction"),
});

// New table to store actual chapter content extracted from PDFs
export const chapterContents = pgTable("formatted_chapter_contents", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").references(() => books.id).notNull(),
  chapterNumber: integer("chapter_number").notNull(),
  content: jsonb("content").notNull(), // Full structured content (ExtractionResult)
  style: varchar("style", { length: 50 }).default("prose"), // 'prose', 'poetry', 'mixed'

  // NEW: Formatting rules - stores exact verse ranges for different formats
  formattingRules: jsonb("formatting_rules"), // Example below
  /*
    formattingRules format:
    {
      "sections": [
        {
          "type": "prose" | "poetry" | "list" | "footnote",
          "verseRange": [1, 13],  // verses 1-13
          "indent": 0,            // for poetry: indent level
          "title": "optional section title"
        },
        {
          "type": "poetry",
          "verseRange": [14, 19], // Genesis 3:14-19 (curses)
          "indent": 1
        },
        {
          "type": "prose",
          "verseRange": [20, 24]
        }
      ],
      "footnotes": [
        {
          "verseRef": "3:15",
          "marker": "*",
          "text": "Footnote text here"
        }
      ],
      "lists": [
        {
          "verseRange": [1, 10],
          "listType": "numbered" | "bulleted" | "genealogy"
        }
      ]
    }
  */

  verified: integer("verified").default(0), // 0 = pending review, 1 = approved
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Users table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  firebaseUid: varchar("firebase_uid", { length: 128 }).unique().notNull(),
  email: varchar("email", { length: 255 }),
  phoneNumber: varchar("phone_number", { length: 20 }),
  displayName: varchar("display_name", { length: 255 }),
  photoUrl: text("photo_url"),
  authProvider: varchar("auth_provider", { length: 20 }), // 'google' | 'phone'
  role: varchar("role", { length: 50 }).default("user"), // 'user' | 'admin'
  createdAt: timestamp("created_at").defaultNow(),
  lastLoginAt: timestamp("last_login_at").defaultNow(),
});

export type DrizzleUser = typeof users.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// Wiki sync tables — populated by Mekra-Catholic-Bible-Wiki/scripts/sync_to_db.mjs
// Source of truth lives in markdown files in the wiki repo. This table is a
// derived, queryable cache for the app frontend. NEVER edit these rows by hand.
// ─────────────────────────────────────────────────────────────────────────────

export const wikiPages = pgTable("wiki_pages", {
  id: serial("id").primaryKey(),
  // 'teaching' | 'concept' | 'figure' | 'place' | 'apologetics' |
  // 'comparative' | 'theme' | 'qa' | 'liturgical' | 'glossary'
  pageType: varchar("page_type", { length: 32 }).notNull(),
  // Stable URL slug, unique within (page_type). e.g. 'eucharist', 'ጥምቀት'
  slug: varchar("slug", { length: 255 }).notNull(),
  // Display titles
  titleEn: varchar("title_en", { length: 512 }),
  titleAm: varchar("title_am", { length: 512 }),
  // Frontmatter (Compendium Q numbers, CCC refs, related links, etc.)
  frontmatter: jsonb("frontmatter").notNull(),
  // Full markdown body (post-frontmatter, pre-render)
  bodyMd: text("body_md").notNull(),
  // SHA-256 of bodyMd — sync skips unchanged files for speed
  contentHash: varchar("content_hash", { length: 64 }).notNull(),
  // Outbound wiki links resolved during sync, e.g. ['teaching/baptism', 'concepts/ጸጋ']
  links: jsonb("links").default([]).notNull(),
  // Bible references parsed from body, e.g. [{book:'Luke',ch:22,v:'14-20'}]
  bibleRefs: jsonb("bible_refs").default([]).notNull(),
  // Original wiki file path, for traceability
  sourcePath: varchar("source_path", { length: 512 }).notNull(),
  // From wiki frontmatter "Last updated:"
  wikiUpdatedAt: timestamp("wiki_updated_at"),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
});

export type WikiPage = typeof wikiPages.$inferSelect;

