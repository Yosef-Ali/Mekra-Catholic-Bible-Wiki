import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { bookId, chapter } = req.query;

  if (!bookId || !chapter) {
    return res.status(400).json({ success: false, error: 'Missing bookId or chapter' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);
    
    const result = await sql`
      SELECT content, style, verified 
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
        verified: result[0].verified
      }
    });
  } catch (error) {
    console.error('Error fetching chapter:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch chapter' });
  }
}
