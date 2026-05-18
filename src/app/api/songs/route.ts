import { NextRequest, NextResponse } from 'next/server'
import { query, initDb } from '@/lib/db'
import { auth } from '@/auth'

export async function GET(req: NextRequest) {
  await initDb()
  const mine = req.nextUrl.searchParams.get('mine')
  const session = mine ? await auth() : null
  const email = mine && session?.user?.email ? session.user.email : null

  const result = email
    ? await query(`
        SELECT s.*, u.account_name as created_by_name,
          (SELECT COUNT(DISTINCT m.id) FROM prompter_members m WHERE m.song_id = s.id) as member_count,
          (SELECT COUNT(*) FROM prompter_lyrics l WHERE l.song_id = s.id) as lyric_count,
          (SELECT COUNT(*) FROM prompter_lyrics l WHERE l.song_id = s.id AND l.timestamp_ms IS NOT NULL) as timestamp_count
        FROM prompter_songs s
        LEFT JOIN users u ON u.id = s.created_by
        WHERE u.email = $1
        ORDER BY s.created_at DESC
      `, [email])
    : await query(`
        SELECT s.*, u.account_name as created_by_name,
          (SELECT COUNT(DISTINCT m.id) FROM prompter_members m WHERE m.song_id = s.id) as member_count,
          (SELECT COUNT(*) FROM prompter_lyrics l WHERE l.song_id = s.id) as lyric_count,
          (SELECT COUNT(*) FROM prompter_lyrics l WHERE l.song_id = s.id AND l.timestamp_ms IS NOT NULL) as timestamp_count
        FROM prompter_songs s
        LEFT JOIN users u ON u.id = s.created_by
        WHERE s.is_public = true
        ORDER BY s.created_at DESC
      `)

  return NextResponse.json(result.rows)
}

export async function POST(req: NextRequest) {
  await initDb()
  const session = await auth()
  const { title, artist } = await req.json()
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  let userId = null
  if (session?.user?.email) {
    const u = await query(`SELECT id FROM users WHERE email = $1`, [session.user.email])
    userId = u.rows[0]?.id ?? null
  }

  const result = await query(
    `INSERT INTO prompter_songs (title, artist, created_by) VALUES ($1, $2, $3) RETURNING *`,
    [title, artist || '', userId]
  )
  return NextResponse.json(result.rows[0])
}
