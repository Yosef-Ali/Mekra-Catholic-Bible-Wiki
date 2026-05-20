import { Router } from 'express';
import { db } from '../../services/db';
import { wikiPages } from '../../services/schema';
import { eq, and, ilike, or, sql as dsql, desc } from 'drizzle-orm';

const router = Router();

// Shared projection for list responses (slim: no body_md)
const listProjection = {
  page_type: wikiPages.pageType,
  slug: wikiPages.slug,
  title_en: wikiPages.titleEn,
  title_am: wikiPages.titleAm,
  compendium_q: dsql<string | null>`${wikiPages.frontmatter}->>'compendium_q'`,
  sources: dsql<string | null>`${wikiPages.frontmatter}->>'sources'`,
  bible_ref_count: dsql<number>`jsonb_array_length(${wikiPages.bibleRefs})`,
  wiki_updated_at: wikiPages.wikiUpdatedAt,
};

// GET /api/wiki?slug=eucharist[&type=teaching]
// GET /api/wiki?search=...
// GET /api/wiki[?type=teaching][&limit=500]
router.get('/', async (req, res) => {
  try {
    const { type, slug, search } = req.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt((req.query.limit as string) ?? '500', 10), 1000);

    // Single page
    if (slug) {
      const conds = [eq(wikiPages.slug, slug)];
      if (type) conds.push(eq(wikiPages.pageType, type));
      const rows = await db
        .select({
          page_type: wikiPages.pageType,
          slug: wikiPages.slug,
          title_en: wikiPages.titleEn,
          title_am: wikiPages.titleAm,
          frontmatter: wikiPages.frontmatter,
          body_md: wikiPages.bodyMd,
          links: wikiPages.links,
          bible_refs: wikiPages.bibleRefs,
          source_path: wikiPages.sourcePath,
          wiki_updated_at: wikiPages.wikiUpdatedAt,
          synced_at: wikiPages.syncedAt,
        })
        .from(wikiPages)
        .where(and(...conds))
        .limit(1);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Page not found' });
      }
      return res.json({ success: true, data: rows[0] });
    }

    // Search
    if (search) {
      const q = `%${search}%`;
      const rows = await db
        .select({
          ...listProjection,
          preview: dsql<string>`LEFT(${wikiPages.bodyMd}, 300)`,
        })
        .from(wikiPages)
        .where(
          or(
            ilike(wikiPages.titleEn, q),
            ilike(wikiPages.titleAm, q),
            ilike(wikiPages.bodyMd, q)
          )
        )
        .orderBy(desc(wikiPages.wikiUpdatedAt))
        .limit(30);
      return res.json({ success: true, data: rows, count: rows.length });
    }

    // List — sort by leading integer in compendium_q so pages appear in
    // Catechism/Compendium order (e.g. Creed Q 26 before Church Q 147),
    // falling back to slug for pages without a Q number.
    const qOrder = dsql`NULLIF(regexp_replace(${wikiPages.frontmatter}->>'compendium_q', '\\D.*$', ''), '')::int NULLS LAST`;
    const rows = type
      ? await db
          .select(listProjection)
          .from(wikiPages)
          .where(eq(wikiPages.pageType, type))
          .orderBy(qOrder, wikiPages.slug)
          .limit(limit)
      : await db
          .select(listProjection)
          .from(wikiPages)
          .orderBy(wikiPages.pageType, qOrder, wikiPages.slug)
          .limit(limit);

    return res.json({ success: true, data: rows, count: rows.length });
  } catch (error) {
    console.error('wiki route error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch wiki pages' });
  }
});

export default router;
