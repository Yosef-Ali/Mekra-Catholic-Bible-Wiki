import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

/**
 * GET /api/wiki                          → list all pages (slim: no body_md)
 * GET /api/wiki?type=teaching            → filter by page_type
 * GET /api/wiki?type=teaching&slug=eucharist  → single page (full body_md)
 * GET /api/wiki?slug=eucharist           → single page across any type
 * GET /api/wiki?search=ቁርባን              → ILIKE search on title + body
 *
 * Read-only. The wiki_pages table is populated by the wiki repo's
 * scripts/sync_to_db.mjs — never written to from the app side.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);
    const { type, slug, search, limit } = req.query as Record<string, string | undefined>;

    // CORS for the SPA
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');

    // Single page lookup → return full body
    if (slug) {
      const rows = type
        ? await sql`
            SELECT page_type, slug, title_en, title_am, frontmatter,
                   body_md, links, bible_refs, source_path,
                   wiki_updated_at, synced_at
            FROM wiki_pages
            WHERE page_type = ${type} AND slug = ${slug}
            LIMIT 1
          `
        : await sql`
            SELECT page_type, slug, title_en, title_am, frontmatter,
                   body_md, links, bible_refs, source_path,
                   wiki_updated_at, synced_at
            FROM wiki_pages
            WHERE slug = ${slug}
            LIMIT 1
          `;
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Page not found' });
      }
      return res.status(200).json({ success: true, data: rows[0] });
    }

    // Search across body and titles
    if (search) {
      const q = `%${search}%`;
      const rows = await sql`
        SELECT page_type, slug, title_en, title_am, frontmatter,
               LEFT(body_md, 300) AS preview,
               jsonb_array_length(bible_refs) AS bible_ref_count,
               wiki_updated_at
        FROM wiki_pages
        WHERE title_en ILIKE ${q}
           OR title_am ILIKE ${q}
           OR body_md ILIKE ${q}
        ORDER BY wiki_updated_at DESC NULLS LAST
        LIMIT 30
      `;
      return res.status(200).json({ success: true, data: rows, count: rows.length });
    }

    // List (slim: no body_md, no full frontmatter)
    const lim = Math.min(parseInt(limit ?? '500', 10), 1000);
    const rows = type
      ? await sql`
          SELECT page_type, slug, title_en, title_am,
                 frontmatter->>'compendium_q' AS compendium_q,
                 frontmatter->>'sources' AS sources,
                 jsonb_array_length(bible_refs) AS bible_ref_count,
                 wiki_updated_at
          FROM wiki_pages
          WHERE page_type = ${type}
          ORDER BY
            NULLIF(regexp_replace(frontmatter->>'compendium_q', '\D.*$', ''), '')::int
              NULLS LAST,
            slug
          LIMIT ${lim}
        `
      : await sql`
          SELECT page_type, slug, title_en, title_am,
                 frontmatter->>'compendium_q' AS compendium_q,
                 frontmatter->>'sources' AS sources,
                 jsonb_array_length(bible_refs) AS bible_ref_count,
                 wiki_updated_at
          FROM wiki_pages
          ORDER BY
            page_type,
            NULLIF(regexp_replace(frontmatter->>'compendium_q', '\D.*$', ''), '')::int
              NULLS LAST,
            slug
          LIMIT ${lim}
        `;
    return res.status(200).json({ success: true, data: rows, count: rows.length });
  } catch (error) {
    console.error('wiki api error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch wiki pages' });
  }
}
