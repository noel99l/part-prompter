import { NextRequest, NextResponse } from 'next/server'
import { query, initDb } from '@/lib/db'
import { auth } from '@/auth'

export async function GET() {
  await initDb()
  const result = await query(`
    SELECT s.*, u.account_name as created_by_name,
      (SELECT COUNT(DISTINCT m.id) FROM prompter_members m WHERE m.song_id = s.id) as member_count
    FROM prompter_songs s
    LEFT JOIN users u ON u.id = s.created_by
    ORDER BY s.created_at DESC
  `)
  return NextResponse.json(result.rows)
}

export async function POST(req: NextRequest) {
  await initDb()
  const session = await auth()
  const { title, artist } = await req.json()
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const result = await query(
    `INSERT INTO prompter_songs (title, artist, created_by) VALUES ($1, $2, $3) RETURNING *`,
    [title, artist || '', session?.user?.id ?? null]
  )
  return NextResponse.json(result.rows[0])
}
