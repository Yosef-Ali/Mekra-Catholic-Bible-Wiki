import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'PUT') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { bookId, chapter } = req.query;

  if (!bookId || !chapter) {
    return res.status(400).json({ success: false, error: 'Missing bookId or chapter' });
  }

  const sql = neon(process.env.DATABASE_URL!);

  // Handle PUT request for updates
  if (req.method === 'PUT') {
    try {
      const { content } = req.body;
      
      await sql`
        UPDATE formatted_chapter_contents 
        SET content = ${JSON.stringify(content)}, updated_at = NOW()
        WHERE book_id = ${Number(bookId)} AND chapter_number = ${Number(chapter)}
      `;

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating chapter:', error);
      return res.status(500).json({ success: false, error: 'Failed to update chapter' });
    }
  }

  // Handle GET request
  try {
    const result = await sql`
      SELECT content, style, verified, formatting_rules 
      FROM formatted_chapter_contents 
      WHERE book_id = ${Number(bookId)} AND chapter_number = ${Number(chapter)}
      LIMIT 1
    `;

    if (result.length === 0) {
      return res.status(200).json({ 
        success: true, 
        data: { content: null },
        fallbackToAI: true 
      });
    }

    return res.status(200).json({ 
      success: true, 
      data: { 
        content: result[0].content,
        style: result[0].style,
        verified: result[0].verified,
        formattingRules: result[0].formatting_rules
      }
    });
  } catch (error) {
    console.error('Error fetching chapter:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch chapter' });
  }
}
