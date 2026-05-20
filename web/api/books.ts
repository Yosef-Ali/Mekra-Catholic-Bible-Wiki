import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);

    const books = await sql`
      SELECT id, name, amharic_name as "amharicName", chapters, section, hero_image as "heroImage"
      FROM books 
      ORDER BY id
    `;

    return res.status(200).json({ success: true, data: books });
  } catch (error) {
    console.error('Error fetching books:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch books' });
  }
}
