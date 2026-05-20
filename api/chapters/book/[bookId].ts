import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { bookId } = req.query;

  if (!bookId) {
    return res.status(400).json({ success: false, error: 'Missing bookId' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);
    
    // Get all chapter numbers for this book
    const result = await sql`
      SELECT chapter_number as "chapterNumber"
      FROM formatted_chapter_contents 
      WHERE book_id = ${Number(bookId)}
      ORDER BY chapter_number
    `;

    return res.status(200).json({ 
      success: true, 
      data: result
    });
  } catch (error) {
    console.error('Error fetching available chapters:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch chapters' });
  }
}
