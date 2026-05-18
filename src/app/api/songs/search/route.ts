import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() || ''
  if (!q) return NextResponse.json([])

  const result = await query(`
    SELECT DISTINCT s.id, s.title, s.artist, u.account_name as created_by_name, s.updated_at,
      (SELECT COUNT(*) FROM prompter_lyrics l2 WHERE l2.song_id = s.id) as lyric_count,
      (SELECT COUNT(*) FROM prompter_lyrics l2 WHERE l2.song_id = s.id AND l2.timestamp_ms IS NOT NULL) as timestamp_count,
      (SELECT COUNT(DISTINCT m.id) FROM prompter_members m WHERE m.song_id = s.id) as member_count
    FROM prompter_songs s
    LEFT JOIN prompter_lyrics l ON l.song_id = s.id
    LEFT JOIN users u ON u.id = s.created_by
    WHERE s.is_public = true AND (s.title ILIKE $1 OR s.artist ILIKE $1 OR l.text ILIKE $1)
    ORDER BY s.title
    LIMIT 20
  `, [`%${q}%`])

  return NextResponse.json(result.rows)
}
