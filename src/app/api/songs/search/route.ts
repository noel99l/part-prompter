import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() || ''
  if (!q) return NextResponse.json([])

  const result = await query(`
    SELECT DISTINCT s.id, s.title, s.artist
    FROM prompter_songs s
    LEFT JOIN prompter_lyrics l ON l.song_id = s.id
    WHERE s.title ILIKE $1 OR s.artist ILIKE $1 OR l.text ILIKE $1
    ORDER BY s.title
    LIMIT 20
  `, [`%${q}%`])

  return NextResponse.json(result.rows)
}
